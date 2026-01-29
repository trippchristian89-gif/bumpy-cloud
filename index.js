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

/* ===== ONE WebSocket ===== */
const wss = new WebSocketServer({ server });

let lastPayload = null;

wss.on("connection", ws => {
  console.log("✅ WS connected");

  // Browser bekommt sofort letzten Status
  if (lastPayload) {
    ws.send(JSON.stringify({
      type: "status",
      payload: lastPayload
    }));
  }

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg.toString());
      lastPayload = data;

      console.log("⬅ JSON:", data);

      // an ALLE Clients broadcasten
      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: "status",
            payload: data
          }));
        }
      });

    } catch (e) {
      console.warn("❌ invalid JSON", msg.toString());
    }
  });

  ws.on("close", () => {
    console.log("❌ WS disconnected");
  });
});

