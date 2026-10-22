export class CameraController {
  constructor(viewer, visual, cfg) {
    this.viewer = viewer; 
    this.visual = visual; 
    this.cfg = cfg; 
    this.mode = "chase"; 
    this.smoothHeading = 0;
    this.rangeSet = false;

    this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
    this.viewer.scene.screenSpaceCameraController.enableZoom = true;
    this.viewer.scene.screenSpaceCameraController.enableRotate = true;
    this.viewer.scene.screenSpaceCameraController.enableTilt = true;
    
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
    if (this.mode === "cockpit") {
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
    this._apply(); 
    this.snap(); 
  }

  _apply() {
    const cp = this.mode === "cockpit";
    this.viewer.camera.frustum.fov = Cesium.Math.toRadians(cp ? this.cfg.fovCockpit : this.cfg.fovChase);
    this.visual.setHiddenForCockpit(cp && this.cfg.hideModelInCockpit);
  }

  /**
   * @param dt delta time
   * @param pos posição ECEF
   * @param rot rotação corpo->ECEF
   * @param headingRad rumo do avião em radianos
   */
  update(dt, pos, rot, headingRad = 0) {
    const cfg = this.cfg;
    const body = (x, y, z) => Cesium.Matrix3.multiplyByVector(rot, new Cesium.Cartesian3(x, y, z), new Cesium.Cartesian3());

    if (this.mode === "cockpit") {
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      const camPos = Cesium.Cartesian3.add(pos, body(...cfg.cockpit), new Cesium.Cartesian3());
      const dir = body(1, 0, 0); 
      const up = body(0, 0, 1);  
      this.viewer.camera.setView({ destination: camPos, orientation: { direction: dir, up: up } });
    } else {
      if (!this.rangeSet) {
        this.smoothHeading = headingRad;
        this.rangeSet = true;
      } else {
        let diff = headingRad - this.smoothHeading;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.smoothHeading += diff * Math.min(1.0, (cfg.chaseSmooth || 4.0) * dt);
      }

      const pitchRad = Cesium.Math.toRadians(-12);
      const hpr = new Cesium.HeadingPitchRange(this.smoothHeading, pitchRad, cfg.chaseBack);
      this.viewer.camera.lookAt(pos, hpr);
    }
  }
}
