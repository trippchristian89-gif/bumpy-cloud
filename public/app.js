/* =======================
   STATE
======================= */
let tempBumpy = 0;
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
  ws.send(JSON.stringify({ type: "identify", role: "browser" }));
};

ws.onmessage = (e) => {
  let data;
  try { data = JSON.parse(e.data); } catch { return; }

  if (data.type === "device") {
     isOnline = data.online;
     setOnline(data.online);
     if (!isOnline) resetUI();
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
   STATUS
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

  document.getElementById("temp_bumpy").textContent = formatTemp(tempBumpy);
  document.getElementById("temp_air").textContent   = formatTemp(tempAir);

  document.getElementById("floor_state").textContent  = floorState;
  document.getElementById("heater_state").textContent = heaterState;

  document.getElementById("heater_info").textContent = heaterInfo || "";

  document.getElementById("floor_timer").textContent =
    formatTime(floorTimerRemaining);

  document.getElementById("floor_timer_total").textContent =
    formatTime(floorTimerTotal);
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
  document.getElementById("temp_bumpy").textContent = "--.- °C";
  document.getElementById("temp_air").textContent = "--.- °C";
}

/* =======================
   MAP INIT
======================= */

let map2, gpsMarker2;

window.addEventListener("DOMContentLoaded", () => {

  map2 = L.map("map2", {
    zoomControl: true,
    attributionControl: false
  }).setView([50.8070, 8.7700], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map2);

  gpsMarker2 = L.circleMarker([50.8070, 8.7700], {
    radius: 8,
    color: "#f97316",
    fillColor: "#f97316",
    fillOpacity: 0.9
  }).addTo(map2);

  /* ===== FULLSCREEN BUTTON ===== */

  const FullscreenControl = L.Control.extend({
    options: { position: "topleft" },

    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const btn = L.DomUtil.create("a", "", container);

      btn.innerHTML = "⛶";
      btn.href = "#";
      btn.title = "Fullscreen";

      L.DomEvent.on(btn, "click", L.DomEvent.stop);
      L.DomEvent.on(btn, "click", () => {

        const mapContainer = document.getElementById("map2Container");
        const wrapper = document.getElementById("swipeWrapper");

        // immer Seite 2 aktiv halten
        wrapper.classList.add("page-2");

        const fs = mapContainer.classList.toggle("fullscreen");
        btn.innerHTML = fs ? "✕" : "⛶";

        setTimeout(() => {
          map2.invalidateSize();
        }, 200);

      });

      return container;
    }
  });

  new FullscreenControl().addTo(map2);

});

/* =======================
   MARKER UPDATE
======================= */

function updateMapMarker() {

  if (!map2 || !gpsMarker2) return;
  if (gpsLat === null || gpsLon === null) return;

  const style = gpsFix
    ? { color: "#16a34a", fillColor: "#16a34a" }
    : { color: "#f97316", fillColor: "#f97316" };

  gpsMarker2.setLatLng([gpsLat, gpsLon]);
  gpsMarker2.setStyle(style);
}

/* =======================
   SWIPE
======================= */

(function() {

  const wrapper  = document.getElementById("swipeWrapper");
  const dot1     = document.getElementById("dot-1");
  const dot2     = document.getElementById("dot-2");

  if (!wrapper) return;

  let currentPage = 1;
  let startX = 0;
  let startY = 0;

  function goToPage(n) {

    currentPage = n;

    wrapper.classList.toggle("page-2", n === 2);

    dot1.classList.toggle("active", n === 1);
    dot2.classList.toggle("active", n === 2);

    if (n === 2 && map2)
      setTimeout(() => map2.invalidateSize(), 350);
  }

  wrapper.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  wrapper.addEventListener("touchend", (e) => {

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0 && currentPage === 1) goToPage(2);
    if (dx > 0 && currentPage === 2) goToPage(1);

  }, { passive: true });

})();
