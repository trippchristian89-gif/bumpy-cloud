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
    setOnline(data.online);
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
  ws.send(JSON.stringify({
    type: "command",
    command: "heater_start"
  }));
}

function stopHeater() {
  ws.send(JSON.stringify({
    type: "command",
    command: "heater_stop"
  }));
}

/* =======================
   STATUS MAPPING
======================= */
function applyStatus(data) {
  tempBumpy = data.temp_bumpy;
  ntcBumpyError = data.ntc_bumpy_error;

  floorState = data.floor.state;
  tempFloor = data.floor.temp_current;
  floorTimerRemaining = data.floor.timer_remaining;   
  floorTimerTotal = data.floor.TimerTotal;
  ntcFloorError = data.floor.ntc_error;

  heaterState = data.heater.state;
  heaterInfo = data.heater.info || "";
  tempAir = data.heater.temp_air;
  ntcAirError = data.heater.ntc_air_error;

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

