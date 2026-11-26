// Night Mail Run — mission logic: beacon rings, the fog approach, scoring.
// One clear job: decide where the rings and the runway sit, when a ring is
// flown through, and what a finished sortie is worth.

import { SCORE } from './config.js';
import { makeRng, range } from './rng.js';

// Lay the rings along a gentle S-curve over the city so the route reads
// on the horizon and the pilot has to work the bank.
export function buildRings(mission) {
  const rng = makeRng(mission.seed + 7);
  const rings = [];
  let x = 0;
  for (let i = 0; i < mission.rings; i++) {
    const z = (i + 1) * mission.ringSpacing + 320;
    x = Math.max(-900, Math.min(900, x + range(rng, -420, 420)));
    rings.push({
      index: i,
      x,
      y: range(rng, 120, 250),
      z,
      radius: mission.ringRadius,
      passed: false,
      missed: false,
    });
  }
  return rings;
}

// The next ring the pilot must fly through, or null when the route is done.
export function nextRing(rings) {
  return rings.find((r) => !r.passed && !r.missed) || null;
}

// True when every ring on the route is resolved, passed or missed.
export function ringsResolved(rings) {
  return rings.length > 0 && rings.every((r) => r.passed || r.missed);
}

// A ring counts when the plane crosses its plane within its radius.
export function checkRingPass(plane, ring) {
  if (!ring || ring.passed) return false;
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  if (Math.abs(dz) > 26) return false;
  return dx * dx + dy * dy < ring.radius * ring.radius;
}

export function createMissionState(mission) {
  return {
    mission,
    rings: buildRings(mission),
    ringsPassed: 0,
    score: 0,
    elapsed: 0,
    message: '',
    messageUntil: 0,
    lightningAt: -10, // seconds; storm flashes are scheduled from here
    nextLightningIn: 2.5,
    finished: false,
    finishedReason: '',
    // Fog approach: a chain of small approach beacons leads to the runway.
    approach: mission.id === 'fog' ? buildApproach(mission) : [],
  };
}

function buildApproach(mission) {
  const beacons = [];
  const runwayZ = mission.runwayAt;
  for (let i = 0; i < 5; i++) {
    beacons.push({
      x: 620 + (i % 2 === 0 ? -160 : 160) * (5 - i) * 0.12,
      y: 320 - i * 52,
      z: runwayZ - 2600 + i * 480,
      passed: false,
    });
  }
  return beacons;
}

// Called every frame while flying: rings, approach beacons, lightning clock.
export function stepMission(state, plane, city, dt, time) {
  state.elapsed += dt;

  const ring = nextRing(state.rings);
  if (ring && checkRingPass(plane, ring)) {
    ring.passed = true;
    state.ringsPassed += 1;
    const timeBonus = Math.max(0, Math.round((state.mission.parSeconds - state.elapsed) * 0.4));
    state.score += SCORE.ring + timeBonus;
    flashMessage(state, 'RING ' + state.ringsPassed + ' / ' + state.mission.rings + '  +' + (SCORE.ring + timeBonus), time);
  } else if (ring && plane.z - ring.z > 60) {
    // Flown past the ring without threading it: it is missed, the route
    // moves on. A missed ring scores nothing but never blocks the sortie.
    ring.missed = true;
    flashMessage(state, 'RING MISSED — next one', time);
  }

  for (const b of state.approach) {
    if (!b.passed && Math.abs(plane.z - b.z) < 30) {
      const d = Math.hypot(plane.x - b.x, plane.y - b.y);
      if (d < 120) {
        b.passed = true;
        state.score += 150;
        flashMessage(state, 'APPROACH BEACON  +' + 150, time);
      }
    }
  }

  // Storm lightning: a flash every few seconds, purely visual.
  if (state.mission.weather === 'storm') {
    state.nextLightningIn -= dt;
    if (state.nextLightningIn <= 0) {
      state.lightningAt = time;
      state.nextLightningIn = 3 + Math.random() * 4;
    }
  }

  // Route complete: all rings flown (or missed and moved past).
  if (state.mission.rings > 0 && ringsResolved(state.rings) && !state.finished) {
    finishMission(state, plane, 'Route complete — every letter delivered.');
  }
  // Fog mission ends on landing (or crash), handled by the plane.
  if (state.mission.id === 'fog' && plane.landed && !state.finished) {
    finishMission(state, plane, 'Down safe on the harbour runway.');
  }
  if (plane.crashed && !state.finished) {
    state.finished = true;
    state.finishedReason = plane.crashReason;
  }
}

function finishMission(state, plane, reason) {
  state.finished = true;
  state.finishedReason = reason;
  const fuelBonus = Math.round(plane.fuel * SCORE.fuelBonus * 0.1);
  const damagePenalty = Math.round(plane.damage * SCORE.damagePenalty * 0.1);
  state.score += fuelBonus - damagePenalty;
  if (plane.landed) {
    const gentle = Math.abs(plane.verticalSpeed) < 6;
    state.score += gentle ? SCORE.landingSoft : SCORE.landingOk;
  }
}

export function flashMessage(state, text, time) {
  state.message = text;
  state.messageUntil = time + 2.4;
}

// Seconds since the last lightning flash (storm missions only).
export function lightningAge(state, time) {
  return time - state.lightningAt;
}
