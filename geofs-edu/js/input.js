import { clamp } from "./math.js";

export class InputManager {
  constructor(handlers, invertPitch = true) {
    this.h = handlers; this.invert = invertPitch;
    this.keys = new Set();
    this.v = { pitch: 0, roll: 0, yaw: 0 };
    const block = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
    addEventListener("keydown", (e) => {
      if (block.includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      const map = { KeyC: "camera", KeyR: "reset", KeyP: "pause", KeyF: "flapsDown", KeyV: "flapsUp",
        KeyT: "trimUp", KeyG: "trimDown", KeyI: "edu", KeyH: "help" };
      const fn = map[e.code]; if (fn && this.h[fn]) this.h[fn]();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());
  }

  _axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); }
  _ramp(cur, target, dt, up) {
    const rate = target === 0 ? 4 : up;
    return cur + clamp(target - cur, -rate * dt, rate * dt);
  }

  update(dt) {
    const pitchT = this._axis("ArrowUp", "ArrowDown") * (this.invert ? 1 : -1); // +1 = nariz sobe
    this.v.pitch = this._ramp(this.v.pitch, pitchT, dt, 1.2);
    this.v.roll = this._ramp(this.v.roll, this._axis("ArrowLeft", "ArrowRight"), dt, 2.5);
    this.v.yaw = this._ramp(this.v.yaw, this._axis("KeyQ", "KeyE"), dt, 2.5);
    return { ...this.v, brake: this.keys.has("KeyB") || this.keys.has("Space"), throttleAxis: this._axis("KeyS", "KeyW") };
  }
}