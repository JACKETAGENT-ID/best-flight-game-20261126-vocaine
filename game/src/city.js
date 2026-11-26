// Night Mail Run — the night city below the plane.
// One clear job: build a deterministic, recognisable city (river, harbour,
// lit streets, towers with glowing windows) and answer "what is under
// this point?" so the flight model can crash into a building.

import { makeRng, range, pick } from './rng.js';
import { WORLD } from './config.js';

const RIVER_X = -260; // the river runs north-south, west of the start line
const RIVER_HALF = 130;

// A building: footprint on the ground, a height, and a window pattern.
function makeBuilding(rng, bx, bz) {
  const tall = rng() < 0.16;
  // Rooftops stay below 150 m so a mail plane cruising at 190 m clears
  // the city; only the seven landmark towers rise above that.
  const height = tall ? range(rng, 95, 150) : range(rng, 18, 85);
  const w = range(rng, 46, 96);
  const d = range(rng, 46, 96);
  const windows = [];
  const cols = Math.max(2, Math.floor(w / 16));
  const rows = Math.max(2, Math.floor(height / 16));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.42) {
        windows.push({ c, r, warm: rng() < 0.72 });
      }
    }
  }
  return { x: bx, z: bz, w, d, height, cols, rows, windows };
}

export function createCity(seed) {
  const rng = makeRng(seed);
  const blocks = new Map(); // key "bx,bz" -> array of buildings
  const towers = []; // a few landmark towers the pilot can navigate by
  for (let i = 0; i < 7; i++) {
    towers.push({
      x: range(rng, -1400, 1400),
      z: 900 + i * 900 + range(rng, -200, 200),
      height: range(rng, 260, 380),
      beacon: rng() < 0.6,
    });
  }

  // The harbour runway's approach corridor is kept clear of buildings,
  // as a real airport approach is: the fog landing must be survivable.
  function inApproachCorridor(x, z) {
    return z > 4200 && Math.abs(x - runway.x) < 150;
  }

  // Deterministic block content: the same (bx, bz) always builds the same.
  function blockAt(bx, bz) {
    const key = bx + ',' + bz;
    let list = blocks.get(key);
    if (list) return list;
    list = [];
    const local = makeRng((seed ^ (bx * 374761393 + bz * 668265263)) >>> 0);
    const centreX = bx * WORLD.blockSize;
    const centreZ = bz * WORLD.blockSize;
    // The river stays open water: no buildings in it.
    // The approach corridor stays clear too.
    if (Math.abs(centreX - RIVER_X) > RIVER_HALF + 60 && !inApproachCorridor(centreX, centreZ)) {
      const count = local() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const ox = (i === 0 ? -1 : 1) * WORLD.blockSize * 0.22;
        const oz = (i === 0 ? -1 : 1) * WORLD.blockSize * 0.18;
        list.push(makeBuilding(local, centreX + ox, centreZ + oz));
      }
    }
    blocks.set(key, list);
    return list;
  }

  // Height of the tallest thing at world (x, z), 0 where there is nothing.
  function obstacleHeightAt(x, z) {
    if (inApproachCorridor(x, z)) return 0;
    const bx = Math.round(x / WORLD.blockSize);
    const bz = Math.round(z / WORLD.blockSize);
    let top = 0;
    for (const b of blockAt(bx, bz)) {
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) {
        top = Math.max(top, b.height);
      }
    }
    for (const t of towers) {
      if (Math.abs(x - t.x) < 26 && Math.abs(z - t.z) < 26) {
        top = Math.max(top, t.height);
      }
    }
    return top;
  }

  function isRiver(x) {
    return Math.abs(x - RIVER_X) < RIVER_HALF;
  }

  // The harbour runway for the fog mission: a lit strip east of the river.
  const runway = {
    x: 620,
    zStart: 4800,
    zEnd: 6400,
    width: 90,
  };

  return { blockAt, obstacleHeightAt, isRiver, towers, runway, RIVER_X, RIVER_HALF, inApproachCorridor };
}

// Project a world point into screen space from the chase camera.
// Returns null when the point is behind the camera.
export function project(camera, wx, wy, wz, screenW, screenH) {
  const depth = wz - camera.z;
  if (depth < 8) return null;
  const scale = WORLD.focalLength / depth;
  const horizonY = screenH * WORLD.horizonFraction;
  const sx = screenW / 2 + (wx - camera.x) * scale;
  // The camera looks slightly down: the ground plane meets the horizon.
  const sy = horizonY + (camera.y - wy) * scale;
  return { x: sx, y: sy, scale, depth };
}
