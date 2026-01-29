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

let deviceSocket = null;
const clientSockets = new Set();

/* === ESP32 === */
const wssDevice = new WebSocketServer({
  server,
  path: "/ws/device",
});

wssDevice.on("connection", (ws) => {
  console.log("✅ ESP32 connected");
  deviceSocket = ws;

  ws.on("message", (msg) => {
    console.log("⬅ ESP32:", msg.toString());

    // Broadcast to all browsers
    for (const client of clientSockets) {
      client.send(
        JSON.stringify({
          type: "status",
          payload: JSON.parse(msg.toString()),
        })
      );
    }
  });

  ws.on("close", () => {
    console.warn("❌ ESP32 disconnected");
    deviceSocket = null;
  });
});

/* === BROWSER === */
const wssClient = new WebSocketServer({
  server,
  path: "/ws/client",
});

wssClient.on("connection", (ws) => {
  console.log("🌐 Browser connected");
  clientSockets.add(ws);

  ws.on("close", () => {
    console.log("🌐 Browser disconnected");
    clientSockets.delete(ws);
  });
});

