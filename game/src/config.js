// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The museum has three zones: Entrance Hall (west), Gallery Wing
// (middle) and the Vault (east).

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The player: a thief in the dark. Sneak is slow and silent, walk is the everyday
 *  pace, sprint is fast and loud. Carrying loot slows every pace (see LOOT_WEIGHT). */
export const PLAYER = {
  radius: 13,
  sneakSpeed: 85,
  walkSpeed: 150,
  sprintSpeed: 238,
  /** Seconds a guard must see the player continuously before suspicion starts to rise. */
  spotDelay: 0.4,
};

/** How much each carried loot item slows the player (multiplicative, per item). */
export const LOOT_WEIGHT = 0.05;

/** Guards patrol fixed waypoint loops. */
export const GUARD = {
  radius: 14,
  patrolSpeed: 76,
  investigateSpeed: 102,
  chaseSpeed: 136,
  /** Seconds a guard waits at each waypoint before moving on. */
  waypointPause: 0.9,
  /** Vision cone: half-angle in radians and range in pixels. */
  coneHalfAngle: 0.52,
  coneRange: 232,
  /** Suspicion per second while a guard has the player in its cone. */
  spotRate: 46,
  /** A guard this close to the player catches them, alarm or not. */
  catchRadius: 24,
};

/** Wall cameras sweep their cone back and forth. */
export const CAMERA = {
  coneHalfAngle: 0.61,
  spotRate: 42,
};

/** The vault's laser grid cycles off -> warning blink -> on. */
export const LASER = {
  offSeconds: 2.0,
  warnSeconds: 0.8,
  onSeconds: 2.4,
  /** Suspicion added the moment a live beam touches the player. */
  hitPenalty: 50,
  /** Suspicion per second while the player stands in a live beam. */
  burnRate: 40,
  /** Half-width of a beam: the player is hit within this many pixels of its line. */
  halfWidth: 9,
};

/** Noise: sprinting rings a bell guards can hear through walls (at reduced range). */
export const NOISE = {
  sprintRadius: 150,
  walkRadius: 45,
  sneakRadius: 0,
  /** A wall between the noise and a guard shrinks the radius to this fraction. */
  throughWall: 0.55,
  /** How often a moving player re-emits noise, in seconds. */
  pulseSeconds: 0.4,
};

/** Suspicion 0..100: rises while seen, falls while hidden. At 100 the alarm trips. */
export const SUSPICION = {
  decayPerSecond: 18,
  /** The alarm clears once suspicion falls back below this. */
  alarmClearBelow: 30,
  /** Suspicion decay while the alarm is active (guards stay jumpy). */
  alarmDecayPerSecond: 6,
};

/** The loot. The diamond is the objective; the rest is bonus. */
export const LOOT = [
  { kind: 'mask', name: 'Golden Mask', value: 4000, x: 500, y: 235 },
  { kind: 'idol', name: 'Jade Idol', value: 2500, x: 700, y: 580 },
  // The crown sits south of the vault guard's beat (y=300): the thief's route
  // to it never crosses the patrol line, and neither does the retreat.
  { kind: 'crown', name: 'Sapphire Crown', value: 6000, x: 1000, y: 340 },
  { kind: 'diamond', name: 'Star of Meridian', value: 10000, x: 1150, y: 600 },
];

/** Score bonuses on top of the loot value. */
export const BONUS = {
  /** Never tripping the alarm. */
  ghost: 2000,
  /** Time bonus starts here and loses 5 per second of the run. */
  timeStart: 1000,
  timePerSecond: 5,
};

/** The exit zone (a rectangle): reach it with the diamond to win. */
export const EXIT = { x: 0, y: 600, width: 48, height: 96 };

export const START = { x: 80, y: 400 };

/** Walls block movement and line of sight. {x, y, w, h}. */
export const WALLS = [
  // Divider Entrance | Gallery, with a door gap y 300..420.
  { x: 340, y: 0, w: 16, h: 300 },
  { x: 340, y: 420, w: 16, h: 300 },
  // Divider Gallery | Vault, with a door gap y 180..300.
  { x: 860, y: 0, w: 16, h: 180 },
  { x: 860, y: 300, w: 16, h: 420 },
];

