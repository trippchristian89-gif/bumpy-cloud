import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

/* =======================
   WEBSOCKETS
======================= */

/* ===== State ===== */
let deviceSocket = null;
const clientSockets = new Set();

/* =======================
   ESP32 → CLOUD
======================= */
const wssDevice = new WebSocketServer({
  server,
  path: "/ws/device",
});

wssDevice.on("connection", (ws) => {
  console.log("✅ ESP32 connected");
  deviceSocket = ws;

  ws.on("message", (msg) => {
    const raw = msg.toString();
    console.log("⬅ ESP32:", raw);

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      console.error("❌ Invalid JSON from ESP32");
      return;
    }

    /* ===== ACK an ESP32 (WICHTIG für stabile Verbindung) ===== */
    ws.send(JSON.stringify({
      type: "ack",
      ts: Date.now()
    }));

    /* ===== Broadcast an alle Browser ===== */
    for (const client of clientSockets) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: "status",
          payload
        }));
      }
    }
  });

  ws.on("close", () => {
    console.warn("❌ ESP32 disconnected");
    deviceSocket = null;
  });

  ws.on("error", (err) => {
    console.error("❌ ESP32 WS error", err);
  });
});

/* =======================
   BROWSER → CLOUD
======================= */
const wssClient = new WebSocketServer({
  server,
  path: "/ws/client",
});

wssClient.on("connection", (ws) => {
  console.log("🌐 Browser connected");
  clientSockets.add(ws);

  /* Optional: sofort Status senden, wenn ESP32 da ist */
  if (deviceSocket) {
    ws.send(JSON.stringify({
      type: "info",
      msg: "ESP32 online"
    }));
  }

  ws.on("close", () => {
    console.log("🌐 Browser disconnected");
    clientSockets.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("🌐 Browser WS error", err);
  });
});
