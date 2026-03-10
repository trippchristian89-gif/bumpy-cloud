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

let gpsTrackingEnabled = false;
let gpsAlarmEnabled = false;
let pirAlarmEnabled = false;

let ignoreStatusUntil = 0;
let alarmStartMarker = null;

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
  if (Date.now() < ignoreStatusUntil) return;
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
   if (map2 && gpsLat !== null && gpsLon !== null && !map2._gpsCentered) {
     map2.setView([gpsLat, gpsLon], 15);
     map2._gpsCentered = true;
   }
   
  /* =======================
     ALARM STATE SYNC
  ======================= */

  if (data.alarm) {

    const btnGpsTracking = document.getElementById("btn_gps_tracking");
    const btnGpsAlarm = document.getElementById("btn_gps_alarm");
    const btnPirAlarm = document.getElementById("btn_pir_alarm");

    if (btnGpsTracking) btnGpsTracking.checked = data.alarm.tracking;
    if (btnGpsAlarm) btnGpsAlarm.checked = data.alarm.gps;
    if (btnPirAlarm) btnPirAlarm.checked = data.alarm.pir;

  }
   if (data.alarm && data.alarm.gps && data.alarm.lat && data.alarm.lon) {

     if (!alarmStartMarker) {
        alarmStartMarker = L.marker([data.alarm.lat, data.alarm.lon]).addTo(map2);
        alarmStartMarker.bindPopup("GPS Alarm Startpunkt");
     }
   
     alarmStartMarker.setLatLng([data.alarm.lat, data.alarm.lon]);
   }
   else if (alarmStartMarker) {
     map2.removeLayer(alarmStartMarker);
     alarmStartMarker = null;
   }

   const gpsAlarmBox = document.getElementById("gps_alarm_box");
   
   if (gpsAlarmBox) {
     if (data.alarm && data.alarm.triggered) {
       gpsAlarmBox.classList.add("alarm-active");
     } else {
       gpsAlarmBox.classList.remove("alarm-active");
     }
   }
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

   const switches = {
     btn_gps_tracking: "gps_tracking",
     btn_gps_alarm: "gps_alarm",
     btn_pir_alarm: "pir_alarm"
   };
   
   Object.entries(switches).forEach(([id, cmd]) => {
   
     const el = document.getElementById(id);
     if (!el) return;
   
     el.addEventListener("change", () => {

       ignoreStatusUntil = Date.now() + 1000; // 1 Sekunde ignorieren
   
       ws.send(JSON.stringify({
         type: "command",
         command: `${cmd}_${el.checked ? "on" : "off"}`
       }));
   
     });
   
   });
});

/* =======================
   MAP INIT
======================= */
let map = null;
let gpsMarker = null;

/* =======================
   MAP 2 INIT (Page 2)
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

  // Locate Button map2
  const LocateControl2 = L.Control.extend({
    options: { position: "bottomright" },
    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const btn = L.DomUtil.create("a", "", container);
      btn.title = "Zu meinem Standort";
      btn.href = "javascript:void(0)";
      btn.style.cssText = `
        width: 26px; height: 26px; line-height: 26px;
        display: block; text-align: center;
        font-size: 14px; cursor: pointer;
        text-decoration: none; color: black;
      `;
      btn.innerHTML = `&#8853;`;
      L.DomEvent.on(btn, "click", L.DomEvent.preventDefault);
      L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, "click", () => {
        if (gpsLat !== null && gpsLon !== null)
          map2.setView([gpsLat, gpsLon], 15, { animate: true });
      });
      return container;
    }
  });
  new LocateControl2().addTo(map2);

  // ===== FULLSCREEN BUTTON =====
  const FullscreenControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const btn = L.DomUtil.create("a", "", container);
      btn.title = "Vollbild";
      btn.href = "javascript:void(0)";
      btn.style.cssText = `
        width: 26px; height: 26px; line-height: 26px;
        display: block; text-align: center;
        font-size: 16px; cursor: pointer;
        text-decoration: none; color: black;
      `;
      btn.innerHTML = "&#x26F6;";

      L.DomEvent.on(btn, "click", L.DomEvent.preventDefault);
      L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, "click", () => {
         openFullscreenMap();
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
  let startX = 0, startY = 0;

  function goToPage(n) {
    currentPage = n;
    wrapper.classList.toggle("page-2", n === 2);
    dot1.classList.toggle("active", n === 1);
    dot2.classList.toggle("active", n === 2);
    if (n === 2 && map2) setTimeout(() => map2.invalidateSize(), 350);
  }

  wrapper.addEventListener("touchstart", (e) => {

  if (e.target.closest("#map2")) return;

  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;

}, { passive: true });


  wrapper.addEventListener("touchend", (e) => {   
     
    if (e.target.closest("#map2")) return;
        
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0 && currentPage === 1) goToPage(2);
    if (dx > 0 && currentPage === 2) goToPage(1);
  }, { passive: true });
})();

/* =======================
   FULLSCREEN MAP
======================= */

let mapFullscreen;

function openFullscreenMap(){

  document.getElementById("mapFullscreen").classList.add("active");

  mapFullscreen = L.map("mapFullscreenInner", {
    zoomControl:true,
    attributionControl:false
  }).setView([gpsLat || 50.8070, gpsLon || 8.7700], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom:19
  }).addTo(mapFullscreen);

   // Locate Button (Fullscreen)
const LocateControlFS = L.Control.extend({
  options: { position: "bottomright" },
  onAdd: function () {
    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    const btn = L.DomUtil.create("a", "", container);

    btn.href = "javascript:void(0)";
    btn.innerHTML = "&#8853;";
    btn.style.cssText = `
      width: 26px; height: 26px; line-height: 26px;
      display:block; text-align:center;
      font-size:14px; text-decoration:none; color:black;
    `;

    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.stop(e);
      if (gpsLat !== null && gpsLon !== null)
        mapFullscreen.setView([gpsLat, gpsLon], 15, { animate:true });
    });

    return container;
  }
});
new LocateControlFS().addTo(mapFullscreen);

// Close Button (Fullscreen)
const CloseControl = L.Control.extend({
  options: { position: "topleft" },
  onAdd: function () {

    const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
    const btn = L.DomUtil.create("a", "", container);

    btn.href = "javascript:void(0)";
    btn.innerHTML = "✕";
    btn.style.cssText = `
      width:26px;height:26px;line-height:26px;
      display:block;text-align:center;
      font-size:16px;text-decoration:none;color:black;
    `;

    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.stop(e);
      document.getElementById("mapFullscreen").classList.remove("active");
      if (mapFullscreen) mapFullscreen.remove();
    });

    return container;
  }
});
new CloseControl().addTo(mapFullscreen);

  if (gpsLat && gpsLon){
    L.circleMarker([gpsLat,gpsLon],{
      radius:8,
      color:"#16a34a",
      fillColor:"#16a34a",
      fillOpacity:0.9
    }).addTo(mapFullscreen);
  }
}























