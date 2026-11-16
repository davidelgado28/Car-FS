import { CONFIG } from "./config.js";

export async function createViewer() {
  const hasToken = Boolean(CONFIG.ionToken && !CONFIG.ionToken.startsWith("COLE"));
  if (hasToken) Cesium.Ion.defaultAccessToken = CONFIG.ionToken;

  const opts = {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
  };
  opts.baseLayer = new Cesium.ImageryLayer(
    new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })
  );
  const viewer = new Cesium.Viewer("cesiumContainer", opts);

  let terrainOk = false;
  if (hasToken) {
    try {
      viewer.terrainProvider = await Cesium.createWorldTerrainAsync({ requestWaterMask: true, requestVertexNormals: true });
      terrainOk = true;
    } catch (e) { console.warn("Falha ao carregar World Terrain:", e); }
  }

  const scene = viewer.scene;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.enableLighting = true;
  scene.globe.terrainExaggeration = CONFIG.terrainExaggeration;
  scene.globe.maximumScreenSpaceError = CONFIG.terrainScreenSpaceError;
  scene.fog.enabled = true;
  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(CONFIG.simTimeUtc);
  viewer.clock.shouldAnimate = false;
  
  scene.screenSpaceCameraController.enableInputs = true; 
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  return { viewer, terrainOk, hasToken };
}

export function computePose(model) {
  const position = Cesium.Cartesian3.fromRadians(model.lon, model.lat, model.alt);
  const enu = Cesium.Matrix4.getMatrix3(Cesium.Transforms.eastNorthUpToFixedFrame(position), new Cesium.Matrix3());
  const { F, R, U } = model;
  const body = new Cesium.Matrix3(F[0], -R[0], U[0], F[1], -R[1], U[1], F[2], -R[2], U[2]);
  return { position, rot: Cesium.Matrix3.multiply(enu, body, new Cesium.Matrix3()) };
}

export class AircraftVisual {
  constructor(scene) {
    this.scene = scene; this.model = null; this.parts = []; this.hiddenCockpit = false; this.modelReady = false;
    this.pose = new Cesium.Matrix4(); this.currentUrl = "";
    this.radius = 8; 
    this.orientationOffset = Cesium.Matrix4.IDENTITY;
    this.loadId = 0;
    this._buildFallback();
    this.cockpit = null;
    this._buildCockpit();
  }

