// Night Mail Run — the mail plane's flight model.
// One clear job: turn pilot input into position, heading, speed, altitude,
// fuel and damage. No drawing here; the renderer reads this state.

import { FLIGHT, WORLD } from './config.js';

export function createPlane(mission) {
  return {
    // Position: x east, y altitude above ground, z distance flown.
    x: 0,
    y: 190,
    z: 0,
    heading: 0, // radians, 0 = due north along the route
    bank: 0, // radians of roll, positive = banking right
    pitch: 0, // radians, positive = nose up
    throttle: 0.55, // 0..1
    speed: 62, // m/s
    verticalSpeed: 0,
    fuel: mission.fuel,
    damage: 0,
    crashed: false,
    crashReason: '',
    landed: false,
    // Per-frame diagnostics the HUD reads.
    stalled: false,
    lastBankInput: 0,
  };
}

// One simulation step. dt is seconds since the last frame.
export function stepPlane(plane, input, mission, city, dt, time) {
  if (plane.crashed || plane.landed) return;

  // --- Throttle -----------------------------------------------------------
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + FLIGHT.throttleStep * dt);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - FLIGHT.throttleStep * dt);
  if (input.mouseHeld) {
    // Mouse steering also works the throttle: pointer high = more power.
    const target = 1 - input.mouseY / window.innerHeight;
    plane.throttle += Math.max(-1, Math.min(1, target - plane.throttle)) * FLIGHT.throttleMouseStep * dt;
  }

  // --- Bank and heading ---------------------------------------------------
  let bankTarget = 0;
  if (input.left) bankTarget -= FLIGHT.maxBank;
  if (input.right) bankTarget += FLIGHT.maxBank;
  if (input.mouseHeld) {
    const halfW = window.innerWidth / 2;
    bankTarget = Math.max(-FLIGHT.maxBank, Math.min(FLIGHT.maxBank, (input.mouseX - halfW) / halfW * FLIGHT.maxBank * 1.4));
  }
  plane.lastBankInput = bankTarget;
  const bankDelta = bankTarget - plane.bank;
  plane.bank += Math.max(-FLIGHT.bankRate * dt, Math.min(FLIGHT.bankRate * dt, bankDelta));
  plane.heading += Math.sin(plane.bank) * FLIGHT.turnRate * dt;

  // --- Pitch and altitude -------------------------------------------------
  let pitchTarget = 0;
  if (input.pitchUp) pitchTarget += FLIGHT.maxPitchUp;
  if (input.pitchDown) pitchTarget += FLIGHT.maxPitchDown;
  if (input.mouseHeld) {
    const halfH = window.innerHeight / 2;
    pitchTarget = Math.max(FLIGHT.maxPitchDown, Math.min(FLIGHT.maxPitchUp, (halfH * 0.5 - input.mouseY) / window.innerHeight * 1.6));
  }
  const pitchDelta = pitchTarget - plane.pitch;
  plane.pitch += Math.max(-FLIGHT.pitchRate * dt, Math.min(FLIGHT.pitchRate * dt, pitchDelta));

  // --- Storm turbulence shoves the plane around ----------------------------
  if (mission.turbulence > 0) {
    const gust = Math.sin(time * 2.1) * 0.5 + Math.sin(time * 3.7 + 1.3) * 0.5;
    plane.bank += gust * mission.turbulence * 0.35 * dt;
    plane.pitch += Math.sin(time * 2.9 + 0.7) * mission.turbulence * 0.12 * dt;
  }

  // --- Speed: throttle sets the target, drag pulls toward it --------------
  const targetSpeed =
    WORLD.minSpeed + plane.throttle * (WORLD.maxSpeed - WORLD.minSpeed);
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, FLIGHT.drag * dt * 3.2);
  plane.stalled = plane.speed < WORLD.minSpeed + 6;

  // --- Motion ---------------------------------------------------------------
  const forwardX = Math.sin(plane.heading);
  const forwardZ = Math.cos(plane.heading);
  plane.x += forwardX * plane.speed * dt;
  plane.z += forwardZ * plane.speed * dt;

  // Climb comes from pitch; a stalled wing cannot hold altitude.
  plane.verticalSpeed = Math.sin(plane.pitch) * FLIGHT.climbPerPitch * (plane.stalled ? 0.35 : 1);
  if (plane.stalled) plane.verticalSpeed -= 14;
  plane.y += plane.verticalSpeed * dt;
  if (plane.y > WORLD.maxAltitude) {
    plane.y = WORLD.maxAltitude;
    plane.verticalSpeed = Math.min(0, plane.verticalSpeed);
  }

  // --- Fuel -----------------------------------------------------------------
  plane.fuel -= (FLIGHT.fuelIdle + plane.throttle * FLIGHT.fuelPerSecond) * dt;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = 0; // out of fuel: the engine quits, glide only
  }

  // --- Terrain collision ----------------------------------------------------
  if (plane.y <= 0) {
    const onRunway =
      mission.id === 'fog' &&
      Math.abs(plane.x - city.runway.x) < city.runway.width / 2 &&
      plane.z > city.runway.zStart &&
      plane.z < city.runway.zEnd;
    if (onRunway) {
      landPlane(plane);
    } else {
      crashPlane(plane, plane.y <= -2 ? 'Ditched in the river district' : 'Flew into the ground');
    }
    return;
  }
  const obstacle = city.obstacleHeightAt(plane.x, plane.z);
  if (obstacle > 0 && plane.y < obstacle) {
    crashPlane(plane, 'Clipped a tower — the mail is scattered over the rooftops');
  }
}

// A touchdown on the runway: soft if slow and gentle, rough otherwise.
function landPlane(plane) {
  plane.y = 0;
  const gentle = Math.abs(plane.verticalSpeed) < 6 && plane.speed < 95;
  if (gentle) {
    plane.landed = true;
  } else if (Math.abs(plane.verticalSpeed) < 12 && plane.speed < 120) {
    plane.damage += FLIGHT.damageHardLanding;
    plane.landed = plane.damage < 100;
    if (!plane.landed) crashPlane(plane, 'Hard landing — the undercarriage gave way');
  } else {
    crashPlane(plane, 'Slammed into the runway too fast');
  }
}

function crashPlane(plane, reason) {
  plane.crashed = true;
  plane.crashReason = reason;
  plane.damage = 100;
}

// Heading in degrees, 0..360, for the compass tape.
export function headingDegrees(plane) {
  const deg = ((plane.heading * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}
