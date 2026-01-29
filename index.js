import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* ===== __dirname Fix (ESM!) ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== App ===== */
const app = express();
const PORT = process.env.PORT || 8080;

/* ===== Letzter Status vom ESP32 ===== */
let lastStatus = null;
let lastSeen = null;

/* ===== Static Frontend ===== */
app.use(express.static(path.join(__dirname, "public")));

/* ===== REST: Status für Web-UI ===== */
app.get("/api/status", (req, res) => {
  res.json({
    online: !!lastStatus,
    lastSeen,
    data: lastStatus
  });
});

/* ===== Health ===== */
app.get("/api/health", (req, res) => {
  res.json({ status: "BUMPY cloud online 🚐" });
});

/* ===== HTTP Server ===== */
const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

/* ===== WebSocket Server ===== */
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("✅ WS client connected");

  ws.on("message", raw => {
    try {
      const msg = raw.toString();
      console.log("⬅ WS MSG:", msg);

      const parsed = JSON.parse(msg);

      // Status merken
      lastStatus = parsed;
      lastSeen = new Date().toISOString();

      // ACK an ESP32
      ws.send(JSON.stringify({
        type: "ack",
        received: true,
        ts: lastSeen
      }));
    } catch (err) {
      console.error("❌ WS parse error:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("⚠️ WS client disconnected");
  });

  ws.on("error", err => {
    console.error("❌ WS error:", err.message);
  });

  // Initiale Antwort
  ws.send(JSON.stringify({
    type: "status",
    status: "connected"
  }));
});