/** Furniture blocks movement but not sight (display cases are low glass).
 *  Every piece stands clear of the guards' patrol legs: a guard whose path
 *  runs through a planter gets stuck against it forever (found in testing). */
export const OBSTACLES = [
  { x: 40, y: 120, w: 44, h: 44, kind: 'planter' },
  { x: 40, y: 520, w: 44, h: 44, kind: 'planter' },
  { x: 140, y: 300, w: 110, h: 28, kind: 'bench' },
  { x: 470, y: 90, w: 90, h: 50, kind: 'case' },
  { x: 470, y: 580, w: 90, h: 50, kind: 'case' },
  { x: 620, y: 330, w: 70, h: 70, kind: 'case' },
  { x: 880, y: 420, w: 60, h: 40, kind: 'crate' },
];

/** Paintings are decoration only: {x, y, w, h, hue}. They hang on the north wall. */
export const PAINTINGS = [
  { x: 420, y: 6, w: 70, h: 44, hue: '#c94f3d' },
  { x: 520, y: 6, w: 56, h: 44, hue: '#3d7ac9' },
  { x: 700, y: 6, w: 70, h: 44, hue: '#c9a13d' },
  { x: 940, y: 6, w: 70, h: 44, hue: '#7ac93d' },
  { x: 1060, y: 6, w: 56, h: 44, hue: '#9d3dc9' },
];

export const GUARDS = [
  {
    name: 'Reyes',
    waypoints: [
      { x: 120, y: 120 },
      { x: 280, y: 120 },
      { x: 280, y: 560 },
      { x: 120, y: 560 },
    ],
  },
  {
    name: 'Okafor',
    waypoints: [
      { x: 420, y: 180 },
      { x: 780, y: 180 },
      { x: 780, y: 540 },
      { x: 420, y: 540 },
    ],
  },
  {
    // Lindqvist guards the vault's east half only: the west vault (crown,
    // vault door) stays passable, and the laser grid has a quiet approach.
    name: 'Lindqvist',
    waypoints: [
      { x: 1080, y: 150 },
      { x: 1200, y: 150 },
      { x: 1200, y: 300 },
      { x: 1080, y: 300 },
    ],
  },
];

/** Cameras: fixed on the north wall, sweeping a cone. baseAngle is radians, 0 = east,
 *  PI/2 = south. sweepAmp is how far either side of base the cone swings. */
export const CAMERAS = [
  { x: 620, y: 10, baseAngle: Math.PI / 2, sweepAmp: 0.96, sweepSeconds: 6.0, range: 230, phase: 0 },
  { x: 1140, y: 10, baseAngle: Math.PI / 2, sweepAmp: 0.87, sweepSeconds: 7.0, range: 260, phase: 0.35 },
];

/** The laser grid: horizontal beams across the vault corridor (x 900..1240). */
export const LASERS = {
  x0: 900,
  x1: 1240,
  beams: [{ y: 400 }, { y: 470 }, { y: 540 }],
};

export const PALETTE = {
  // Floors: warm marble entrance, deep green gallery, dark slate vault.
  entrance: '#2b2620',
  entranceTile: '#332d25',
  gallery: '#1d2b26',
  galleryTile: '#233329',
  vault: '#191b24',
  vaultTile: '#1e212c',
  wall: '#0e0f13',
  wallTop: '#4a4238',
  caseGlass: '#3d5a52',
  caseTrim: '#c9a13d',
  planter: '#2e4a33',
  bench: '#6b543a',
  crate: '#4a3a28',
  player: '#37e0ff',
  playerRing: '#e8fbff',
  guard: '#e8e4da',
  guardCone: 'rgba(255, 176, 66, 0.30)',
  guardConeEdge: 'rgba(255, 176, 66, 0.85)',
  cameraCone: 'rgba(255, 92, 168, 0.28)',
  cameraConeEdge: 'rgba(255, 92, 168, 0.85)',
  laserOn: '#ff2e4d',
  laserOff: 'rgba(255, 46, 77, 0.18)',
  laserWarn: '#ff9a3d',
  gold: '#f2c94c',
  diamond: '#bdf3ff',
  text: '#f4efe4',
  muted: '#a89f8d',
  danger: '#ff4757',
  ok: '#3ddc84',
  hud: 'rgba(8, 10, 14, 0.82)',
  hudLine: '#3a352c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'night-shift-museum-heist.best';
