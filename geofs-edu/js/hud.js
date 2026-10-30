import { R2D, M_TO_FT, MS_TO_KT, MS_TO_FPM } from "./math.js"; 

const $ = (id) => document.getElementById(id); 
const CARD = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"]; 

export class HUD { 
  constructor() { 
    this.cache = {}; 
    const rose = $("rose"); 
    CARD.forEach((c, i) => { 
      if (i % 2 === 0) rose.insertAdjacentHTML("beforeend", `<span style="transform:rotate(${i * 45}deg)"><i>${c}</i></span>`); 
    }); 
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

  update(t, m, ui, camLabel) { 
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
    else if (t.stalled || t.stallWarn) { 
      msg = t.stalled ? "STALL!" : "ALERTA DE STALL"; 
      cls = "stall"; 

      if (!this.cache["stall-alarm-active"]) {
        this.cache["stall-alarm-active"] = true;
        fetch("alarmes/stall.mp3").catch(err => console.error(err));
      }
    } 

    if (!t.stalled && !t.stallWarn) {
      this.cache["stall-alarm-active"] = false;
    }

    if (w.textContent !== msg) { 
      w.textContent = msg; 
      w.style.whiteSpace = "pre"; 
    } 
    w.className = cls; 
    this._set("cammode", "CÂMERA: " + (camLabel || "Externa")); 
  } 
}
