// Night Mail Run — the game loop and the screens around the flight.
// One clear job: own the state machine (menu → flying → debrief), run the
// loop, drive the autopilot the screenshot mode uses, and keep best scores.

import { MISSIONS, PALETTE, WORLD } from './config.js';
import { createCity } from './city.js';
import { createPlane, stepPlane } from './plane.js';
import { createMissionState, stepMission, nextRing } from './missions.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot'); // cover | storm | fog | menu | null
const shotAt = Number(params.get('t') || '14'); // seconds of flight before the shot

let screenW = 0;
let screenH = 0;
let dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  screenW = window.innerWidth;
  screenH = window.innerHeight;
  canvas.width = Math.round(screenW * dpr);
  canvas.height = Math.round(screenH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Best scores, kept on the pilot's own machine.
function loadBest() {
  try {
    return JSON.parse(window.localStorage.getItem('nightmailrun-best') || '{}');
  } catch (e) {
    return {};
  }
}
function saveBest(best) {
  try {
    window.localStorage.setItem('nightmailrun-best', JSON.stringify(best));
  } catch (e) {
    /* private mode: the game still plays */
  }
}

const game = {
  screen: 'menu', // menu | flying | done
  missionIndex: 0,
  mission: MISSIONS[0],
  city: null,
  plane: null,
  missionState: null,
  time: 0,
  best: loadBest(),
  auto: false, // autopilot drives in screenshot mode
  autoUntil: 0,
  menuButtons: [],
  doneButtons: [],
};

function startMission(index) {
  const mission = MISSIONS[index];
  game.missionIndex = index;
  game.mission = mission;
  game.city = createCity(mission.seed);
  game.plane = createPlane(mission);
  game.missionState = createMissionState(mission);
  game.time = 0;
  game.screen = 'flying';
  audio.unlock();
  statusEl.textContent = mission.name + ' started. Fly the route.';
}

// The autopilot: a steady pilot that chases the next ring or the runway.
// Used only by the screenshot mode, so the cover shows real flown flight.
function autopilot(dt) {
  const { plane, mission, missionState } = game;
  const ring = nextRing(missionState.rings);
  let targetX = 0;
  let targetY = 200;
  let targetZ = Infinity;
  if (ring) {
    targetX = ring.x;
    targetY = ring.y;
    targetZ = ring.z;
  } else if (mission.id === 'fog') {
    // Fog landing: ride the approach beacons down, then flare over the
    // runway and bleed speed off for a gentle touchdown.
    const r = game.city.runway;
    const beacon = missionState.approach.find((b) => !b.passed);
    if (beacon) {
      targetX = beacon.x;
      targetY = beacon.y;
      targetZ = beacon.z;
    } else {
      targetX = r.x;
      targetY = 0;
      targetZ = r.zStart + 400;
    }
  }
  const dz = Math.max(60, targetZ - plane.z);
  const wantHeading = Math.atan2(targetX - plane.x, dz);
  let headingError = wantHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const bank = Math.max(-0.7, Math.min(0.7, headingError * 2.2));
  const altError = targetY - plane.y;
  // Flare: nose up just before touchdown so the sink rate stays gentle.
  const flaring = mission.id === 'fog' && plane.z > 4600 && plane.y < 60;
  const pitch = flaring
    ? 0.18
    : Math.max(-0.25, Math.min(0.2, altError * 0.004));
  const slowingForLanding = mission.id === 'fog' && plane.z > 4800;
  input.inject({
    left: bank < -0.06,
    right: bank > 0.06,
    pitchUp: pitch > 0.03,
    pitchDown: pitch < -0.03,
    throttleUp: plane.speed < 92 && !slowingForLanding,
    throttleDown: plane.speed > 108 || (slowingForLanding && plane.speed > 82),
    mouseHeld: false,
  });
}

function step(dt) {
  game.time += dt;
  if (game.screen !== 'flying') return;
  if (game.auto) autopilot(dt);
  const beforeRings = game.missionState.ringsPassed;
  const wasFlying = !game.plane.crashed && !game.plane.landed;
  stepPlane(game.plane, input, game.mission, game.city, dt, game.time);
  stepMission(game.missionState, game.plane, game.city, dt, game.time);
  if (game.missionState.ringsPassed > beforeRings) audio.ring();
  if (wasFlying && game.plane.crashed) {
    audio.crash();
    endMission(false);
  } else if (wasFlying && game.plane.landed) {
    audio.land();
    endMission(true);
  } else if (game.missionState.finished && !game.plane.crashed) {
    endMission(true);
  }
  audio.setEngine(game.plane.throttle, game.screen === 'flying');
}

function endMission(success) {
  game.screen = 'done';
  game.doneSuccess = success;
  const key = game.mission.id;
  const score = game.missionState.score;
  if (success && (!game.best[key] || score > game.best[key])) {
    game.best[key] = score;
    saveBest(game.best);
    game.newBest = true;
  } else {
    game.newBest = false;
  }
  statusEl.textContent = success
    ? 'Mission complete. Score ' + score + '.'
    : 'Crashed. ' + game.plane.crashReason;
}

// --- Menu and debrief drawing ---------------------------------------------

function drawMenu() {
  const w = screenW;
  const h = screenH;
  // A live backdrop: the city drifts by behind the menu.
  if (!game.city) {
    game.city = createCity(MISSIONS[0].seed);
    game.plane = createPlane(MISSIONS[0]);
    game.missionState = createMissionState(MISSIONS[0]);
  }
  game.plane.z += 26 * 0.016;
  game.plane.y = 170 + Math.sin(game.time * 0.4) * 12;
  render(ctx, w, h, game, game.time);
  ctx.fillStyle = 'rgba(4,6,14,0.62)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.shadowColor = PALETTE.hudAmber;
  ctx.shadowBlur = 10;
  ctx.fillText('THE NIGHT MAIL FLIES ON TIME', cx, h * 0.14);
  ctx.fillStyle = '#f2f5ff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = '#8fe3ff';
  ctx.shadowBlur = 22;
  ctx.fillText('NIGHT MAIL RUN', cx, h * 0.14 + 74);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c9d4ea';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Three night sorties over a city that never sleeps. Fly the rings, mind the fuel,', cx, h * 0.14 + 108);
  ctx.fillText('and put her down gentle on the harbour runway.', cx, h * 0.14 + 132);

  game.menuButtons = [];
  const bw = 420;
  const bh = 74;
  const gap = 16;
  const startY = h * 0.36;
  MISSIONS.forEach((m, i) => {
    const y = startY + i * (bh + gap);
    const best = game.best[m.id];
    ctx.fillStyle = i === game.missionIndex ? 'rgba(39,75,143,0.85)' : 'rgba(16,22,44,0.88)';
    ctx.strokeStyle = i === game.missionIndex ? PALETTE.hudAmber : 'rgba(125,255,176,0.4)';
    ctx.lineWidth = i === game.missionIndex ? 2 : 1;
    roundRect(ctx, cx - bw / 2, y, bw, bh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2f5ff';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((i + 1) + '.  ' + m.name, cx - bw / 2 + 20, y + 30);
    ctx.fillStyle = '#c9d4ea';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(m.subtitle + (best ? '   ·   BEST ' + best : ''), cx - bw / 2 + 20, y + 54);
    game.menuButtons.push({ x: cx - bw / 2, y, w: bw, h: bh, index: i });
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b96b0';
  ctx.font = '13px system-ui, sans-serif';
  const cy = startY + 3 * (bh + gap) + 26;
  ctx.fillText('← → / A D  bank      ↑ ↓  pitch      W / S  throttle      mouse: hold to steer', cx, cy);
  ctx.fillText('Click a mission or press 1 / 2 / 3.  M mutes the sound.', cx, cy + 22);
  ctx.fillText('A small cargo plane, a big night, and letters that cannot wait.', cx, cy + 48);
}

function drawDone() {
  const w = screenW;
  const h = screenH;
  render(ctx, w, h, game, game.time);
  ctx.fillStyle = 'rgba(4,6,14,0.66)';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  ctx.textAlign = 'center';
  const ok = game.doneSuccess;
  ctx.fillStyle = ok ? PALETTE.hudGreen : PALETTE.hudRed;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 16;
  ctx.fillText(ok ? 'MISSION COMPLETE' : 'SORTIE LOST', cx, h * 0.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f2f5ff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(game.missionState.finishedReason || '', cx, h * 0.3 + 36);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('SCORE  ' + game.missionState.score, cx, h * 0.3 + 84);
  if (game.newBest) {
    ctx.fillStyle = PALETTE.hudGreen;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('★ NEW BEST FOR ' + game.mission.name + ' ★', cx, h * 0.3 + 114);
  }
  ctx.fillStyle = '#c9d4ea';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(
    'Rings ' + game.missionState.ringsPassed + '/' + game.mission.rings +
    '   ·   Time ' + formatTime(game.missionState.elapsed) +
    '   ·   Fuel ' + Math.round(game.plane.fuel) + '% left',
    cx, h * 0.3 + 148,
  );
  game.doneButtons = [
    { x: cx - 220, y: h * 0.3 + 190, w: 200, h: 52, label: 'FLY AGAIN  (R)', action: 'again' },
    { x: cx + 20, y: h * 0.3 + 190, w: 200, h: 52, label: 'MENU  (Esc)', action: 'menu' },
  ];
  for (const b of game.doneButtons) {
    ctx.fillStyle = 'rgba(16,22,44,0.9)';
    ctx.strokeStyle = PALETTE.hudGreen;
    ctx.lineWidth = 1;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2f5ff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 32);
  }
}

function roundRect(ctx2d, x, y, w, h, r) {
  ctx2d.beginPath();
  ctx2d.moveTo(x + r, y);
  ctx2d.arcTo(x + w, y, x + w, y + h, r);
  ctx2d.arcTo(x + w, y + h, x, y + h, r);
  ctx2d.arcTo(x, y + h, x, y, r);
  ctx2d.arcTo(x, y, x + w, y, r);
  ctx2d.closePath();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// --- Input handling for the screens ----------------------------------------

function handleKeys(pressed) {
  for (const code of pressed) {
    if (code === 'KeyM') audio.toggleMute();
    if (game.screen === 'menu') {
      if (code === 'Digit1') startMission(0);
      if (code === 'Digit2') startMission(1);
      if (code === 'Digit3') startMission(2);
      if (code === 'Enter' || code === 'Space') startMission(game.missionIndex);
      if (code === 'ArrowUp') game.missionIndex = (game.missionIndex + 2) % 3;
      if (code === 'ArrowDown') game.missionIndex = (game.missionIndex + 1) % 3;
    } else if (game.screen === 'done') {
      if (code === 'KeyR') startMission(game.missionIndex);
      if (code === 'Escape') {
        game.screen = 'menu';
        game.city = null;
      }
    } else if (game.screen === 'flying') {
      if (code === 'Escape') game.screen = 'menu';
    }
  }
}

function handleClick(click) {
  if (!click) return;
  audio.unlock();
  audio.click();
  const buttons = game.screen === 'menu' ? game.menuButtons : game.screen === 'done' ? game.doneButtons : [];
  for (const b of buttons) {
    if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
      if (game.screen === 'menu') startMission(b.index);
      else if (b.action === 'again') startMission(game.missionIndex);
      else if (b.action === 'menu') {
        game.screen = 'menu';
        game.city = null;
      }
      return;
    }
  }
}

// --- Screenshot mode --------------------------------------------------------
// ?shot=cover  → beacon mission, autopilot, ~14 s in: rings ahead, city lit
// ?shot=storm  → storm mission, autopilot, lightning + rain
// ?shot=fog    → fog mission, autopilot toward the runway
// ?shot=menu   → the title screen over the drifting city
function setupShotMode() {
  if (!shotMode) return;
  if (shotMode === 'menu') {
    game.screen = 'menu';
    return;
  }
  const missionIndex = shotMode === 'storm' ? 1 : shotMode === 'fog' ? 2 : 0;
  startMission(missionIndex);
  game.auto = true;
  game.autoUntil = shotAt;
  window.__nightMailReady = false;
}

// --- Main loop ---------------------------------------------------------------

let last = performance.now();
let shotDone = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const pressed = input.consumePressed();
  handleKeys(pressed);
  handleClick(input.consumeClick());
  if (game.screen === 'flying') step(dt);
  else game.time += dt;

  if (game.screen === 'menu') drawMenu();
  else if (game.screen === 'done') drawDone();
  else render(ctx, screenW, screenH, game, game.time);

  // In screenshot mode the page signals readiness once the autopilot has
  // flown long enough for a good frame.
  if (shotMode && shotMode !== 'menu' && !shotDone && game.time >= game.autoUntil) {
    shotDone = true;
    window.__nightMailReady = true;
    document.title = 'READY';
  }
  if (shotMode === 'menu' && !shotDone && game.time > 2) {
    shotDone = true;
    window.__nightMailReady = true;
    document.title = 'READY';
  }
  requestAnimationFrame(frame);
}

// Debug hook for automated play-testing: read-only snapshot of the game.
// Invisible in play; lets a headless browser prove a mission is winnable.
window.__nightMailDebug = () => ({
  screen: game.screen,
  mission: game.mission.id,
  x: Math.round(game.plane.x),
  y: Math.round(game.plane.y),
  z: Math.round(game.plane.z),
  speed: Math.round(game.plane.speed),
  fuel: Math.round(game.plane.fuel),
  score: game.missionState.score,
  rings: game.missionState.ringsPassed,
  crashed: game.plane.crashed,
  landed: game.plane.landed,
  finished: game.missionState.finished,
  reason: game.missionState.finishedReason,
});

setupShotMode();
requestAnimationFrame(frame);
