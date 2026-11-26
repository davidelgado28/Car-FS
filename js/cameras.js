const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mixK = (dt, k) => 1 - Math.exp(-k * Math.max(dt, 0));

const lerpC = (to, from, k) =>
  new Cesium.Cartesian3(
    from.x + (to.x - from.x) * k,
    from.y + (to.y - from.y) * k,
    from.z + (to.z - from.z) * k
  );

export class CameraController {
  constructor(viewer, visual, cfg) {
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.camera = viewer.camera;
    this.visual = visual;
    this.cfg = cfg;
    this.scene.screenSpaceCameraController.enableInputs = false;
    this.modes = ["chase", "cockpit", "free", "flyby"];
    this.labels = { chase: "Externa", cockpit: "Cockpit", free: "Livre", flyby: "Fly-by" };
    this.modeIndex = 0;
    this.mode = "chase";
    this.orbit = { yaw: 0, pitch: 0 }; 
    this.look = { yaw: 0, pitch: 0 };  
    this.zoom = 1;                     
    this.cockpitFov = cfg.fovCockpit;
    this.dist = cfg.chaseBack; 
    this.camPos = null;     
    this.tgtPos = null;        
    this.anchor = null;      
    this._snap = true;
    this._dragging = false;
    this._lastAct = -1e9;
    this._pointers = new Map();
    this._pinch = 0;
    this._fov = 0;
    this._bindInput(viewer.canvas);
    this._cockpitVisibility();
  }

  toggle() { this.setMode((this.modeIndex + 1) % this.modes.length); }

  setMode(m) {
    const i = typeof m === "string" ? this.modes.indexOf(m) : m;
    if (i < 0 || i >= this.modes.length || this.modes[i] === this.mode) return;
    this.modeIndex = i;
    this.mode = this.modes[i];
    this.orbit.yaw = 0; this.orbit.pitch = 0;
    this.look.yaw = 0; this.look.pitch = 0;
    this._snap = true;
    this._cockpitVisibility();
  }
  snap() { this._snap = true; }

  get label() { return this.labels[this.mode]; }


  update(dt, position, rot, hdgRad, model) {
    const Cs = Cesium;
    dt = Math.max(dt, 0);
    const now = performance.now() / 1000;
    const r = Math.max(this.visual.radius || 8, 4);

    if (this._snap) {
      this.camPos = null; this.tgtPos = null;
      this.dist = clamp(r * 2.2 * this.zoom, this.cfg.chaseBack, 8000);
      this._snap = false;
    }
    if (!this._dragging && now - this._lastAct > this.cfg.recenterDelay) {
      if (this.mode === "chase") {
        const k = mixK(dt, 2.5);
        this.orbit.yaw -= this.orbit.yaw * k;
        this.orbit.pitch -= this.orbit.pitch * k;
      } else if (this.mode === "cockpit") {
        const k = mixK(dt, 3.0);
        this.look.yaw -= this.look.yaw * k;
        this.look.pitch -= this.look.pitch * k;
      }
    }
    const enu = Cs.Transforms.eastNorthUpToFixedFrame(position);
    const at = (x, y, z) =>
      Cs.Matrix4.multiplyByPoint(enu, new Cs.Cartesian3(x, y, z), new Cs.Cartesian3());

    let dest, dir, up;

    if (this.mode === "cockpit") {
      const off = this.cfg.cockpitAuto ? [r * 0.5, 0, r * 0.12] : this.cfg.cockpit;
      dest = at(off[0], off[1], off[2]);
      const ly = this.look.yaw, lp = clamp(this.look.pitch, -1.35, 1.35);
      const cy = Math.cos(ly), sy = Math.sin(ly), cp = Math.cos(lp), sp = Math.sin(lp);
      dir = Cs.Matrix3.multiplyByVector(rot, new Cs.Cartesian3(cp * cy, -cp * sy, sp), new Cs.Cartesian3());
      up = Cs.Matrix3.multiplyByVector(rot, new Cs.Cartesian3(-sp * cy, sp * sy, cp), new Cs.Cartesian3());
    } else if (this.mode === "flyby") {
      if (!this.anchor || Cs.Cartesian3.distance(position, this.anchor) > 1400 + r * 8) {
        this._newAnchor(position, hdgRad, model, r);
      }
      dest = this.anchor;
      ({ dir, up } = this._look(dest, position, rot));
    } else {
      const yaw = hdgRad + this.orbit.yaw;
      const wide = this.mode === "free";
      const pitch = clamp(this.cfg.chasePitch + this.orbit.pitch, wide ? -1.45 : -1.15, 1.45);
      const target = clamp(r * 2.2 * this.zoom, this.cfg.chaseBack, 8000);
      this.dist += (target - this.dist) * mixK(dt, 5);
      dest = at(
        -Math.sin(yaw) * Math.cos(pitch) * this.dist,
        -Math.cos(yaw) * Math.cos(pitch) * this.dist,
        Math.sin(pitch) * this.dist
      );

      const V = model && model.telemetry ? model.telemetry.V || 0 : 0;
      const lead = wide ? 0 : clamp(V * this.cfg.lookAhead, 0, r * 2);
      const tgt = at(Math.sin(hdgRad) * lead, Math.cos(hdgRad) * lead, r * 0.28);

      this.camPos = this.camPos ? lerpC(dest, this.camPos, mixK(dt, this.cfg.chaseSmooth)) : dest.clone();
      this.tgtPos = this.tgtPos ? lerpC(tgt, this.tgtPos, mixK(dt, this.cfg.chaseSmooth * 1.6)) : tgt.clone();

      dest = this.camPos;
      ({ dir, up } = this._look(dest, this.tgtPos, rot));
    }

    this.camera.setView({ destination: dest, orientation: { direction: dir, up } });
    this._applyFov();
  }

