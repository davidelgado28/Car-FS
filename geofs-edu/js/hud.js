import { R2D, M_TO_FT, MS_TO_KT, MS_TO_FPM } from "./math.js";

const $ = (id) => document.getElementById(id);
const CARD = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

export class HUD {
  constructor() {
    this.cache = {};
    this.dom = {
      rose: $("rose"),
      thrBar: $("thr-bar"),
      aiHorizon: $("ai-horizon"),
      warn: $("warn")
    };

    let roseHtml = "";
    for (let i = 0; i < 8; i += 2) {
      roseHtml += `<span style="transform:rotate(${i * 45}deg)"><i>${CARD[i]}</i></span>`;
    }
    this.dom.rose.insertAdjacentHTML("beforeend", roseHtml);
  }

  toggleHelp() {
    $("help").classList.toggle("hidden");
  }

  _set(id, v) {
    v = String(v);
    if (this.cache[id] !== v) {
      this.cache[id] = v;
      $(id).textContent = v;
    }
  }
  _setStyle(el, prop, v) {
    if (this.cache[el.id + prop] !== v) {
      this.cache[el.id + prop] = v;
      el.style[prop] = v;
    }
  }

  update(t, m, ui, camLabel) {
    this._set("ias", Math.round(t.ias * MS_TO_KT));
    this._set("tas", Math.round(t.V * MS_TO_KT));
    this._set("alt-ft", Math.round(m.alt * M_TO_FT));
    this._set("alt-m", Math.round(m.alt));
    this._set("agl", Math.max(0, Math.round(t.agl * M_TO_FT)));
    this._set("vs", Math.round((t.vs * MS_TO_FPM) / 10) * 10);

    const rawHdg = t.heading;
    const hdgDeg = (Math.round(rawHdg) % 360 + 360) % 360;
    const cardIdx = (Math.round(rawHdg / 45) % 8 + 8) % 8;
    this._set("hdg", `${String(hdgDeg).padStart(3, "0")}° ${CARD[cardIdx]}`);
    this._setStyle(this.dom.rose, "transform", `rotate(${-rawHdg}deg)`);

    const thrPct = Math.round(m.throttle * 100);
    this._set("thr", `${thrPct}%`);
    this._setStyle(this.dom.thrBar, "width", `${thrPct}%`);
    this._set("flaps", m.ac.flaps[m.flaps].label);
    this._set("trim", `${m.trim >= 0 ? "+" : ""}${(m.trim * 100).toFixed(0)}`);

    const rollDeg = -t.roll * R2D;
    const pitchPx = t.pitch * R2D * 2.2;
    this._setStyle(this.dom.aiHorizon, "transform", `rotate(${rollDeg}deg) translateY(${pitchPx}px)`);

    let msg = "";
    let cls = "info";

    if (t.crashed) {
      msg = `ACIDENTE — ${t.crashReason}\nPressione R para reiniciar`;
    } else if (ui.paused) {
      msg = "PAUSADO";
    } else if (t.stalled || t.stallWarn) {
      msg = t.stalled ? "STALL!" : "ALERTA DE STALL";
      cls = "stall";
      
      if (!this.cache["stall-alarm-active"]) {
        this.cache["stall-alarm-active"] = true;
        fetch("alarmes/stall.mp3").catch(err => console.error("Erro ao tocar alarme:", err));
      }
    }

    if (!t.stalled && !t.stallWarn) {
      this.cache["stall-alarm-active"] = false;
    }

    const warnEl = this.dom.warn;
    if (this.cache["warn-msg"] !== msg) {
      this.cache["warn-msg"] = msg;
      warnEl.textContent = msg;
      warnEl.style.whiteSpace = msg ? "pre" : "";
    }
    if (this.cache["warn-cls"] !== cls) {
      this.cache["warn-cls"] = cls;
      warnEl.className = cls;
    }

    this._set("cammode", `CÂMERA: ${camLabel || "Externa"}`);
  }
}
