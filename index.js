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

/* ===== HTTP Health ===== */
app.get("/api/health", (req, res) => {
  res.json({ status: "BUMPY cloud online 🚐" });
});

/* ===== HTTP Server ===== */
const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

/* ===== WebSocket Server ===== */
const wss = new WebSocketServer({ server });

/* ===== State ===== */
let deviceSocket = null;
let lastStatus = null;

/* ===== WS Routing ===== */
wss.on("connection", (ws, req) => {
  const url = req.url;

  /* ===== DEVICE ===== */
  if (url === "/ws/device") {
    console.log("🔌 DEVICE connected");
    deviceSocket = ws;

    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg.toString());
        lastStatus = data;

        // an alle Clients weiterreichen
        broadcastToClients({
          type: "status",
          payload: data
        });

      } catch (e) {
        console.error("❌ Invalid JSON from device");
      }
    });

    ws.on("close", () => {
      console.log("❌ DEVICE disconnected");
      deviceSocket = null;

      broadcastToClients({
        type: "device",
        online: false
      });
    });

    // Device online melden
    broadcastToClients({
      type: "device",
      online: true
    });

    return;
  }

  /* ===== CLIENT ===== */
  if (url === "/ws/client") {
    console.log("🧑‍💻 CLIENT connected");

    // sofort letzten Status senden
    if (lastStatus) {
      ws.send(JSON.stringify({
        type: "status",
        payload: lastStatus
      }));
    }

    ws.send(JSON.stringify({
      type: "device",
      online: !!deviceSocket
    }));

    ws.on("message", msg => {
      try {
        const data = JSON.parse(msg.toString());

        // Command vom Client → Device
        if (data.type === "cmd" && deviceSocket) {
          deviceSocket.send(JSON.stringify(data));
        }

      } catch (e) {
        console.error("❌ Invalid JSON from client");
      }
    });

    return;
  }

  /* ===== UNKNOWN ===== */
  console.log("⚠️ Unknown WS path:", url);
  ws.close();
});

/* ===== Helpers ===== */
function broadcastToClients(message) {
  wss.clients.forEach(client => {
    if (
      client.readyState === 1 &&
      client !== deviceSocket
    ) {
      client.send(JSON.stringify(message));
    }
  });
}