  _look(dest, target, rot) {
    const Cs = Cesium;
    const dir = Cs.Cartesian3.normalize(
      Cs.Cartesian3.subtract(target, dest, new Cs.Cartesian3()), new Cs.Cartesian3());
    const upW = Cs.Ellipsoid.WGS84.geodeticSurfaceNormal(dest, new Cs.Cartesian3());
    let right = Cs.Cartesian3.cross(dir, upW, new Cs.Cartesian3());
    if (Cs.Cartesian3.magnitudeSquared(right) < 1e-8) {
      right = Cs.Matrix3.multiplyByVector(rot, new Cs.Cartesian3(-1, 0, 0), new Cs.Cartesian3());
    }
    Cs.Cartesian3.normalize(right, right);
    const up = Cs.Cartesian3.normalize(
      Cs.Cartesian3.cross(right, dir, new Cs.Cartesian3()), new Cs.Cartesian3());
    return { dir, up };
  }

  _newAnchor(position, hdgRad, model, r) {
    const Cs = Cesium;
    const V = model && model.telemetry ? model.telemetry.V || 0 : 0;
    const enu = Cs.Transforms.eastNorthUpToFixedFrame(position);
    const side = Math.random() < 0.5 ? -1 : 1;
    const ahead = V * 4 + 250 + Math.random() * 150;
    const lat = side * (60 + Math.random() * 120 + r);
    const up = 15 + Math.random() * 40 + r * 0.4;
    this.anchor = Cs.Matrix4.multiplyByPoint(
      enu,
      new Cs.Cartesian3(
        Math.sin(hdgRad) * ahead + Math.cos(hdgRad) * lat,
        Math.cos(hdgRad) * ahead - Math.sin(hdgRad) * lat,
        up
      ),
      new Cs.Cartesian3()
    );
  }

  _applyFov() {
    const f = this.mode === "cockpit" ? this.cockpitFov : this.cfg.fovChase;
    const fr = this.camera.frustum;
    if (f !== this._fov && fr && typeof fr.fov === "number") {
      fr.fov = Cesium.Math.toRadians(f);
      this._fov = f;
    }
  }

  _cockpitVisibility() {
    if (this.visual.setHiddenForCockpit) {
      this.visual.setHiddenForCockpit(this.mode === "cockpit" && this.cfg.hideModelInCockpit);
    }
  }

  _bindInput(canvas) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("pointerdown", (e) => {
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch {} }
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) this._dragging = true;
      if (this._pointers.size === 2) {
        const [a, b] = [...this._pointers.values()];
        this._pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
      this._lastAct = performance.now() / 1000;
    });

    canvas.addEventListener("pointermove", (e) => {
      const pt = this._pointers.get(e.pointerId);
      if (!pt) return;
      const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
      pt.x = e.clientX; pt.y = e.clientY;

      if (this._pointers.size >= 2) { 
        const [a, b] = [...this._pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pinch > 0) this._zoom((this._pinch - d) * 0.004);
        this._pinch = d;
        return;
      }
      if (!this._dragging) return;
      this._lastAct = performance.now() / 1000;

      if (this.mode === "cockpit") {
        this.look.yaw += dx * 0.0042;
        this.look.pitch = clamp(this.look.pitch - dy * 0.0042, -1.3, 1.3);
      } else {
        this.orbit.yaw -= dx * 0.005;
        this.orbit.pitch = clamp(this.orbit.pitch + dy * 0.005, -1.45, 1.45);
      }
    });

    const release = (e) => {
      this._pointers.delete(e.pointerId);
      if (!this._pointers.size) { this._dragging = false; this._pinch = 0; }
      this._lastAct = performance.now() / 1000;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this._zoom(e.deltaY * 0.0011);
    }, { passive: false });

    addEventListener("blur", () => { this._pointers.clear(); this._dragging = false; });
  }
  _zoom(a) {
    this._lastAct = performance.now() / 1000;
    if (this.mode === "cockpit") this.cockpitFov = clamp(this.cockpitFov * Math.exp(a), 28, 100);
    else this.zoom = clamp(this.zoom * Math.exp(a), 0.3, 40);
  }
}
