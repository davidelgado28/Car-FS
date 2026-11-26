export const G0 = 9.80665;   
export const RHO0 = 1.225;   

export function isaDensity(h) {
  h = Math.max(0, h);
  if (h <= 11000) {
    const T = 288.15 - 0.0065 * h;
    const p = 101325 * Math.pow(T / 288.15, 5.25588);
    return p / (287.053 * T); 
  }
  return 0.36392 * Math.exp(-(h - 11000) / 6341.6);
}
