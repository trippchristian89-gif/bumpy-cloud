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

// GPS
let gpsFix = false;
let gpsLat = null;
let gpsLon = null;
let gpsSats = 0;

// Tracking & Alarm
let trackingActive = false;
let alarmActive    = false;

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

  // Tracking punkte von der Cloud laden
  if (data.type === "track_points") {
    drawTrackPoints(data.points);
  }
};

ws.onclose = () => {
  console.warn("⚠️ WS disconnected");
  setOnline(false);
};

/* =======================
   COMMANDS
======================= */
function startFloor()  { ws.send(JSON.stringify({ type: "command", command: "floor_start" })); }
function stopFloor()   { ws.send(JSON.stringify({ type: "command", command: "floor_stop" })); }
function startHeater() { ws.send(JSON.stringify({ type: "command", command: "heater_start" })); }
function stopHeater()  { ws.send(JSON.stringify({ type: "command", command: "heater_stop" })); }

function startTracking() {
  trackingActive = true;
  ws.send(JSON.stringify({ type: "command", command: "tracking_on" }));
  updateTrackingUI();
  loadTrackPoints();
}

function stopTracking() {
  trackingActive = false;
  ws.send(JSON.stringify({ type: "command", command: "tracking_off" }));
  updateTrackingUI();
}

function enableAlarm() {
  alarmActive = true;
  ws.send(JSON.stringify({ type: "command", command: "alarm_on" }));
  updateAlarmUI();
}

function disableAlarm() {
  alarmActive = false;
  ws.send(JSON.stringify({ type: "command", command: "alarm_off" }));
  updateAlarmUI();
}

function loadTrackPoints() {
  fetch("/api/track")
    .then(r => r.json())
    .then(points => drawTrackPoints(points))
    .catch(e => console.warn("Track load error:", e));
}

/* =======================
   STATUS MAPPING
======================= */
function applyStatus(data) {
  if (!isOnline) return;

  tempBumpy     = data.temp_bumpy;
  ntcBumpyError = data.ntc_bumpy_error;
  floorState    = data.floor.state;
  floorTimerRemaining = data.floor.timer_remaining;
  floorTimerTotal     = data.floor.timer_total;
  heaterState   = data.heater.state;
  heaterInfo    = data.heater.info || "";
  tempAir       = data.heater.temp_air;
  ntcAirError   = data.heater.ntc_air_error;
  gpsFix        = data.gps.fix;
  gpsLat        = data.gps.lat;
  gpsLon        = data.gps.lon;
  gpsSats       = data.gps.sats;

  updateMapMarker();
  updateMapMarker2();
  updateUI();
}

/* =======================
   UI
======================= */
function setOnline(online) {
  const el = document.getElementById("connection_status");
  el.textContent = online ? "online" : "offline";
  el.className = "status " + (online ? "online" : "offline");
}

function updateUI() {
  if (!isOnline) return;
  setText("temp_bumpy", formatTemp(tempBumpy), ntcBumpyError);
  setText("temp_air",   formatTemp(tempAir),   ntcAirError);

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

  document.getElementById("floor_timer").textContent       = formatTime(floorTimerRemaining);
  document.getElementById("floor_timer_total").textContent = formatTime(floorTimerTotal);
}

function updateTrackingUI() {
  const el = document.getElementById("tracking_status");
  el.textContent = trackingActive ? "ON – läuft" : "OFF";
  el.className   = "tracking-status" + (trackingActive ? " active" : "");
}

function updateAlarmUI() {
  const el = document.getElementById("alarm_status");
  el.textContent = alarmActive ? "ON – aktiv" : "OFF";
  el.className   = "alarm-status" + (alarmActive ? " active" : "");
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
  setText("temp_air",   "--.- °C", false);
  document.getElementById("floor_state").textContent  = "--";
  document.getElementById("heater_state").textContent = "--";
  document.getElementById("heater_info").textContent  = "";
  document.getElementById("floor_timer").textContent       = "--:--";
  document.getElementById("floor_timer_total").textContent = "--:--";
}

/* =======================
   BUTTON BINDINGS
======================= */
window.addEventListener("DOMContentLoaded", () => {

  // Page 1
  document.getElementById("btn_floor_start")?.addEventListener("click", startFloor);
  document.getElementById("btn_floor_stop")?.addEventListener("click",  stopFloor);
  document.getElementById("btn_start")?.addEventListener("click", () => { startHeater(); });
  document.getElementById("btn_stop")?.addEventListener("click",  () => { stopHeater(); });

  // Page 2
  document.getElementById("btn_tracking_on")?.addEventListener("click",  startTracking);
  document.getElementById("btn_tracking_off")?.addEventListener("click", stopTracking);
  document.getElementById("btn_alarm_on")?.addEventListener("click",     enableAlarm);
  document.getElementById("btn_alarm_off")?.addEventListener("click",    disableAlarm);

  initMaps();
  initSwipe();
});

