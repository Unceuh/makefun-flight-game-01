// Every tuning number, colour and island in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule depends on the screen size.
// "Garuda Kargo" — an island-hopping cargo pilot: fly rings, drop cargo, land on short island
// runways across an Indonesian archipelago, before the day runs out.
export const FIELD = { width: 1280, height: 720, seaY: 560 };

/** The world is one long strip of sea and islands; the camera follows the plane along it. */
export const WORLD = { width: 5200, edge: 60 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One working day lasts this long; when it ends the day summary appears. */
export const DAY_SECONDS = 150;

export const LIVES = 3;

/** The cargo plane's flight model: speeds in px/s, pitch in radians (positive is nose up). */
export const PLANE = {
  maxSpeed: 520,
  stallSpeed: 150,
  accel: 280,
  decel: 340,
  pitchRate: 1.6,
  pitchMax: 0.65,
  takeoffSpeed: 235,
  sinkAtStall: 150,
  /** A touchdown this gentle or gentler, and slow enough, is a landing; harder is a crash. */
  safeTouchdownVy: 300,
  safeTouchdownSpeed: 480,
  /** A rough landing (island grass, not runway) adds this much damage and stops the plane. */
  roughDamage: 35,
};

/** Fuel: full tank, drain per second at full throttle and at idle, refuelled on landing. */
export const FUEL = { max: 100, fullThrottle: 3.2, idle: 0.8, reserve: 12 };

/** Islands along the strip, west to east. Runways sit on the flat tops. */
export const ISLANDS = [
  { name: 'Pulau Garuda', x0: 0, x1: 700, topY: 560, kind: 'home',
    runway: { x0: 120, x1: 480, y: 560 } },
  { name: 'Krakatau', x0: 1500, x1: 2100, topY: 380, kind: 'volcano', runway: null },
  { name: 'Pulau Komodo', x0: 2600, x1: 3300, topY: 520, kind: 'island',
    runway: { x0: 2720, x1: 3060, y: 520 } },
  { name: 'Pulau Raja', x0: 4000, x1: 4700, topY: 500, kind: 'island',
    runway: { x0: 4120, x1: 4460, y: 500 } },
];

/** Mission pay: rings, a cargo drop, a landing, and the bonus for a whole sortie. */
export const PAY = { ring: 40, drop: 120, land: 150, sortie: 100 };

/** How the day's missions are laid out, and how each new sortie gets harder. */
export const MISSION = {
  ringRadius: 55,
  ringRadiusMin: 46,
  ringXs: [900, 1300, 1750],
  /** Ring 3 hangs over Krakatau's peak (terrain 386 at x=1750), so it must stay high. */
  ringYs: [[290, 440], [290, 440], [250, 320]],
  dropX: 2890,
  dropHalfWidth: 80,
  dropHalfWidthMin: 60,
  dropCeilingY: 500,
  landRunway: 2,
  windBase: 20,
  windPerSortie: 8,
  windMax: 70,
};

export const PALETTE = {
  backdrop: '#0b1e33',
  skyTop: '#16324f',
  skyMid: '#3d6a8f',
  skyLow: '#e8915a',
  sun: '#ffd9a0',
  sunCore: '#fff3d6',
  cloud: '#f4ede2',
  cloudShade: '#d9cdbd',
  sea: '#1d5f7a',
  seaDeep: '#14455e',
  seaFoam: '#bfe3ea',
  island: '#3f7a44',
  islandDark: '#2c5a31',
  sand: '#e8d29a',
  sandDark: '#c9ae72',
  volcano: '#4a3a3a',
  volcanoDark: '#332828',
  lava: '#ff7a3c',
  smoke: '#cfc4b8',
  palm: '#2e6b34',
  palmTrunk: '#7a5230',
  runway: '#3c4148',
  runwayLine: '#f5f0e0',
  runwayEdge: '#e8b64c',
  ring: '#ff5fa2',
  ringGlow: '#ff9ec7',
  ringDone: '#7be3a8',
  zone: '#ffd23f',
  planeBody: '#e8e4da',
  planeBelly: '#c63b2e',
  planeStripe: '#1f6f4a',
  planeGlass: '#ffd97a',
  planeGlassLit: '#ffe9a8',
  prop: '#2a2a2a',
  panel: '#1c2733',
  panelEdge: '#4a5a6a',
  gaugeFace: '#0f1a24',
  gaugeAmber: '#ffb347',
  gaugeGreen: '#7be3a8',
  gaugeRed: '#e5534b',
  gaugeNeedle: '#f5f0e0',
  text: '#fff3e0',
  muted: '#c9d6de',
  gold: '#f2c94c',
  danger: '#e5534b',
  good: '#7bc96f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'garuda-kargo.best';
