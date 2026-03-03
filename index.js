import express from "express";
import mqtt from "mqtt";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* ===== ESM Fix ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== App ===== */
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public")));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 HTTP listening on", PORT);
});

/* =======================
   GLOBAL STATE
======================= */
let deviceOnline = false;
let lastHeartbeat = 0;
let lastStatus = null;
let streamingActive = false;

const browserClients = new Set();

/* =======================
   MQTT BROKER CONNECTION
   Mosquitto läuft lokal auf der Oracle VM:
   sudo apt install mosquitto mosquitto-clients -y
   Port: 1883 (intern), optional 8883 TLS
======================= */
const mqttClient = mqtt.connect("mqtt://localhost:1883", {
  clientId: "bumpy-server",
  clean: true,
  reconnectPeriod: 3000,
});

mqttClient.on("connect", () => {
  console.log("✅ MQTT broker connected");

  mqttClient.subscribe("bumpy/identify",  { qos: 1 });
  mqttClient.subscribe("bumpy/heartbeat", { qos: 0 });
  mqttClient.subscribe("bumpy/status",    { qos: 0 });
});

mqttClient.on("error", (err) => console.error("❌ MQTT error:", err.message));
mqttClient.on("reconnect", () => console.log("🔄 MQTT reconnecting..."));

/* =======================
   MQTT → LOGIK
======================= */
mqttClient.on("message", (topic, message) => {
  let data;
  try {
    data = JSON.parse(message.toString());
  } catch {
    console.warn("⚠️ Invalid JSON on", topic);
    return;
  }

  /* ===== IDENTIFY ===== */
  if (topic === "bumpy/identify") {
    if (data.role !== "device") return;

    console.log("✅ ESP32 identified → state reset");
    deviceOnline = true;
    lastHeartbeat = Date.now();
    streamingActive = false;

    broadcastToBrowsers({ type: "device", online: true });
    maybeEnableStreaming();
    return;
  }

  /* ===== HEARTBEAT ===== */
  if (topic === "bumpy/heartbeat") {
    lastHeartbeat = Date.now();
    return;
  }

  /* ===== STATUS ===== */
  if (topic === "bumpy/status") {
    lastStatus = data;
    broadcastToBrowsers({ type: "status", payload: data });
    return;
  }
});

/* =======================
   HEARTBEAT WATCHDOG
======================= */
setInterval(() => {
  if (deviceOnline && Date.now() - lastHeartbeat > 15000) {
    console.warn("⏱️ ESP32 heartbeat timeout");
    deviceOnline = false;
    streamingActive = false;
    mqttPublish("bumpy/stream", { active: false });
    broadcastToBrowsers({ type: "device", online: false });
  }
}, 5000);

/* =======================
   STREAM CONTROL
======================= */
function maybeEnableStreaming() {
  if (!deviceOnline || streamingActive || browserClients.size === 0) return;
  streamingActive = true;
  console.log("📡 Streaming ON");
  mqttPublish("bumpy/stream", { active: true });
}

function disableStreaming() {
  if (!streamingActive) return;
  streamingActive = false;
  console.log("📴 Streaming OFF");
  mqttPublish("bumpy/stream", { active: false });
}

/* =======================
   WEBSOCKET → BROWSER
   Browser verbindet sich weiterhin per WebSocket
   (kein MQTT im Browser nötig)
======================= */
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🌐 Browser connected");
  browserClients.add(ws);

  // Initialzustand senden
  ws.send(JSON.stringify({ type: "device", online: deviceOnline }));
  if (lastStatus) {
    ws.send(JSON.stringify({ type: "status", payload: lastStatus }));
  }

  maybeEnableStreaming();

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      return;
    }

    // Browser → Command → MQTT → ESP32
    if (data.type === "command") {
      console.log("➡️ Command:", data.command);
      mqttPublish("bumpy/command", { command: data.command });
    }
  });

  ws.on("close", () => {
    console.log("🌐 Browser disconnected");
    browserClients.delete(ws);
    if (browserClients.size === 0) disableStreaming();
  });
});

/* =======================
   HELPERS
======================= */
function mqttPublish(topic, obj) {
  mqttClient.publish(topic, JSON.stringify(obj), { qos: 1 });
}

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  for (const c of browserClients) {
    if (c.readyState === 1) c.send(msg);
  }
}
