import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* ===== ESM Fix für __dirname ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== App ===== */
const app = express();
const PORT = process.env.PORT || 8080;

/* ===== Static Frontend ===== */
app.use(express.static(path.join(__dirname, "public")));

/* ===== Health / Test ===== */
app.get("/api/health", (req, res) => {
  res.json({ status: "BUMPY cloud online 🚐" });
});

/* ===== HTTP Server ===== */
const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

/* ===== WebSocket ===== */
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("WS client connected");

  ws.on("message", msg => {
    console.log("WS MSG:", msg.toString());

    // Echo / Test
    ws.send(JSON.stringify({
      type: "echo",
      received: msg.toString()
    }));
  });

  ws.send(JSON.stringify({
    type: "status",
    status: "connected"
  }));
});

