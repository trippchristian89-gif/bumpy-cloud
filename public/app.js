/* =======================
   STATE
======================= */
let tempBumpy = 0;
//let tempFloor = 0;
let tempAir   = 0;

let floorState = "OFF";
let heaterState = "OFF";
let heaterInfo  = "";

let floorTimerRemaining = 0;
let floorTimerTotal = 0;

let ntcBumpyError = false;
let ntcFloorError = false;
let ntcAirError   = false;

let isOnline = false;

//GPS
let gpsFix = false;
let gpsLat = null;
let gpsLon = null;
let gpsSats = 0;

/* =======================
   WEBSOCKET CLIENT
======================= */
const wsProto = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(wsProto + location.host);

ws.onopen = () => {
  console.log("🌐 WS connected");

  ws.send(JSON.stringify({
    type: "identify",
    role: "browser"
  }));
};

ws.onmessage = (e) => {
  let data;
  try {
    data = JSON.parse(e.data);
  } catch {
    return;
  }

  if (data.type === "device") {
     isOnline = data.online;
     setOnline(data.online);

     if (!isOnline) {
        resetUI();
     }
  }

  if (data.type === "status") {
    applyStatus(data.payload);
  }
};

ws.onclose = () => {
  console.warn("⚠️ WS disconnected");
  setOnline(false);
};

/* =======================
   HEATER floorheating COMMANDS
======================= */
function startFloor() {
   console.log("UI: floorheating_start clicked");
  ws.send(JSON.stringify({ type: "command", command: "floor_start" }));
}

function stopFloor() {
   console.log("UI: floorheating_stop clicked");
  ws.send(JSON.stringify({ type: "command", command: "floor_stop" }));
}

function startHeater() {
   console.log("UI: heater_start clicked");
  ws.send(JSON.stringify({ type: "command", command: "heater_start" }));
}

function stopHeater() {
   console.log("UI: heater_stop clicked");
  ws.send(JSON.stringify({ type: "command", command: "heater_stop" }));
}

/* =======================
   STATUS MAPPING
======================= */
function applyStatus(data) {
  if (!isOnline) return;
  tempBumpy = data.temp_bumpy;
  ntcBumpyError = data.ntc_bumpy_error;

  floorState = data.floor.state;
  floorTimerRemaining = data.floor.timer_remaining;
  floorTimerTotal = data.floor.timer_total;

  heaterState = data.heater.state;
  heaterInfo = data.heater.info || "";
  tempAir = data.heater.temp_air;
  ntcAirError = data.heater.ntc_air_error;

  gpsFix  = data.gps.fix;
  gpsLat  = data.gps.lat;
  gpsLon  = data.gps.lon;
  gpsSats = data.gps.sats;

  updateMapMarker();
  updateUI();
}

/* =======================
   UI
======================= */
function setOnline(isOnline) {
  const el = document.getElementById("connection_status");
  el.textContent = isOnline ? "online" : "offline";
  el.className = "status " + (isOnline ? "online" : "offline");
}

function updateUI() {
  if (!isOnline) return;
  setText("temp_bumpy", formatTemp(tempBumpy), ntcBumpyError);
  setText("temp_air", formatTemp(tempAir), ntcAirError);

  const floorStateEl = document.getElementById("floor_state");
  if (ntcFloorError) {
    floorStateEl.textContent = "ERROR";
    floorStateEl.style.color = "#c53030";
  } else {
    floorStateEl.textContent = floorState;
    floorStateEl.style.color = "";
  }

  document.getElementById("heater_state").textContent = heaterState;

  const infoEl = document.getElementById("heater_info");
  infoEl.textContent = heaterInfo || "";
  infoEl.className = heaterInfo.includes("FAILED") ? "info error" : "info";

  document.getElementById("floor_timer").textContent = formatTime(floorTimerRemaining);
  document.getElementById("floor_timer_total").textContent = formatTime(floorTimerTotal);
}

function setText(id, text, error) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#c53030" : "";
}

function formatTemp(v) {
  if (v === undefined || v === null) return "--.- °C";
  return Number(v).toFixed(1) + " °C";
}

function formatTime(sec) {
  if (sec === undefined || sec === null) return "--:--";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function resetUI() {
  setText("temp_bumpy", "--.- °C", false);
  setText("floor_temp", "--.- °C", false);
  setText("temp_air", "--.- °C", false);

  document.getElementById("floor_state").textContent = "--";
  document.getElementById("heater_state").textContent = "--";
  document.getElementById("heater_info").textContent = "";

  document.getElementById("floor_timer").textContent = "--:--";
  document.getElementById("floor_timer_total").textContent = "--:--";
}

/* =======================
   BUTTON BINDINGS
======================= */
window.addEventListener("DOMContentLoaded", () => {

  const btnFloorStart = document.getElementById("btn_floor_start");
  const btnFloorStop  = document.getElementById("btn_floor_stop");
  if (btnFloorStart) btnFloorStart.addEventListener("click", startFloor);
  if (btnFloorStop)  btnFloorStop.addEventListener("click", stopFloor);

  const btnStart = document.getElementById("btn_start");
  const btnStop  = document.getElementById("btn_stop");
  if (btnStart) btnStart.addEventListener("click", () => { console.log("🔥 UI Button START"); startHeater(); });
  if (btnStop)  btnStop.addEventListener("click",  () => { console.log("🧊 UI Button STOP");  stopHeater(); });

});

/* =======================
   MAP INIT
======================= */
let map;
let gpsMarker;

window.addEventListener("DOMContentLoaded", () => {
  map = L.map("map", {
    zoomControl: true,
    attributionControl: false
  }).setView([50.8070, 8.7700], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  gpsMarker = L.circleMarker([50.8070, 8.7700], {
    radius: 8,
    color: "#f97316",
    fillColor: "#f97316",
    fillOpacity: 0.9
  }).addTo(map);

  // ===== LOCATE BUTTON =====
  const LocateControl = L.Control.extend({
    options: { position: "bottomright" },

    onAdd: function () {
      const btn = L.DomUtil.create("button", "locate-btn");
      btn.title = "Zu meinem Standort";
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2"  x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2"  y1="12" x2="6"  y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>`;

      L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, "click", () => {
        if (gpsLat !== null && gpsLon !== null) {
          map.setView([gpsLat, gpsLon], 15, { animate: true });
        }
      });

      return btn;
    }
  });

  new LocateControl().addTo(map);
});

/* =======================
   MARKER UPDATE
======================= */
function updateMapMarker() {
  if (!map || !gpsMarker) return;
  if (gpsLat === null || gpsLon === null) return;

  gpsMarker.setLatLng([gpsLat, gpsLon]);

  if (gpsFix) {
    gpsMarker.setStyle({ color: "#16a34a", fillColor: "#16a34a" });
  } else {
    gpsMarker.setStyle({ color: "#f97316", fillColor: "#f97316" });
  }
}
