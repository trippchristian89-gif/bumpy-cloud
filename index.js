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

/* ===== Static Frontend ===== */
app.use(express.static(path.join(__dirname, "public")));

/* ===== Health ===== */
app.get("/api/health", (req, res) => {
  res.json({ status: "BUMPY cloud online 🚐" });
});

/* ===== HTTP ===== */
const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

/* =======================
   WEBSOCKET (ESP32 + Browser)
======================= */

const wss = new WebSocketServer({ server });

let lastStatus = null;
const clients = new Set();

wss.on("connection", (ws) => {
  console.log("🔌 WS client connected");
  clients.add(ws);

  // Wenn Browser neu verbindet → letzten Status schicken
  if (lastStatus) {
    ws.send(JSON.stringify({
      type: "status",
      payload: lastStatus
    }));
  }

  ws.on("message", (msg) => {
    const text = msg.toString();
    console.log("⬅ WS:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("❌ Invalid JSON");
      return;
    }

    // 👉 ESP32 schickt reines Status-JSON
    lastStatus = data;

    // 👉 an ALLE Browser verteilen
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: "status",
          payload: data
        }));
      }
    }
  });

  ws.on("close", () => {
    console.log("❌ WS client disconnected");
    clients.delete(ws);
  });
});
