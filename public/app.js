/* =======================
   STATE
======================= */
let tempBumpy = 0;
let tempFloor = 0;
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
        resetUI(); // Platzhalter
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
   HEATER COMMANDS
======================= */
function startHeater() { 
   
   console.log("UI: heater_start clicked");
   
  ws.send(JSON.stringify({
    type: "command",
    command: "heater_start"
  }));
}

function stopHeater() {
      
   console.log("UI: heater_stop clicked");
   
  ws.send(JSON.stringify({
    type: "command",
    command: "heater_stop"
  }));
}

/* =======================
   STATUS MAPPING
======================= */
function applyStatus(data) {
    if (!isOnline) return; // ❗ keine alten Werte anzeigen
  tempBumpy = data.temp_bumpy;
  ntcBumpyError = data.ntc_bumpy_error;

  floorState = data.floor.state;
  tempFloor = data.floor.temp_current;
  floorTimerRemaining = data.floor.timer_remaining;   
  floorTimerTotal = data.floor.timer_total;
  ntcFloorError = data.floor.ntc_error;

  heaterState = data.heater.state;
  heaterInfo = data.heater.info || "";
  tempAir = data.heater.temp_air;
  ntcAirError = data.heater.ntc_air_error;

   // GPS
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

// Update UI 

function updateUI() {
   if (!isOnline) return;
  setText("temp_bumpy", formatTemp(tempBumpy), ntcBumpyError);
  setText("floor_temp", formatTemp(tempFloor), ntcFloorError);
  setText("temp_air", formatTemp(tempAir), ntcAirError);

  document.getElementById("floor_state").textContent = floorState;
  document.getElementById("heater_state").textContent = heaterState;

  const infoEl = document.getElementById("heater_info");
  infoEl.textContent = heaterInfo || "";
  infoEl.className =
    heaterInfo.includes("FAILED") ? "info error" : "info";

  document.getElementById("floor_timer").textContent =
    formatTime(floorTimerRemaining);
   
  document.getElementById("floor_timer_total").textContent =
    formatTime(floorTimerTotal);


   /*
   // GPS Anzeige
   const gpsStatusEl = document.getElementById("gps_status");
   const gpsCoordsEl = document.getElementById("gps_coords");
   
   if (!isOnline) {
     gpsStatusEl.textContent = "--";
     gpsCoordsEl.textContent = "--";
   } else if (gpsFix) {
     gpsStatusEl.textContent = `FIX (${gpsSats} sats)`;
     gpsCoordsEl.textContent =
       `${gpsLat.toFixed(6)}, ${gpsLon.toFixed(6)}`;
   } else {
     gpsStatusEl.textContent = "NO FIX (last known)";
     gpsCoordsEl.textContent =
       `${gpsLat.toFixed(6)}, ${gpsLon.toFixed(6)}`;
   }
   */
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

// reset UI 
function resetUI() {
  setText("temp_bumpy", "--.- °C", false);
  setText("floor_temp", "--.- °C", false);
  setText("temp_air", "--.- °C", false);

  document.getElementById("floor_state").textContent = "--";
  document.getElementById("heater_state").textContent = "--";
  document.getElementById("heater_info").textContent = "";

  document.getElementById("floor_timer").textContent = "--:--";
  document.getElementById("floor_timer_total").textContent = "--:--";
/*
   document.getElementById("gps_status").textContent = "--";
   document.getElementById("gps_coords").textContent = "--";
   */
}

/* =======================
   BUTTON BINDINGS
======================= */
window.addEventListener("DOMContentLoaded", () => {

  const btnStart = document.getElementById("btn_start");
  const btnStop  = document.getElementById("btn_stop");

  if (btnStart) {
    btnStart.addEventListener("click", () => {
      console.log("🔥 UI Button START");
      startHeater();
    });
  }

  if (btnStop) {
    btnStop.addEventListener("click", () => {
      console.log("🧊 UI Button STOP");
      stopHeater();
    });
  }

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
  }).setView([50.8103, 8.7749], 13); // Marburg

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  // Platzhalter-Marker (wird später ersetzt)
  gpsMarker = L.circleMarker([50.8070, 8.7700], {
    radius: 8,
    color: "#f97316",      // orange
    fillColor: "#f97316",
    fillOpacity: 0.9
  }).addTo(map);
});

// marker update
   function updateMapMarker() {
  if (!map || !gpsMarker) return;
  if (gpsLat === null || gpsLon === null) return;

  gpsMarker.setLatLng([gpsLat, gpsLon]);

  // Farbe je nach Fix
  if (gpsFix) {
    gpsMarker.setStyle({
      color: "#16a34a",      // grün
      fillColor: "#16a34a"
    });
  } else {
    gpsMarker.setStyle({
      color: "#f97316",      // orange
      fillColor: "#f97316"
    });
  }
}   















