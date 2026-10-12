import { D2R, R2D, clamp, lerp, smoothstep, v3 } from "./math.js";
import { G0, RHO0, isaDensity } from "./atmosphere.js";

const R_EARTH = 6371000;

export class FlightModel {
  constructor(ac) {
    this.ac = ac;
    this.telemetry = {};
    this.reset({ lat: 0, lon: 0, alt: 1000, headingDeg: 0, speed: 50 });
  }

  reset(s) {
    this.lat = s.lat * D2R; this.lon = s.lon * D2R; this.alt = s.alt; 
    this.setAttitude(s.headingDeg * D2R, 1 * D2R, 0);
    this.vel = v3.scale(this.F, s.speed);
    this.rates = { p: 0, q: 0, r: 0 }; 
    this.throttle = 0.6; this.flaps = 0; this.trim = 0;
    this.onGround = false; this.crashed = false; this.crashReason = "";
  }

  setAttitude(psi, theta, phi) {
    const sp = Math.sin(psi), cp = Math.cos(psi), st = Math.sin(theta), ct = Math.cos(theta);
    const sf = Math.sin(phi), cf = Math.cos(phi);
    const R0 = [cp, -sp, 0];
    const U0 = [-sp * st, -cp * st, ct];
    this.F = [sp * ct, cp * ct, st];
    this.R = [R0[0] * cf - U0[0] * sf, R0[1] * cf - U0[1] * sf, R0[2] * cf - U0[2] * sf];
    this.U = [U0[0] * cf + R0[0] * sf, U0[1] * cf + R0[1] * sf, U0[2] * cf + R0[2] * sf];
  }

  euler() {
    const { F, R, U } = this;
    return { pitch: Math.asin(clamp(F[2], -1, 1)), yaw: Math.atan2(F[0], F[1]), roll: Math.atan2(-R[2], U[2]) };
  }

  _orthonormalize() {
    this.F = v3.norm(this.F);
    this.R = v3.norm(v3.sub(this.R, v3.scale(this.F, v3.dot(this.R, this.F))));
    this.U = v3.cross(this.R, this.F);
  }

  _aero(alpha) {
    const ac = this.ac, fl = ac.flaps[this.flaps];
    const aClamped = clamp(alpha, ac.alphaStallNeg, ac.alphaStall);
    const CLlin = ac.CL0 + fl.dCL + ac.CLalpha * aClamped;
    const over = alpha > ac.alphaStall ? alpha - ac.alphaStall : alpha < ac.alphaStallNeg ? ac.alphaStallNeg - alpha : 0;
    const sf = smoothstep(clamp(over / ac.stallWidth, 0, 1));
    const CLpost = 0.9 * Math.sin(2 * alpha); 
    const CL = lerp(CLlin, CLpost, sf);
    const CD = ac.CD0 + fl.dCD + ac.k * CL * CL + 1.2 * Math.sin(alpha) ** 2 * sf;
    return { CL, CD, over };
  }

