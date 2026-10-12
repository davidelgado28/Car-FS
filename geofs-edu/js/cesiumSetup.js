import { CONFIG } from "./config.js";

export async function createViewer() {
  const hasToken = !CONFIG.ionToken.startsWith("COLE");
  Cesium.Ion.defaultAccessToken = CONFIG.ionToken;

  const opts = {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
  };
  if (!hasToken) opts.baseLayer = new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
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
  scene.fog.enabled = true;
  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(CONFIG.simTimeUtc);
  viewer.clock.shouldAnimate = false;
  scene.screenSpaceCameraController.enableInputs = false; 
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
    this.pose = new Cesium.Matrix4(); this.tmp = new Cesium.Matrix4();
    this.yawOffset = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(CONFIG.modelYawOffsetDeg)));
    this._buildFallback();
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

  async load(urls) {
    for (const url of urls) {
      try {
        const model = await Cesium.Model.fromGltfAsync({ url, scale: CONFIG.modelScale });
        this.scene.primitives.add(model);
        model.errorEvent.addEventListener((e) => { console.warn("Erro no modelo:", e); this._showFallback(true); });
        model.readyEvent.addEventListener(() => { this.modelReady = true; this._showFallback(false); });
        this.model = model;
        console.info("Modelo 3D carregado de", url);
        return true;
      } catch (e) { console.warn("Modelo indisponível:", url, e); }
    }
    console.warn("Nenhum GLB carregou: usando aeronave de fallback.");
    return false;
  }

  _showFallback(on) { this.parts.forEach((p) => (p.prim.show = on && !this.hiddenCockpit)); if (this.model) this.model.show = !on && !this.hiddenCockpit; }
  setHiddenForCockpit(h) { this.hiddenCockpit = h; this._showFallback(!this.modelReady); }

  setPose(position, rot) {
    Cesium.Matrix4.fromRotationTranslation(rot, position, this.pose);
    if (this.model) Cesium.Matrix4.multiply(this.pose, this.yawOffset, this.model.modelMatrix);
    for (const p of this.parts) Cesium.Matrix4.multiply(this.pose, p.offset, p.prim.modelMatrix);
  }
}