import express from "express";
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 HTTP listening on", PORT);
});

/* =======================
   GLOBAL STATE
======================= */
let deviceSocket = null;
let deviceOnline = false;
let lastHeartbeat = 0;
let lastStatus = null;

const browserClients = new Set();

/* =======================
   WEBSOCKET SERVER
======================= */
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔌 WS connection");

  let role = "unknown"; // device | browser

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      console.warn("⚠️ Invalid JSON");
      return;
    }

    /* ===== IDENTIFY ===== */
if (data.type === "identify") {
  role = data.role;

  if (role === "device") {
  console.log("✅ ESP32 identified → full state reset");

  // 🔥 alten Device-Socket hart beenden
  if (deviceSocket && deviceSocket !== ws) {
    try {
      deviceSocket.terminate();
    } catch {}
  }

  // 🔴 HARTER RESET ALLER ESP-RELEVANTEN STATES
  deviceSocket = ws;
  deviceOnline = true;
  lastHeartbeat = Date.now();

  // ⛔ WICHTIG: Streaming IMMER zuerst AUS
  disableStreaming();

  // 📢 Browser IMMER über neuen Online-Status informieren
  broadcastDeviceStatus();

  // 📡 Streaming NUR neu aktivieren, wenn Browser da ist
  if (browserClients.size > 0) {
    console.log("📡 Browser present → enable streaming");
    enableStreaming();
  }
}

  if (role === "browser") {
    console.log("🌐 Browser connected");
    browserClients.add(ws);

    ws.send(JSON.stringify({
      type: "device",
      online: deviceOnline
    }));

    if (lastStatus) {
      ws.send(JSON.stringify({
        type: "status",
        payload: lastStatus
      }));
    }

    enableStreaming();
  }

  return;
}

    /* ===== HEARTBEAT ===== */
    if (data.type === "heartbeat" && role === "device") {
      lastHeartbeat = Date.now();
      return;
    }

    /* ===== STATUS ===== */
    if (data.type === "status" && role === "device") {
      lastStatus = data.payload;
      /*
      if (data.payload.gps) {
        console.log(
          "📍 GPS from ESP32:",
          data.payload.gps.fix ? "FIX" : "NO FIX",
          data.payload.gps.lat,
          data.payload.gps.lon,
          "Sats:",
          data.payload.gps.sats
        );
      } */

      // NICHT loggen → Datensparen
      broadcastToBrowsers({
        type: "status",
        payload: data.payload
      });
      return;
    }

    /* ===== COMMANDS ===== */
    if (data.type === "command" && role === "browser") {
      if (!deviceSocket) return;

      console.log("➡️ Heater command:", data.command);
      deviceSocket.send(JSON.stringify({
        type: "command",
        command: data.command
      }));
    }
  });

ws.on("close", () => {
  if (role === "device") {

    // ❗ WICHTIG: nur reagieren, wenn DAS der aktuelle Device-Socket ist
    if (ws !== deviceSocket) {
      console.log("⚠️ Ignoring close of stale ESP32 socket");
      return;
    }

    console.warn("❌ ESP32 disconnected (active socket)");
    deviceSocket = null;
    deviceOnline = false;
    disableStreaming();          
    broadcastDeviceStatus();
  }

    if (role === "browser") {
      console.log("🌐 Browser disconnected");
      browserClients.delete(ws);

      if (browserClients.size === 0) {
        disableStreaming();
      }
    }
  });
});

/* =======================
   HEARTBEAT WATCHDOG
======================= */
setInterval(() => {
  if (deviceSocket && deviceOnline && Date.now() - lastHeartbeat > 15000) {
    console.warn("⏱️ ESP32 heartbeat timeout");

    deviceOnline = false;
    deviceSocket = null;
    disableStreaming();
    broadcastDeviceStatus();
  }
}, 5000);

/* =======================
   STREAM CONTROL
======================= */
function enableStreaming() {
  if (!deviceSocket) return;
  console.log("📡 Streaming ON");
  deviceSocket.send(JSON.stringify({ type: "stream_on" }));
}

function disableStreaming() {
  if (!deviceSocket) return;
  console.log("📴 Streaming OFF");
  deviceSocket.send(JSON.stringify({ type: "stream_off" }));
}

/* =======================
   BROADCAST
======================= */
function broadcastDeviceStatus() {
  broadcastToBrowsers({
    type: "device",
    online: deviceOnline
  });
}

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  for (const c of browserClients) {
    if (c.readyState === 1) c.send(msg);
  }
}
















