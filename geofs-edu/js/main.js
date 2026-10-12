import { CONFIG, AIRCRAFT } from "./config.js";
import { clamp } from "./math.js";
import { createViewer, AircraftVisual, computePose } from "./cesiumSetup.js";
import { FlightModel } from "./flightModel.js";
import { InputManager } from "./input.js";
import { CameraController } from "./cameras.js";
import { HUD } from "./hud.js";

(async function boot() {
  const { viewer, terrainOk, hasToken } = await createViewer();
  const banner = document.getElementById("banner");
  if (!hasToken) { banner.style.display = "block"; banner.textContent = "Sem token do Cesium ion: usando mapa OpenStreetMap e terreno plano (edite js/config.js)."; }
  else if (!terrainOk) { banner.style.display = "block"; banner.textContent = "Não foi possível carregar o World Terrain (verifique o token)."; }

  const visual = new AircraftVisual(viewer.scene);
  visual.load(CONFIG.modelUrls); 

  const model = new FlightModel(AIRCRAFT);
  model.reset(CONFIG.start);
  const cams = new CameraController(viewer, visual, CONFIG.camera);
  const hud = new HUD();
  const ui = { paused: false };

  const input = new InputManager({
    camera: () => cams.toggle(),
    reset: () => { model.reset(CONFIG.start); cams.snap(); },
    pause: () => (ui.paused = !ui.paused),
    flapsDown: () => (model.flaps = clamp(model.flaps + 1, 0, AIRCRAFT.flaps.length - 1)),
    flapsUp: () => (model.flaps = clamp(model.flaps - 1, 0, AIRCRAFT.flaps.length - 1)),
    trimUp: () => (model.trim = clamp(model.trim + 0.02, -0.5, 0.5)),
    trimDown: () => (model.trim = clamp(model.trim - 0.02, -0.5, 0.5)),
    edu: () => hud.toggleEdu(), help: () => hud.toggleHelp(),
  }, CONFIG.invertPitchKeys);

  const globe = viewer.scene.globe;
  const carto = new Cesium.Cartographic(), cartoAhead = new Cesium.Cartographic();
  let groundH = CONFIG.start.alt - 3000, slope = 0;
  function sampleGround() {
    carto.longitude = model.lon; carto.latitude = model.lat;
    const h = globe.getHeight(carto); 
    if (h !== undefined) {
      groundH = h;
      const d = 40, psi = model.telemetry.heading ? (model.telemetry.heading * Math.PI) / 180 : 0;
      cartoAhead.latitude = model.lat + (d * Math.cos(psi)) / 6371000;
      cartoAhead.longitude = model.lon + (d * Math.sin(psi)) / (6371000 * Math.cos(model.lat));
      const h2 = globe.getHeight(cartoAhead);
      slope = h2 !== undefined ? clamp((h2 - h) / d, -1, 1) : 0;
    }
  }

  const rm = globe.tileLoadProgressEvent.addEventListener((n) => {
    if (n === 0) { document.getElementById("loading").classList.add("done"); rm(); }
  });
  setTimeout(() => document.getElementById("loading").classList.add("done"), 8000);

  let last = performance.now();
  viewer.scene.preRender.addEventListener(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    const ctrl = input.update(dt);

    if (!ui.paused) {
      model.throttle = clamp(model.throttle + ctrl.throttleAxis * 0.35 * dt, 0, 1);
      sampleGround();
      for (let rem = dt; rem > 1e-6; ) { const h = Math.min(rem, 1 / 120); model.step(h, ctrl, groundH, slope); rem -= h; }
    }
    const { position, rot } = computePose(model);
    visual.setPose(position, rot);
    cams.update(ui.paused ? 0 : dt, position, rot);
    hud.update(model.telemetry, model, ui);
  });
})();