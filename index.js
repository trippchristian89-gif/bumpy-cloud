import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("BUMPY cloud online 🚐");
});

const server = app.listen(PORT, () => {
  console.log("HTTP listening on", PORT);
});

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("WS client connected");

  ws.on("message", msg => {
    console.log("MSG:", msg.toString());
  });

  ws.send(JSON.stringify({ status: "connected" }));
});