  /**
   * Avança a simulação dt segundos.
   * @param c  controles {pitch, roll, yaw, brake}  (−1..1)
   * @param groundH  altura elipsoidal do terreno sob a aeronave (m)
   * @param slope    inclinação do terreno à frente (m/m, + = subindo)
   */
  step(dt, c, groundH, slope = 0) {
    const ac = this.ac, m = ac.mass, W = m * G0, S = ac.wingArea;
    const floor = groundH + ac.gearHeight;

    if (this.crashed) { 
      this.vel = [0, 0, 0]; this.rates = { p: 0, q: 0, r: 0 }; this.alt = Math.max(this.alt, floor);
      Object.assign(this.telemetry, { V: 0, ias: 0, vs: 0, L: 0, D: 0, T: 0, stalled: false, stallWarn: false, crashed: true, onGround: true,
        agl: 0, ...this._angles() });
      return;
    }

    const rho = isaDensity(this.alt), sigma = rho / RHO0;

    const { F, R, U } = this;
    const V = v3.len(this.vel);
    const vhat = V > 0.5 ? v3.scale(this.vel, 1 / V) : F;
    const vF = v3.dot(this.vel, F), vU = v3.dot(this.vel, U), vR = v3.dot(this.vel, R);
    const fwd = Math.max(vF, 1);
    const alpha = V > 1 ? Math.atan2(-vU, fwd) : 0;
    const beta = V > 1 ? Math.atan2(vR, fwd) : 0;
    const qbar = 0.5 * rho * V * V; 

    const { CL, CD, over } = this._aero(alpha);
    const Lmag = CL * qbar * S;
    const Dmag = CD * qbar * S;
    const Ldir = v3.norm(v3.sub(U, v3.scale(vhat, v3.dot(U, vhat))));
    const Lvec = v3.scale(Ldir, Lmag);
    const Dvec = v3.scale(vhat, -Dmag);
    const Tmag = this.throttle * Math.min(ac.staticThrust, ac.propPower / Math.max(V, 1)) * sigma;
    const Tvec = v3.scale(F, Tmag);
    const Wvec = [0, 0, -W];
    const Yvec = v3.scale(R, -ac.CYbeta * beta * qbar * S); 

    let Fsum = v3.add(v3.add(Lvec, Dvec), v3.add(Tvec, v3.add(Wvec, Yvec)));
    this.vel = v3.add(this.vel, v3.scale(Fsum, dt / m)); 

    const auth = clamp(qbar / ac.qRef, 0, 1.4);
    const elev = clamp(c.pitch + this.trim, -1, 1);
    const r = this.rates;
    r.q += (ac.Kelev * elev * auth - ac.Kqd * r.q - ac.Kalpha * (alpha - ac.alphaTrim) * auth) * dt;
    r.p += (ac.Kail * c.roll * Math.min(auth, 1.2) - ac.Kpd * r.p) * dt;
    r.r += (ac.Krud * c.yaw * auth - ac.Krd * r.r + ac.Kbeta * beta * auth) * dt;

    const dF = v3.add(v3.scale(U, r.q), v3.scale(R, r.r));
    const dR = v3.add(v3.scale(U, -r.p), v3.scale(F, -r.r));
    const dU = v3.add(v3.scale(R, r.p), v3.scale(F, -r.q));
    this.F = v3.add(F, v3.scale(dF, dt));
    this.R = v3.add(R, v3.scale(dR, dt));
    this.U = v3.add(U, v3.scale(dU, dt));
    this._orthonormalize();

    this.lat = clamp(this.lat + (this.vel[1] / (R_EARTH + this.alt)) * dt, -1.5, 1.5);
    this.lon += (this.vel[0] / ((R_EARTH + this.alt) * Math.cos(this.lat))) * dt;
    this.alt += this.vel[2] * dt;

    let onGround = false;
    if (this.alt <= floor) {
      const e = this.euler();
      if (!this.onGround) { 
        const vh = Math.hypot(this.vel[0], this.vel[1]);
        const closing = -this.vel[2] + vh * slope; 
        let why = "";
        if (closing > ac.crashSink) why = "impacto com o terreno";
        else if (Math.abs(e.roll) > ac.crashRoll) why = "a asa tocou o solo";
        else if (e.pitch < -ac.crashNose) why = "o nariz tocou o solo primeiro";
        else if (e.pitch > ac.crashTail) why = "a cauda tocou o solo";
        if (why) { this.crashed = true; this.crashReason = why; }
      }
      if (!this.crashed) {
        onGround = true;
        this.alt = floor;
        if (this.vel[2] < 0) this.vel[2] = 0; 
        let psi = e.yaw, th = clamp(e.pitch, 0, ac.maxGroundPitch);
        const liftFrac = clamp(Lmag / W, 0, 1);
        if (liftFrac < 0.6) th *= Math.exp(-2 * dt * (1 - liftFrac / 0.6));
        if (th <= 0 && r.q < 0) r.q = 0;
        const vh = Math.hypot(this.vel[0], this.vel[1]);
        psi += (c.yaw * ac.steerRate) * clamp(vh / 8, 0, 1) * dt; 
        this.setAttitude(psi, th, 0);
        r.p = 0; r.r = 0;
        const h = [Math.sin(psi), Math.cos(psi)];
        let vf = this.vel[0] * h[0] + this.vel[1] * h[1];
        const N = clamp(1 - Lmag / W, 0, 1);
        const decel = (ac.rollFriction + (c.brake ? ac.brakeFriction : 0)) * G0 * N;
        vf = Math.sign(vf) * Math.max(0, Math.abs(vf) - decel * dt);
        this.vel[0] = h[0] * vf; this.vel[1] = h[1] * vf;
      } else {
        this.alt = floor;
      }
    }
    this.onGround = onGround || this.crashed;

    const fl = ac.flaps[this.flaps];
    const CLmaxCfg = ac.CL0 + fl.dCL + ac.CLalpha * ac.alphaStall;
    this.telemetry = {
      V, ias: V * Math.sqrt(sigma), rho, sigma, qbar, alpha, beta, CL, CD,
      L: Lmag, D: Dmag, T: Tmag, W, nz: Lmag / W,
      stalled: over > 0, stallWarn: alpha > ac.alphaStall - 2 * D2R && V > 5,
      stallIas: Math.sqrt((2 * W) / (RHO0 * S * CLmaxCfg)),
      vs: this.vel[2], agl: this.alt - ac.gearHeight - groundH,
      onGround: this.onGround, crashed: this.crashed, crashReason: this.crashReason,
      vecs: { lift: Lvec, drag: Dvec, thrust: Tvec, weight: Wvec, vel: this.vel },
      ...this._angles(),
    };
  }
  _angles() {
    const e = this.euler();
    return { heading: (e.yaw * R2D + 360) % 360, pitch: e.pitch, roll: e.roll };
  }
}