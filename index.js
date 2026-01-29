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

/* ===== HTTP Server ===== */
const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

/* ===== WebSocket Server ===== */
const wss = new WebSocketServer({ server });

/* ===== Clients ===== */
const clients = {
  esp: null,
  browsers: new Set()
};

/* ===== WebSocket Logic ===== */
wss.on("connection", ws => {
  ws.role = "unknown";

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    /* --- REGISTER --- */
    if (msg.type === "register") {
      ws.role = msg.role;

      if (msg.role === "esp32") {
        clients.esp = ws;
        console.log("ESP32 registered");

        broadcastToBrowsers({
          type: "device_status",
          online: true
        });
      }

      if (msg.role === "browser") {
        clients.browsers.add(ws);
        console.log("Browser registered");

        ws.send(JSON.stringify({
          type: "device_status",
          online: !!clients.esp
        }));
      }
      return;
    }

    /* --- STATUS vom ESP32 → Browser --- */
    if (ws.role === "esp32" && msg.type === "status") {
      broadcastToBrowsers({
        type: "status",
        payload: msg.payload
      });
    }

    /* --- COMMAND vom Browser → ESP32 --- */
    if (ws.role === "browser" && msg.type === "command") {
      if (clients.esp) {
        clients.esp.send(JSON.stringify(msg));
      }
    }
  });

  ws.on("close", () => {
    if (ws.role === "esp32") {
      clients.esp = null;
      console.log("ESP32 disconnected");

      broadcastToBrowsers({
        type: "device_status",
        online: false
      });
    }

    if (ws.role === "browser") {
      clients.browsers.delete(ws);
    }
  });
});

/* ===== Helper ===== */
function broadcastToBrowsers(obj) {
  const data = JSON.stringify(obj);
  clients.browsers.forEach(ws => {
    try {
      ws.send(data);
    } catch {}
  });
}

