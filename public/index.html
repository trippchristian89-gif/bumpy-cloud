<!DOCTYPE html>
<html>

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BUMPY</title>

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <link rel="stylesheet" href="/style.css">
  <link rel="icon" href="/icon-192.png">
  <link rel="apple-touch-icon" href="/icon-192.png">

  <meta name="apple-mobile-web-app-title" content="BUMPY">
  <meta name="application-name" content="BUMPY">

  <style>

    /* ===== SWIPE WRAPPER ===== */
    .swipe-wrapper {
      display: flex;
      width: 200vw;
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }

    .swipe-wrapper.page-2 {
      transform: translateX(-50%);
    }

    .page {
      width: 100vw;
      min-height: 100vh;
      flex-shrink: 0;
      overflow-y: auto;
    }

    /* ===== PAGE INDICATOR ===== */
    .page-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 8px 0 4px;
    }

    .page-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ccc;
      display: block;
      transition: background 0.2s;
    }

    .page-dots span.active {
      background: #888;
    }

    /* ===== PAGE 1 ===== */
    .panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .hero-image {
      margin-top: 6px;
      margin-bottom: 8px;
    }

    .hero-image img {
      width: 100%;
      border-radius: 12px;
      display: block;
    }

    .hero-image-2 {
      margin-top: 6px;
      margin-bottom: 8px;
    }

    .hero-image-2 img {
      width: 100%;
      border-radius: 12px;
      display: block;
    }

    /* ===== PAGE 2 ===== */
    .panel2 {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      max-width: 360px;
      margin: 0 auto;
    }

    .panel2 .box-header {
      font-size: 0.8em;
      font-weight: 700;
      color: #888;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    /* Tracking ON/OFF Button */
    #btn_tracking_on  { background: #b7d8c0; }
    #btn_tracking_off { background: #e3b5b5; }
    #btn_alarm_on     { background: #b7d8c0; }
    #btn_alarm_off    { background: #e3b5b5; }

    .tracking-status,
    .alarm-status {
      font-size: 0.85em;
      color: #555;
      margin-top: 4px;
    }

    .tracking-status.active { color: #2f855a; font-weight: 600; }
    .alarm-status.active    { color: #c53030; font-weight: 600; }

    /* Leaflet SVG fix */
    .leaflet-control a,
    .leaflet-control button {
      overflow: visible !important;
    }
  </style>
</head>

<body>

  <!-- PAGE DOTS -->
  <div class="page-dots">
    <span class="active" id="dot-1"></span>
    <span id="dot-2"></span>
  </div>

  <div class="swipe-wrapper" id="swipeWrapper">

    <!-- ===== PAGE 1 ===== -->
    <div class="page" id="page1">
      <div class="panel">

        <div class="hero-image">
          <img src="/camper.png" alt="Bumpy Camper">
        </div>

        <div class="box footer">
          <div class="row footer-row">
            <span class="bumpy-text">BUMPY status</span>
            <span id="connection_status" class="status offline">offline</span>
          </div>
        </div>

        <div class="box">
          <div class="row">
            <span>Temp Camper:</span>
            <span id="temp_bumpy" class="temp">--.- °C</span>
          </div>
        </div>

        <div class="box">
          <div class="row">
            <span>Floor Heating:</span>
            <span id="floor_state">OFF</span>
          </div>
          <div class="row small">
            <span id="floor_timer">--:--</span>
            <span>(<span id="floor_timer_total">--:--</span>)</span>
          </div>
        </div>

        <div class="controls">
          <button id="btn_floor_start">Start</button>
          <button id="btn_floor_stop">Stop</button>
        </div>

        <div class="box">
          <div class="row">
            <span>Air Heater:</span>
            <span id="heater_state">OFF</span>
          </div>
          <div class="row">
            <span>Temp Air:</span>
            <span id="temp_air" class="temp">--.- °C</span>
          </div>
          <hr />
          <div class="info" id="heater_info"></div>
        </div>

        <div class="controls">
          <button id="btn_start">Start</button>
          <button id="btn_stop">Stop</button>
        </div>

        <div class="hero-image-2">
          <img src="/camper2.png" alt="Bumpy Camper 2">
        </div>

        <div class="box">
          <div id="map" style="height: 280px; border-radius: 12px;"></div>
        </div>

      </div>
    </div>

    <!-- ===== PAGE 2 ===== -->
    <div class="page" id="page2">
      <div class="panel2">

        <div class="box">
          <div class="box-header">Tracking Map</div>
          <div id="map2" style="height: 320px; border-radius: 8px;"></div>
        </div>

        <div class="box">
          <div class="box-header">GPS Tracking</div>
          <div class="row">
            <span>Status:</span>
            <span id="tracking_status" class="tracking-status">OFF</span>
          </div>
          <div class="controls" style="margin-top: 8px; margin-bottom: 0;">
            <button id="btn_tracking_on">Start</button>
            <button id="btn_tracking_off">Stop</button>
          </div>
        </div>

        <div class="box">
          <div class="box-header">Alarm – Fahrzeugbewegung</div>
          <div class="row">
            <span>Status:</span>
            <span id="alarm_status" class="alarm-status">OFF</span>
          </div>
          <div class="controls" style="margin-top: 8px; margin-bottom: 0;">
            <button id="btn_alarm_on">ON</button>
            <button id="btn_alarm_off">OFF</button>
          </div>
        </div>

      </div>
    </div>

  </div><!-- end swipe-wrapper -->

  <script src="/app.js"></script>
</body>
</html>