/* =======================
   MAP 1 (Page 1 – Live)
======================= */
let map, gpsMarker;

function addLocateControl(mapInstance, getLatFn, getLonFn) {
  const LocateControl = L.Control.extend({
    options: { position: "bottomright" },
    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const btn = L.DomUtil.create("a", "", container);
      btn.title = "Zu meinem Standort";
      btn.href  = "#";
      btn.style.cssText = `
        width: 26px; height: 26px; line-height: 26px;
        display: block; text-align: center;
        font-size: 14px; cursor: pointer;
        text-decoration: none; color: black;
      `;
      btn.innerHTML = "&#8853;";
      L.DomEvent.on(btn, "click", L.DomEvent.preventDefault);
      L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, "click", () => {
        const lat = getLatFn(), lon = getLonFn();
        if (lat !== null && lon !== null) mapInstance.setView([lat, lon], 15, { animate: true });
      });
      return container;
    }
  });
  new LocateControl().addTo(mapInstance);
}

function initMaps() {
  // MAP 1
  map = L.map("map", { zoomControl: true, attributionControl: false }).setView([50.8070, 8.7700], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  gpsMarker = L.circleMarker([50.8070, 8.7700], {
    radius: 8, color: "#f97316", fillColor: "#f97316", fillOpacity: 0.9
  }).addTo(map);
  addLocateControl(map, () => gpsLat, () => gpsLon);

  // MAP 2
  initMap2();
}

function updateMapMarker() {
  if (!map || !gpsMarker || gpsLat === null) return;
  gpsMarker.setLatLng([gpsLat, gpsLon]);
  gpsMarker.setStyle(gpsFix
    ? { color: "#16a34a", fillColor: "#16a34a" }
    : { color: "#f97316", fillColor: "#f97316" }
  );
}

/* =======================
   MAP 2 (Page 2 – Tracking)
======================= */
let map2, trackMarker2, trackPolyline;

function initMap2() {
  map2 = L.map("map2", { zoomControl: true, attributionControl: false }).setView([50.8070, 8.7700], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map2);

  trackMarker2 = L.circleMarker([50.8070, 8.7700], {
    radius: 8, color: "#f97316", fillColor: "#f97316", fillOpacity: 0.9
  }).addTo(map2);

  trackPolyline = L.polyline([], { color: "#2b6cb0", weight: 3, opacity: 0.7 }).addTo(map2);

  addLocateControl(map2, () => gpsLat, () => gpsLon);

  // Track-Punkte beim Start laden
  loadTrackPoints();
}

function updateMapMarker2() {
  if (!map2 || !trackMarker2 || gpsLat === null) return;
  trackMarker2.setLatLng([gpsLat, gpsLon]);
  trackMarker2.setStyle(gpsFix
    ? { color: "#16a34a", fillColor: "#16a34a" }
    : { color: "#f97316", fillColor: "#f97316" }
  );
}

function drawTrackPoints(points) {
  if (!map2 || !trackPolyline) return;
  if (!points || points.length === 0) return;

  const latlngs = points.map(p => [p.lat, p.lon]);
  trackPolyline.setLatLngs(latlngs);

  // Kleine Punkte für jeden gespeicherten GPS-Punkt
  points.forEach(p => {
    L.circleMarker([p.lat, p.lon], {
      radius: 4, color: "#2b6cb0", fillColor: "#2b6cb0", fillOpacity: 0.8
    }).bindTooltip(new Date(p.ts).toLocaleString("de-DE")).addTo(map2);
  });

  // Karte auf Track zoomen
  if (latlngs.length > 1) {
    map2.fitBounds(trackPolyline.getBounds(), { padding: [20, 20] });
  } else {
    map2.setView(latlngs[0], 13);
  }
}

/* =======================
   SWIPE
======================= */
function initSwipe() {
  const wrapper  = document.getElementById("swipeWrapper");
  const dot1     = document.getElementById("dot-1");
  const dot2     = document.getElementById("dot-2");
  let currentPage = 1;
  let startX = 0, startY = 0, isDragging = false;

  function goToPage(n) {
    currentPage = n;
    wrapper.classList.toggle("page-2", n === 2);
    dot1.classList.toggle("active", n === 1);
    dot2.classList.toggle("active", n === 2);

    // Leaflet braucht invalidateSize wenn Container sichtbar wird
    if (n === 2 && map2) setTimeout(() => map2.invalidateSize(), 350);
    if (n === 1 && map)  setTimeout(() => map.invalidateSize(),  350);
  }

  wrapper.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  wrapper.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Nur horizontale Swipes auswerten
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

    if (dx < 0 && currentPage === 1) goToPage(2);
    if (dx > 0 && currentPage === 2) goToPage(1);
  }, { passive: true });
}
