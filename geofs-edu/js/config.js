import { D2R } from "./math.js";

export const CONFIG = {
  ionToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Im5uU2x2Z0lXQWJlZW92OUEiLCJqdGkiOiJjNzU0NjA5YS1iNGFlLTQzNWItYjQ2NC1jNmM3OTk4ZjEzMGYiLCJpZCI6NTIyMTQyLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3OTE4NDQyNTJ9.LdNAOgz2sNWZSr9w2Yncz8LAUApvxDqyGlQWyrEWhg8",

  simTimeUtc: "2026-06-21T15:00:00Z", 
  invertPitchKeys: true,              
  start: { lat: -22.93, lon: -43.10, alt: 900, headingDeg: 270, speed: 54 },

  modelUrls: [
    "assets/aircraft.glb",
    "https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb",
  ],
  modelScale: 1.0,
  modelYawOffsetDeg: 0, 

  camera: {
    chaseBack: 17, chaseUp: 4.5, chaseSmooth: 5, lookAhead: 25,
    cockpit: [1.6, 0, 0.9], 
    fovChase: 60, fovCockpit: 85, hideModelInCockpit: true,
  },
};

export const AIRCRAFT = {
  name: "Monomotor leve (tipo Cessna 172)",
  mass: 1100,          
  wingArea: 16.2,      
  CL0: 0.30,           
  CLalpha: 4.6,       
  alphaStall: 16 * D2R,
  alphaStallNeg: -12 * D2R,
  stallWidth: 8 * D2R, 
  CD0: 0.030,         
  k: 0.057,           
  CYbeta: 0.6,         
  flaps: [
    { label: "0°",  dCL: 0.00, dCD: 0.000 },
    { label: "10°", dCL: 0.25, dCD: 0.012 },
    { label: "20°", dCL: 0.45, dCD: 0.030 },
    { label: "30°", dCL: 0.60, dCD: 0.060 },
  ],

  staticThrust: 3200,  
  propPower: 95000,    
  qRef: 750,         
  Kelev: 1.75, Kqd: 4.0, Kalpha: 5.0, alphaTrim: 1 * D2R,
  Kail: 4.2, Kpd: 4.0,
  Krud: 1.5, Krd: 2.5, Kbeta: 3.0,

  gearHeight: 1.6,    
  rollFriction: 0.03, brakeFriction: 0.5, steerRate: 0.5,
  crashSink: 6,       
  crashRoll: 30 * D2R, crashNose: 10 * D2R, crashTail: 15 * D2R, maxGroundPitch: 12 * D2R,
};