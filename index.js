import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 8080;

// nötig für ES Modules
const __filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

// 🔹 Frontend aus /public ausliefern
app.use(express.static(path.join(__dirname, "public")));

// 🔹 Fallback: index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔹 HTTP Server starten
const server = app.listen(PORT, () => {
  console.log("BUMPY Cloud online on port", PORT);
});

// 🔹 WebSocket Server
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("WS client connected");

  ws.send(JSON.stringify({
    type: "status",
    value: "connected"
  }));

  ws.on("message", msg => {
    console.log("MSG:", msg.toString());
  });
});
