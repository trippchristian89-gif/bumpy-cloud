import express from "express";
import mqtt from "mqtt";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
/* ===== SQLite ===== */
const db = new sqlite3.Database("./bumpy.db", (err) => {
  if (err) console.error("SQLite error:", err.message);
  else console.log("🗄️ SQLite connected");
});

/* ===== ESM Fix ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== Basic Auth ===== */
const BASIC_AUTH_USER = "bumpy";
const BASIC_AUTH_PASS = "MB-816d";

function basicAuth(req, res, next) {
  const auth = req.headers["authorization"];
  if (auth) {
    const b64 = auth.split(" ")[1] || "";
    const [user, pass] = Buffer.from(b64, "base64").toString().split(":");
    if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
      return next();
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="BUMPY"');
  res.status(401).send("Zugang verweigert");
}

/* ===== App ===== */
const app = express();
const PORT = process.env.PORT || 8080;

app.use(basicAuth);
app.use(express.static(path.join(__dirname, "public")));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/trips", (req, res) => {

  db.all(
    "SELECT * FROM trips ORDER BY start_time DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      res.json(rows);
    }
  );

});

app.get("/api/tracking", (req, res) => {

  const tripId = req.query.trip_id;

  db.all(
    "SELECT lat,lon FROM tracking WHERE trip_id=? ORDER BY timestamp",
    [tripId],
    (err, rows) => {

      if (err) return res.status(500).json({ error: err });

      res.json(rows);

    }
  );

});


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
let currentTripId = null;

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
  mqttClient.subscribe("bumpy/tracking",  { qos: 0 });
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
  
  /* ===== TRACKING ===== */
  if (topic === "bumpy/tracking") {

    if (!data.lat || !data.lon) return;

    saveTracking(data.lat, data.lon);

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

    if (data.type === "command") {

  console.log("➡️ Command:", data.command);

  // ===== TRIP START =====
  if (data.command === "start_trip") {

    const name = data.name || "Reise " + new Date().toISOString().slice(0,10);

    startTrip(name);
    return;
  }

  // ===== TRIP END =====
  if (data.command === "end_trip") {

    endTrip();
    return;
  }

  // ===== ESP COMMANDS =====
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
//--tracking--
function startTrip(name) {

  const time = Date.now();

  db.run(
    "INSERT INTO trips (name,start_time) VALUES (?,?)",
    [name, time],
    function(err) {

      if (err) {
        console.error("Trip start error:", err);
        return;
      }

      currentTripId = this.lastID;
      console.log("🧭 Trip started:", currentTripId);

    }
  );
}

function endTrip() {

  if (!currentTripId) return;

  const time = Date.now();

  db.run(
    "UPDATE trips SET end_time=? WHERE id=?",
    [time, currentTripId]
  );

  console.log("🛑 Trip ended:", currentTripId);

  currentTripId = null;
}

function saveTracking(lat, lon) {

  if (!currentTripId) return;

  const time = Date.now();

  db.run(
    "INSERT INTO tracking (trip_id,timestamp,lat,lon) VALUES (?,?,?,?)",
    [currentTripId, time, lat, lon]
  );
}

function mqttPublish(topic, obj) {
  mqttClient.publish(topic, JSON.stringify(obj), { qos: 1 });
}

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  for (const c of browserClients) {
    if (c.readyState === 1) c.send(msg);
  }
}