  _buildFallback() {
    const C = Cesium;
    const defs = [
      { d: [7.5, 1.1, 1.3], o: [0, 0, 0], c: C.Color.WHITE },
      { d: [1.7, 10.8, 0.18], o: [0.8, 0, 0.4], c: C.Color.CRIMSON },
      { d: [1.0, 3.6, 0.12], o: [-3.6, 0, 0.3], c: C.Color.CRIMSON },
      { d: [1.3, 0.12, 1.6], o: [-3.6, 0, 1.0], c: C.Color.WHITE },
    ];
    for (const p of defs) {
      const prim = new C.Primitive({
        geometryInstances: new C.GeometryInstance({
          geometry: C.BoxGeometry.fromDimensions({ dimensions: new C.Cartesian3(...p.d), vertexFormat: C.PerInstanceColorAppearance.VERTEX_FORMAT }),
          attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(p.c) },
        }),
        appearance: new C.PerInstanceColorAppearance({ translucent: false, closed: true }),
        asynchronous: false,
      });
      this.scene.primitives.add(prim);
      this.parts.push({ prim, offset: C.Matrix4.fromTranslation(new C.Cartesian3(...p.o)) });
    }
  }

  _buildCockpit() {
    const C = Cesium;
    const r = this.radius;
    const dark = C.Color.fromCssColorString("#17242b");
    const trim = C.Color.fromCssColorString("#52636a");
    const screen = C.Color.fromCssColorString("#48a9a0");
    const glass = C.Color.fromCssColorString("#4386a8");
    const shapes = [
      { d: [r * 0.08, r * 0.78, r * 0.28], o: [r * 0.72, 0, -r * 0.1], c: dark },
      { d: [r * 0.18, r * 0.82, r * 0.07], o: [r * 0.62, 0, r * 0.045], c: trim },
      { d: [r * 0.65, r * 0.05, r * 0.1], o: [r * 0.7, -r * 0.38, 0], c: dark },
      { d: [r * 0.65, r * 0.05, r * 0.1], o: [r * 0.7, r * 0.38, 0], c: dark },
      { d: [r * 0.06, r * 0.05, r * 0.7], o: [r * 0.88, -r * 0.37, r * 0.2], c: trim },
      { d: [r * 0.06, r * 0.05, r * 0.7], o: [r * 0.88, r * 0.37, r * 0.2], c: trim },
      { d: [r * 0.025, r * 0.16, r * 0.12], o: [r * 0.675, -r * 0.2, -r * 0.08], c: screen },
      { d: [r * 0.025, r * 0.16, r * 0.12], o: [r * 0.675, r * 0.2, -r * 0.08], c: glass },
      { d: [r * 0.025, r * 0.34, r * 0.035], o: [r * 0.57, 0, -r * 0.12], c: trim },
      { d: [r * 0.1, r * 0.035, r * 0.16], o: [r * 0.52, 0, -r * 0.12], c: trim },
    ];
    const instances = shapes.map(({ d, o, c }) => new C.GeometryInstance({
      geometry: C.BoxGeometry.fromDimensions({
        dimensions: new C.Cartesian3(...d),
        vertexFormat: C.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      modelMatrix: C.Matrix4.fromTranslation(new C.Cartesian3(...o)),
      attributes: { color: C.ColorGeometryInstanceAttribute.fromColor(c) },
    }));

    this.cockpit = this.scene.primitives.add(new C.Primitive({
      geometryInstances: instances,
      appearance: new C.PerInstanceColorAppearance({ translucent: false, closed: true }),
      asynchronous: false,
      show: this.hiddenCockpit,
    }));
  }

  async load(url) {
    const loadId = ++this.loadId;
    this.currentUrl = url;
    this.modelReady = false;
    if (this.model) {
      this.scene.primitives.remove(this.model);
      this.model = null;
    }
    this._showFallback(true);

    const offsetCfg = CONFIG.modelOffsets[url] || { yaw: 0, pitch: 0, roll: 0 };
    const h = Cesium.Math.toRadians(offsetCfg.yaw || 0);
    const p = Cesium.Math.toRadians(offsetCfg.pitch || 0);
    const r = Cesium.Math.toRadians(offsetCfg.roll || 0);
    const hpr = new Cesium.HeadingPitchRoll(h, p, r);
    this.orientationOffset = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromHeadingPitchRoll(hpr));
    this.radius = offsetCfg.radius || 10;
    if (this.cockpit) this.scene.primitives.remove(this.cockpit);
    this._buildCockpit();

    try {
      const scale = offsetCfg.scale ?? CONFIG.modelScale;
      const model = await Cesium.Model.fromGltfAsync({ url, scale });
      if (loadId !== this.loadId) return false;
      this.scene.primitives.add(model);
      model.errorEvent.addEventListener((e) => { console.warn("Erro no modelo:", e); this._showFallback(true); });
      model.readyEvent.addEventListener(() => { this.modelReady = true; this._showFallback(false); });
      this.model = model;
      console.info("Modelo 3D carregado de", url);
      return true;
    } catch (e) {
      if (loadId !== this.loadId) return false;
      console.warn("Modelo indisponível:", url, e); 
      this._showFallback(true);
      return false; 
    }
  }
  _showFallback(on) { this.parts.forEach((p) => (p.prim.show = on && !this.hiddenCockpit)); if (this.model) this.model.show = !on && !this.hiddenCockpit; }
  setHiddenForCockpit(h) {
    this.hiddenCockpit = h;
    this._showFallback(!this.modelReady);
    if (this.cockpit) this.cockpit.show = h;
  }

  setPose(position, rot) {
    Cesium.Matrix4.fromRotationTranslation(rot, position, this.pose);
    if (this.model) {
      Cesium.Matrix4.multiply(this.pose, this.orientationOffset || Cesium.Matrix4.IDENTITY, this.model.modelMatrix);
    }
    for (const p of this.parts) {
      Cesium.Matrix4.multiply(this.pose, p.offset, p.prim.modelMatrix);
    }
    if (this.cockpit) Cesium.Matrix4.clone(this.pose, this.cockpit.modelMatrix);
  }
}
