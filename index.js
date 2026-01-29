import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* ===== Globaler Zustand ===== */
let deviceOnline = false;
let lastStatus = null;
let deviceSocket = null;
let lastStatus = null;

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
   WEBSOCKET (Single Socket)
======================= */

const wss = new WebSocketServer({ server });

const browserClients = new Set();

wss.on("connection", (ws) => {
  console.log("🔌 WS connection");

  let role = "unknown"; // "device" | "browser"

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch {
      console.warn("⚠️ Invalid JSON");
      return;
    }

    /* ===== DEVICE IDENTIFICATION ===== */
    if (role === "unknown") {
      role = "device";
      deviceSocket = ws;
      deviceOnline = true;

      console.log("✅ ESP32 identified");
      broadcastDeviceStatus();
    }

    /* ===== STATUS VOM ESP32 ===== */
    if (role === "device") {
      lastStatus = data;

      broadcastToBrowsers({
        type: "status",
        payload: data
      });
    }
  });

  ws.on("close", () => {
    if (role === "device") {
      console.warn("❌ ESP32 disconnected");
      deviceOnline = false;
      deviceSocket = null;
      broadcastDeviceStatus();
    }

    if (role === "browser") {
      browserClients.delete(ws);
      console.log("🌐 Browser disconnected");
    }
  });

  ws.on("error", () => {
    console.warn("⚠️ WS error");
  });

  /* ===== DEFAULT = BROWSER ===== */
  role = "browser";
  browserClients.add(ws);

  // Browser sofort informieren
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

