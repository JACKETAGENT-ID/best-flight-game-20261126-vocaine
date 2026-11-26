// Night Mail Run — tuning constants and mission definitions.
// One clear job: every number the flight model, the city and the missions
// share lives here, so balancing never means hunting through render code.

// World units: 1 unit = 1 metre. Speeds are metres per second.
export const WORLD = {
  focalLength: 560, // projection focal length, in screen pixels
  horizonFraction: 0.42, // horizon sits this far down the screen
  viewDistance: 2600, // how far ahead the city is drawn, in metres
  blockSize: 150, // city blocks are this wide, in metres
  streetWidth: 34,
  groundLevel: 0,
  maxAltitude: 900,
  minSpeed: 28, // below this the mail plane stalls and sinks
  maxSpeed: 148,
  cruiseSpeed: 96,
};

// Flight feel: how fast the plane answers the pilot.
export const FLIGHT = {
  throttleStep: 0.55, // throttle change per second while a key is held
  throttleMouseStep: 0.9,
  bankRate: 1.9, // radians of roll per second toward the target bank
  maxBank: 0.85, // radians, about 49 degrees
  turnRate: 0.55, // heading change per second at full bank
  pitchRate: 0.5, // radians of pitch per second
  maxPitchUp: 0.22,
  maxPitchDown: -0.3,
  climbPerPitch: 55, // vertical speed per radian of pitch, m/s
  drag: 0.14, // speed lost per second toward the throttle's target speed
  fuelPerSecond: 0.55, // fuel percent drained per second at full throttle
  fuelIdle: 0.08,
  damageHardLanding: 34,
  damageBuilding: 100, // a building strike ends the sortie
  damageGround: 100,
};

// Scoring.
export const SCORE = {
  ring: 500,
  ringTimeBonus: 12, // per second under par, per ring
  landingSoft: 1200,
  landingOk: 600,
  fuelBonus: 8, // per percent of fuel left on a completed mission
  damagePenalty: 6, // per point of damage at mission end
};

// The three night-mail sorties. Each mission is a different job, not a
// reskin: beacon route, storm crossing, fog landing.
export const MISSIONS = [
  {
    id: 'beacon',
    index: 0,
    name: 'BEACON RUN',
    subtitle: 'River District — fly the ring route',
    brief:
      'Six beacon rings mark the mail route over the River District. ' +
      'Thread every ring, keep the throttle honest, and bring the letters home.',
    rings: 6,
    ringSpacing: 620,
    ringRadius: 42,
    weather: 'clear',
    turbulence: 0,
    fog: 0,
    parSeconds: 150,
    fuel: 100,
    seed: 41017,
  },
  {
    id: 'storm',
    index: 1,
    name: 'STORM MAIL',
    subtitle: 'Thunderhead Crossing — lightning and gusts',
    brief:
      'A thunderhead sits on the route and the mail still has to fly. ' +
      'Five rings through the storm. Lightning blinds, gusts shove — ' +
      'small corrections, steady throttle.',
    rings: 5,
    ringSpacing: 700,
    ringRadius: 46,
    weather: 'storm',
    turbulence: 0.55,
    fog: 0.12,
    parSeconds: 170,
    fuel: 100,
    seed: 77003,
  },
  {
    id: 'fog',
    index: 2,
    name: 'FOG LANDING',
    subtitle: 'Harbor Fog — find the runway and put her down',
    brief:
      'Thick fog over the harbor. No rings tonight: follow the approach ' +
      'beacons, line up with the lit runway, and land gentle. ' +
      'Sink too fast or touch down off the strip and the mail is lost.',
    rings: 0,
    ringSpacing: 0,
    ringRadius: 0,
    weather: 'fog',
    turbulence: 0.18,
    fog: 0.85,
    parSeconds: 210,
    fuel: 100,
    seed: 90210,
    runwayAt: 5200, // metres ahead of the start line
  },
];

// Colours of the night: one palette shared by sky, city and instruments.
export const PALETTE = {
  skyTop: '#04050d',
  skyMid: '#0a1030',
  horizonGlow: '#e8803a',
  horizonGlowSoft: '#7a4a6e',
  star: '#dfe8ff',
  moon: '#f4ead0',
  streetWarm: '#ffb347',
  streetCool: '#7fd4ff',
  windowWarm: '#ffd27a',
  windowCool: '#9fd8ff',
  buildingDark: '#0b0e1c',
  buildingLit: '#141a30',
  beacon: '#39ff9d',
  beaconNext: '#ffcf3d',
  runwayEdge: '#ffb347',
  runwayCentre: '#ffffff',
  hudGreen: '#7dffb0',
  hudAmber: '#ffcf5e',
  hudRed: '#ff6b5e',
  hudCyan: '#8fe3ff',
  panel: '#0a0f1e',
};
