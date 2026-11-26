// Ember Ridge Airlift — all tuning numbers, colours and constants in one place.
// The simulation runs at a fixed 60 Hz step; the renderer scales the 1280x720 logical
// playfield to the window. Nothing here depends on screen size.

export const FIELD = { width: 1280, height: 720, horizonY: 200 };

export const STEP = 1 / 60;

export const AIRCRAFT = {
  // Physical constants (simplified bush-plane feel)
  mass: 1200,
  wingArea: 18,
  maxThrust: 8500,
  idleThrust: 800,
  dragCoeff: 0.035,
  liftCoeff: 0.12,
  maxAoA: 0.35,
  stallAoA: 0.38,
  // Control response
  rollRate: 2.8,
  pitchRate: 1.6,
  yawRate: 1.0,
  rollDamping: 0.92,
  pitchDamping: 0.88,
  // Limits
  maxSpeed: 140,
  minSpeed: 28,
  maxAltitude: 3500,
  // Fuel
  fuelCapacity: 450,
  fuelBurnIdle: 0.15,
  fuelBurnMax: 1.8,
  // Damage
  maxHealth: 100,
  hardLandingThreshold: 4.5,
  crashThreshold: 12,
};

export const WORLD = {
  // Terrain generation
  segmentLength: 80,
  viewDistance: 2400,
  mountainCount: 6,
  mountainHeightRange: [400, 1800],
  mountainWidthRange: [300, 800],
  riverWidth: 60,
  riverMeander: 40,
  villageCount: 5,
  villageSize: 120,
  airstripCount: 4,
  airstripLength: 400,
  airstripWidth: 40,
  // Colors (dawn/dusk palette)
  skyTop: '#0d1b2a',
  skyHorizon: '#1b2a4a',
  skyGlow: '#ff6b35',
  mountainFar: '#1a2b3a',
  mountainMid: '#243b53',
  mountainNear: '#2d4a6b',
  riverWater: '#1e3a5f',
  riverReflection: '#3a5a7a',
  villageRoof: '#8b5a3c',
  villageWall: '#6b4a33',
  airstripSurface: '#4a5a4a',
  airstripMarking: '#e8e8e8',
  foliage: '#2d5a3d',
  fogNear: 'rgba(13, 27, 42, 0.6)',
  fogFar: 'rgba(13, 27, 42, 0.95)',
};

export const RINGS = {
  count: 8,
  radius: 50,
  thickness: 8,
  colors: [
    '#ff6b35', '#f7931e', '#ffcc00', '#6bcb77',
    '#4d96ff', '#7b68ee', '#ff6b9d', '#00d4aa'
  ],
  points: 250,
  missPenalty: 50,
};

export const MISSIONS = {
  types: ['DELIVER', 'RINGS', 'SURVEY'],
  deliverCargoWeight: 200,
  deliverFuelBonus: 80,
  surveyPhotoBonus: 150,
  timeLimit: 300,
  fuelWarning: 60,
};

export const HUD = {
  font: '14px "JetBrains Mono", "Fira Code", "Consolas", monospace',
  fontLarge: '20px "JetBrains Mono", "Fira Code", "Consolas", monospace',
  color: '#e8f4fd',
  colorWarn: '#ffcc00',
  colorDanger: '#ff4444',
  bg: 'rgba(13, 27, 42, 0.75)',
  panelBg: 'rgba(13, 27, 42, 0.9)',
  border: '#3a5a7a',
};

export const INPUT = {
  mouseSensitivity: 0.0018,
  keyboardRoll: 2.2,
  keyboardPitch: 1.3,
  throttleStep: 0.08,
};

export const CAMERA = {
  chaseDistance: 180,
  chaseHeight: 60,
  chaseLag: 0.08,
  fov: 75,
  shakeIntensity: 0,
  shakeDecay: 0.92,
};

export const AUDIO = {
  masterVolume: 0.5,
  engineBaseFreq: 80,
  engineMaxFreq: 220,
  windVolume: 0.15,
  stallWarningVolume: 0.4,
  impactVolume: 0.6,
};

export const SCORING = {
  ringBonus: 250,
  deliveryBonus: 500,
  surveyBonus: 300,
  landingBonus: 400,
  perfectLandingBonus: 800,
  crashPenalty: -1000,
  fuelEmptyPenalty: -500,
  timeBonus: 10,
};