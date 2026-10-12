# GeoFS Edu — simulador de voo educativo (CesiumJS)

1. Pegue um token gratuito em https://ion.cesium.com/tokens e cole em `js/config.js` (`ionToken`).
2. Sirva a pasta por HTTP (módulos ES não funcionam via file://):
   - `python3 -m http.server 8080`   ou   `npx serve .`
3. Abra http://localhost:8080

Modelo próprio: coloque um GLB em `assets/aircraft.glb` (nariz em +X; ajuste `modelYawOffsetDeg` se preciso).
