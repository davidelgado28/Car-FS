const { Cartesian3, Matrix3 } = Cesium;

export class CameraController {
  constructor(viewer, visual, cfg) {
    this.viewer = viewer; this.visual = visual; this.cfg = cfg; 
    this.mode = "chase";
    this._apply(); this.snap();
  }
  
  get label() { 
    if (this.mode === "chase") return "EXTERNA";
    if (this.mode === "cockpit") return "COCKPIT";
    return "LIVRE"; 
  }

  snap() { this.off = null; this.up = null; } 

  toggle() { 
    if (this.mode === "chase") this.mode = "cockpit";
    else if (this.mode === "cockpit") this.mode = "free";
    else this.mode = "chase";
    
    this._apply(); 
    this.snap(); 
  }
  _apply() {
    const cp = this.mode === "cockpit";
    this.viewer.camera.frustum.fov = Cesium.Math.toRadians(cp ? this.cfg.fovCockpit : this.cfg.fovChase);
    this.visual.setHiddenForCockpit(cp && this.cfg.hideModelInCockpit);
  }
  /** @param pos posição ECEF da aeronave  @param rot rotação corpo→ECEF */
  update(dt, pos, rot) {
    if (this.mode === "free") {
      return;
    }

    const cfg = this.cfg;
    const body = (x, y, z) => Matrix3.multiplyByVector(rot, new Cartesian3(x, y, z), new Cartesian3());
    let camPos, dir, up;

    if (this.mode === "cockpit") {
      camPos = Cartesian3.add(pos, body(...cfg.cockpit), new Cartesian3());
      dir = body(1, 0, 0); up = body(0, 0, 1);
    } else {
      const k = 1 - Math.exp(-dt * cfg.chaseSmooth);
      const wantOff = body(-cfg.chaseBack, 0, cfg.chaseUp);
      this.off = this.off ? Cartesian3.lerp(this.off, wantOff, k, this.off) : wantOff;
      camPos = Cartesian3.add(pos, this.off, new Cartesian3());
      const geoUp = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pos, new Cartesian3());
      const wantUp = Cartesian3.lerp(geoUp, body(0, 0, 1), 0.4, new Cartesian3()); 
      this.up = this.up ? Cartesian3.lerp(this.up, wantUp, k, this.up) : wantUp;
      const target = Cartesian3.add(pos, body(cfg.lookAhead, 0, 1), new Cartesian3());
      dir = Cartesian3.normalize(Cartesian3.subtract(target, camPos, new Cartesian3()), new Cartesian3());
      up = this.up;
    }
    const right = Cartesian3.normalize(Cartesian3.cross(dir, up, new Cartesian3()), new Cartesian3());
    const upO = Cartesian3.cross(right, dir, new Cartesian3());
    this.viewer.camera.setView({ destination: camPos, orientation: { direction: dir, up: upO } });
  }
}
