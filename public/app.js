/* ---------- STATE ---------- */
let tempBumpy = 0;
let tempFloor = 0;
let tempAir   = 0;

let floorState = "OFF";
let heaterState = "OFF";
let heaterInfo  = "";

let floorTimerRemaining = 0;

let ntcFloorError = false;
let ntcAirError   = false;
let ntcBumpyError = false;

/* =======================
   WebSocket (Browser → Cloud)
======================= */

const wsProto = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(wsProto + location.host);

ws.onopen = () => {
  console.log("🌐 WS connected");
  ws.send(JSON.stringify({ type: "identify", role: "browser" }));
};

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);

  if (data.type === "device") {
    setOnline(data.online);
  }

  if (data.type === "status") {
    applyStatus(data.payload);
  }
};

function startHeater() {
  ws.send(JSON.stringify({ type: "command", command: "heater_start" }));
}

function stopHeater() {
  ws.send(JSON.stringify({ type: "command", command: "heater_stop" }));
}

/* ================= MAPPING ================= */
function applyStatus(data) {

  /* bumpy */
  tempBumpy = data.temp_bumpy;
  ntcBumpyError = data.ntc_bumpy_error;

  /* floorHeating */
  floorState  = data.floor.state;
  floorTimerRemaining = data.floor.timer_remaining;
  floorTimerTotal = data.floor.timer_total
  tempFloor = data.floor.temp_current;
  ntcFloorError = data.floor.ntc_error;

  /* heater */
  heaterState = data.heater.state;
  heaterInfo  = data.heater.info || "";
  tempAir   = data.heater.temp_air;
  ntcAirError   = data.heater.ntc_air_error;

  updateUI();
}

/* ---------- COMMANDS (REST) ---------- */
function startHeater() {
  fetch("/api/heater/start", { method: "POST" });
}

function stopHeater() {
  fetch("/api/heater/stop", { method: "POST" });
}

/* ================= UI ================= */
function updateUI() {
  setText("temp_bumpy", formatTemp(tempBumpy), ntcBumpyError);
  setText("floor_temp", formatTemp(tempFloor), ntcFloorError);
  setText("temp_air",   formatTemp(tempAir),   ntcAirError);

  document.getElementById("floor_state").textContent  = floorState;
  document.getElementById("heater_state").textContent = heaterState;

  const infoEl = document.getElementById("heater_info");
  infoEl.textContent = heaterInfo || "";
  infoEl.className =
    heaterInfo.includes("FAILED") ? "info error" : "info";

  document.getElementById("floor_timer").textContent =
    formatTime(floorTimerRemaining);
}

function setText(id, text, error) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = error ? "#c53030" : "";
}

/* ================= HELPERS ================= */
function formatTemp(v) {
  return Number(v).toFixed(1) + " °C";
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ================= ONLINE STATUS ================= */
function setOnline(isOnline) {
  const el = document.getElementById("connection_status");
  el.textContent = isOnline ? "online" : "offline";
  el.className = "status " + (isOnline ? "online" : "offline");
}

/* ================= LONG PRESS ================= */
const LONG_PRESS_MS = 200;

function attachLongPress(buttonId, actionFn) {
  let pressTimer = null;
  const btn = document.getElementById(buttonId);

  btn.addEventListener("pointerdown", () => {
    pressTimer = setTimeout(actionFn, LONG_PRESS_MS);
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach(evt =>
    btn.addEventListener(evt, () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    })
  );
}

/* ================= INIT ================= */
attachLongPress("btn_start", startHeater);

attachLongPress("btn_stop", stopHeater);






