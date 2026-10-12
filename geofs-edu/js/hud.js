import { R2D, M_TO_FT, MS_TO_KT, MS_TO_FPM, v3 } from "./math.js";

const $ = (id) => document.getElementById(id);
const CARD = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

export class HUD {
  constructor() {
    this.cache = {}; this.eduOpen = true;
    this.ctx = $("force-canvas").getContext("2d");
    $("edu-toggle").onclick = () => this.toggleEdu();
    const rose = $("rose");
    CARD.forEach((c, i) => { if (i % 2 === 0) rose.insertAdjacentHTML("beforeend", `<span style="transform:rotate(${i * 45}deg)"><i>${c}</i></span>`); });
  }
  toggleEdu() { this.eduOpen = !this.eduOpen; $("edu").classList.toggle("collapsed", !this.eduOpen); }
  toggleHelp() { $("help").classList.toggle("hidden"); }
  _set(id, v) { v = String(v); if (this.cache[id] !== v) { this.cache[id] = v; $(id).textContent = v; } }

  update(t, m, ui) {
    this._set("ias", Math.round(t.ias * MS_TO_KT));
    this._set("tas", Math.round(t.V * MS_TO_KT));
    this._set("alt-ft", Math.round(m.alt * M_TO_FT));
    this._set("alt-m", Math.round(m.alt));
    this._set("agl", Math.max(0, Math.round(t.agl * M_TO_FT)));
    this._set("vs", Math.round((t.vs * MS_TO_FPM) / 10) * 10);
    const hdg = Math.round(t.heading) % 360;
    this._set("hdg", String(hdg).padStart(3, "0") + "° " + CARD[Math.round(t.heading / 45) % 8]);
    this._set("thr", Math.round(m.throttle * 100) + "%");
    $("thr-bar").style.width = m.throttle * 100 + "%";
    this._set("flaps", m.ac.flaps[m.flaps].label);
    this._set("trim", (m.trim >= 0 ? "+" : "") + (m.trim * 100).toFixed(0));
    $("rose").style.transform = `rotate(${-t.heading}deg)`;
    $("ai-horizon").style.transform = `rotate(${-t.roll * R2D}deg) translateY(${t.pitch * R2D * 2.2}px)`;

    const w = $("warn");
    let msg = "", cls = "info";
    if (t.crashed) msg = `ACIDENTE — ${t.crashReason}\nPressione R para reiniciar`;
    else if (ui.paused) msg = "PAUSADO";
    else if (t.stalled || t.stallWarn) { msg = t.stalled ? "STALL!" : "ALERTA DE STALL"; cls = "stall"; }
    if (w.textContent !== msg) { w.textContent = msg; w.style.whiteSpace = "pre"; }
    w.className = cls;

    if (this.eduOpen) this._edu(t, m);
  }

  _edu(t, m) {
    const kn = (n) => (n / 1000).toFixed(2) + " kN";
    this._set("e-L", kn(t.L)); this._set("e-W", kn(t.W)); this._set("e-T", kn(t.T)); this._set("e-D", kn(t.D));
    this._set("e-n", t.nz.toFixed(2) + " g");
    this._set("e-a", (t.alpha * R2D).toFixed(1) + "°");
    this._set("e-c", t.CL.toFixed(2) + " / " + t.CD.toFixed(3));
    this._set("e-rho", t.rho.toFixed(3) + " kg/m³");
    this._set("e-q", Math.round(t.qbar) + " Pa");
    this._set("e-vs", Math.round(t.stallIas * MS_TO_KT) + " kt");

    const ctx = this.ctx, w = 300, h = 230, cx = w / 2, cy = h / 2 - 5;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(0, cy + 70, w, h - cy - 70); 
    const hv = [Math.sin(t.heading / R2D), Math.cos(t.heading / R2D), 0];
    const proj = (v) => [v3.dot(v, hv), v[2]];
    const s = 55 / t.W; 
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t.pitch);
    ctx.fillStyle = "#e8eef5"; ctx.beginPath(); ctx.ellipse(0, 0, 34, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#c33"; ctx.fillRect(-5, -2, 14, 3); ctx.fillRect(-32, -14, 4, 12);
    ctx.restore();
    const arrow = (v, col, label) => {
      const [x, y] = proj(v); let dx = x * s, dy = -y * s;
      const len = Math.hypot(dx, dy); if (len < 3) return;
      if (len > 105) { dx *= 105 / len; dy *= 105 / len; }
      ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
      const a = Math.atan2(dy, dx);
      ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy);
      ctx.lineTo(cx + dx - 9 * Math.cos(a - 0.4), cy + dy - 9 * Math.sin(a - 0.4));
      ctx.lineTo(cx + dx - 9 * Math.cos(a + 0.4), cy + dy - 9 * Math.sin(a + 0.4)); ctx.fill();
      ctx.font = "11px monospace"; ctx.fillText(label, cx + dx + 5, cy + dy + (dy < 0 ? -3 : 11));
    };
    arrow(t.vecs.weight, "#ff5c5c", "W"); arrow(t.vecs.lift, "#4da3ff", "L");
    arrow(t.vecs.thrust, "#5cff8a", "T"); arrow(t.vecs.drag, "#ffb347", "D");
    ctx.fillStyle = "#9fb7c9"; ctx.font = "10px monospace";
    ctx.fillText("vista lateral — escala: peso = 55 px", 8, h - 8);

    const rel = (a, b, eq, gt, lt) => (a > b * 1.03 ? gt : a < b * 0.97 ? lt : eq);
    const v = rel(t.L, t.W, "L ≈ W: voo nivelado, sem ganho de altitude.", "L > W: a trajetória curva para cima (sobe).", "L < W: a gravidade vence; a trajetória curva para baixo.");
    const a = rel(t.T, t.D, "T ≈ D: velocidade constante.", "T > D: a aeronave acelera.", "T < D: a aeronave desacelera.");
    let extra = "";
    if (t.crashed) extra = "Acidente: o toque excedeu os limites estruturais.";
    else if (t.stalled) extra = "STALL: o ângulo de ataque passou do crítico, o escoamento descolou da asa e o CL despencou. Reduza o ângulo (alivie o profundor) e dê potência.";
    else if (t.onGround) extra = "No solo: o peso é sustentado pelas rodas; as forças de atrito freiam a corrida.";
    else if (Math.abs(t.roll) > 0.35) extra = `Inclinado ${Math.round(Math.abs(t.roll) * R2D)}°: a sustentação aponta inclinada; sua componente horizontal faz a curva e a vertical diminui (n = ${t.nz.toFixed(2)} g).`;
    $("edu-text").textContent = `${v} ${a} ${extra}`;
  }
}