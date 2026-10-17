const { Cartesian3, HeadingPitchRange, Transforms, Math: CesiumMath } = Cesium;

export class CameraController {
  constructor(viewer, visual, cfg) {
    this.viewer = viewer; 
    this.visual = visual; 
    this.cfg = cfg; 
    this.mode = "chase"; 
    this.viewer.screenSpaceCameraController.enableTranslate = true;
    this.viewer.screenSpaceCameraController.enableZoom = true;
    this.viewer.screenSpaceCameraController.enableRotate = true;
    this.viewer.screenSpaceCameraController.enableTilt = true;
    
    this._apply(); 
  }
  get label() { 
    return this.mode === "chase" ? "EXTERNA (FOLLOW)" : "COCKPIT"; 
  }
  snap() { 
    this.rangeSet = false;
  } 
  toggle() { 
    this.mode = this.mode === "chase" ? "cockpit" : "chase"; 
    this._apply(); 
    this.snap(); 
  }

  _apply() {
    const cp = this.mode === "cockpit";
    this.viewer.camera.frustum.fov = CesiumMath.toRadians(cp ? this.cfg.fovCockpit : this.cfg.fovChase);
    this.visual.setHiddenForCockpit(cp && this.cfg.hideModelInCockpit);
  }
  /** @param pos posição ECEF da aeronave  @param rot rotação corpo→ECEF */
  update(dt, pos, rot) {
    const cfg = this.cfg;
    const body = (x, y, z) => Cesium.Matrix3.multiplyByVector(rot, new Cartesian3(x, y, z), new Cartesian3());

    if (this.mode === "cockpit") {
      const camPos = Cartesian3.add(pos, body(...cfg.cockpit), new Cartesian3());
      const dir = body(1, 0, 0); 
      const up = body(0, 0, 1);
      const right = Cartesian3.normalize(Cartesian3.cross(dir, up, new Cartesian3()), new Cartesian3());
      const upO = Cartesian3.cross(right, dir, new Cartesian3());
      this.viewer.camera.setView({ destination: camPos, orientation: { direction: dir, up: upO } });
    } else {
      if (!this.rangeSet || !this.trackingInitialized) {
        const center = pos;
        const hpr = new HeadingPitchRange(CesiumMath.toRadians(0), CesiumMath.toRadians(-20), cfg.chaseBack);
        this.viewer.camera.lookAt(center, hpr);
        this.trackingInitialized = true;
        this.rangeSet = true;
      } else {
        const currentTarget = this.viewer.camera.position;
        const trackingTransform = Transforms.eastNorthUpToFixedFrame(pos);
        this.viewer.camera.lookAtTransform(trackingTransform);
      }
    }
  }
}
