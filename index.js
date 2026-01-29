import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* ===== Globaler Zustand ===== */
let deviceOnline = false;
let lastStatus = null;
let deviceSocket = null;
const browserClients = new Set();

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
   WEBSOCKET
======================= */
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔌 WS connection");

  let isDevice = false;

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch (e) {
      console.warn("⚠️ Invalid JSON");
      return;
    }

    /* ===== ESP32 meldet sich ===== */
    if (!isDevice) {
      console.log("✅ ESP32 identified");
      isDevice = true;
      deviceSocket = ws;
      deviceOnline = true;
      broadcastDeviceStatus();
    }

    /* ===== Status merken & an Browser verteilen ===== */
    lastStatus = data;

    broadcastToBrowsers({
      type: "status",
      payload: data,
    });
  });

  ws.on("close", () => {
    if (isDevice) {
      console.warn("❌ ESP32 disconnected");
      deviceOnline = false;
      deviceSocket = null;
      broadcastDeviceStatus();
    } else {
      browserClients.delete(ws);
      console.log("🌐 Browser disconnected");
    }
  });

  /* ===== Browser-Verbindung ===== */
  ws.on("error", () => {
    console.warn("WS error");
  });

  // Browser sofort registrieren
  browserClients.add(ws);

  // Sofort aktuellen Zustand schicken
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
});

/* =======================
   Helper
======================= */
function broadcastDeviceStatus() {
  broadcastToBrowsers({
    type: "device",
    online: deviceOnline
  });
}

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  for (const client of browserClients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}
