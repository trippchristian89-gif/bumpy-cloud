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

/* ---------- FETCH STATUS ---------- */
setInterval(fetchStatus, 1000);

async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error();

    const data = await res.json();
    setOnline(true);

    /* Temperaturen */
    tempBumpy = data.temp_bumpy;
    tempFloor = data.floor.temp_current;
    tempAir   = data.heater.temp_air;

    /* States */
    floorState  = data.floor.state;
    heaterState = data.heater.state;
    heaterInfo  = data.heater.info;

    /* Timer */
    floorTimerRemaining = data.floor.timer_remaining;

    /* Fehler */
    ntcFloorError = data.floor.ntc_error;
    ntcAirError   = data.heater.ntc_air_error;
    ntcBumpyError = data.ntc_bumpy_error;
    ntcBumpyError = false; // optional später

    updateUI();
  } catch (e) {
    setOnline(false);
  }
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