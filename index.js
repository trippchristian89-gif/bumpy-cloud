import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* ===== ESM-FIX für __dirname ===== */
const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

/* ===== APP SETUP ===== */
const app = express();
const PORT = process.env.PORT || 8080;

/* ===== FRONTEND AUSLIEFERN ===== */
app.use(express.static(path.join(__dirname, "public")));

/* ===== HEALTH / TEST ENDPOINT ===== */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BUMPY Cloud",
    time: Date.now()
  });
});

/* ===== SERVER START ===== */
const server = app.listen(PORT, () => {
  console.log("🚐 BUMPY Cloud listening on port", PORT);
});

/* ===== WEBSOCKET SERVER ===== */
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("🔌 WebSocket client connected");

  // Begrüßung
  ws.send(JSON.stringify({
    type: "hello",
    source: "bumpy-cloud",
    ts: Date.now()
  }));

  // Empfang von Nachrichten
  ws.on("message", msg => {
    console.log("📨 WS message:", msg.toString());

    // Echo / Mock-Antwort
    ws.send(JSON.stringify({
      type: "ack",
      received: msg.toString(),
      ts: Date.now()
    }));
  });

  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
  });
});
