// Night Mail Run — the canvas renderer.
// One clear job: draw everything the pilot sees — sky, city, plane,
// rings, runway, weather and the lit instrument panel — from game state.
// It never changes game state.

import { PALETTE, WORLD } from './config.js';
import { project } from './city.js';
import { headingDegrees } from './plane.js';
import { nextRing, lightningAge } from './missions.js';

const TAU = Math.PI * 2;

// Stars are fixed in the sky dome so the night feels stable.
function makeStars() {
  const stars = [];
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 170; i++) {
    stars.push({ x: rnd(), y: rnd() * 0.42, r: 0.4 + rnd() * 1.3, tw: rnd() * TAU });
  }
  return stars;
}
const STARS = makeStars();

export function render(ctx, w, h, game, time) {
  const { plane, city, missionState, mission } = game;
  const horizonY = h * WORLD.horizonFraction;
  drawSky(ctx, w, h, horizonY, time, mission);
  drawMoon(ctx, w, h, time);
  drawCity(ctx, w, h, game, horizonY, time);
  if (mission.id === 'fog') drawRunway(ctx, w, h, game, horizonY);
  drawRings(ctx, w, h, game, horizonY);
  drawPlane(ctx, w, h, plane, time);
  drawWeather(ctx, w, h, game, time);
  // The menu backdrop flies on its own: no instrument panel over the title.
  if (game.screen !== 'menu') drawHud(ctx, w, h, game, time);
}

function drawSky(ctx, w, h, horizonY, time, mission) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY * 1.25);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.62, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.horizonGlowSoft);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY * 1.25);
  // Horizon glow band where the city lights meet the sky.
  const glow = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY + 40);
  glow.addColorStop(0, 'rgba(232,128,58,0)');
  glow.addColorStop(0.55, 'rgba(232,128,58,0.28)');
  glow.addColorStop(1, 'rgba(232,128,58,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizonY - 60, w, 100);
  // Stars, twinkling slowly.
  for (const s of STARS) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.7 + s.tw));
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = PALETTE.star;
    ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  // Far ground haze below the horizon.
  ctx.fillStyle = '#070a16';
  ctx.fillRect(0, horizonY, w, h - horizonY);
}

function drawMoon(ctx, w, h, time) {
  const mx = w * 0.78;
  const my = h * 0.13;
  const r = 30;
  const glow = ctx.createRadialGradient(mx, my, r * 0.4, mx, my, r * 3.2);
  glow.addColorStop(0, 'rgba(244,234,208,0.5)');
  glow.addColorStop(1, 'rgba(244,234,208,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx - r * 3.2, my - r * 3.2, r * 6.4, r * 6.4);
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,160,120,0.5)';
  ctx.beginPath();
  ctx.arc(mx - 9, my - 5, 6, 0, TAU);
  ctx.arc(mx + 8, my + 9, 4, 0, TAU);
  ctx.fill();
}

// The city: streets as glowing lines on the ground plane, buildings as
// lit boxes, drawn far-to-near so nearer roofs cover farther streets.
function drawCity(ctx, w, h, game, horizonY, time) {
  const { plane, city, mission } = game;
  const camera = { x: plane.x, y: plane.y, z: plane.z };
  const fog = mission.fog;

  // Streets: a glowing grid on the ground, brighter near the plane.
  ctx.lineWidth = 1;
  for (let gz = Math.floor((plane.z + 60) / WORLD.blockSize); gz < (plane.z + WORLD.viewDistance) / WORLD.blockSize; gz++) {
    const z = gz * WORLD.blockSize;
    const depth = z - plane.z;
    if (depth < 40) continue;
    const distanceFade = Math.max(0, 1 - depth / WORLD.viewDistance);
    const fogFade = fog > 0 ? Math.max(0.1, 1 - (depth / WORLD.viewDistance) * fog * 1.5) : 1;
    const fade = distanceFade * fogFade;
    const left = project(camera, -1600, 0, z, w, h);
    const right = project(camera, 1600, 0, z, w, h);
    if (!left || !right) continue;
    ctx.strokeStyle = 'rgba(255,179,71,' + (0.22 * fade + 0.04) + ')';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
  for (let gx = -11; gx <= 11; gx++) {
    const x = gx * WORLD.blockSize;
    const near = project(camera, x, 0, plane.z + 60, w, h);
    const far = project(camera, x, 0, plane.z + WORLD.viewDistance, w, h);
    if (!near || !far) continue;
    ctx.strokeStyle = 'rgba(127,212,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(near.x, near.y);
    ctx.lineTo(far.x, far.y);
    ctx.stroke();
  }

  // The river: a dark band with a cold moonlit sheen, west of the route.
  drawRiver(ctx, w, h, game, horizonY);

  // Buildings, far to near.
  const bzStart = Math.floor((plane.z + 40) / WORLD.blockSize);
  const bzEnd = Math.floor((plane.z + WORLD.viewDistance) / WORLD.blockSize);
  for (let bz = bzEnd; bz >= bzStart; bz--) {
    for (let bx = -10; bx <= 10; bx++) {
      for (const b of city.blockAt(bx, bz)) {
        drawBuilding(ctx, w, h, game, b, horizonY);
      }
    }
  }
  // Landmark towers with red aviation beacons.
  for (const t of city.towers) {
    drawTower(ctx, w, h, game, t, horizonY, time);
  }
}

function drawRiver(ctx, w, h, game, horizonY) {
  const { plane, city } = game;
  const camera = { x: plane.x, y: plane.y, z: plane.z };
  const x0 = city.RIVER_X - city.RIVER_HALF;
  const x1 = city.RIVER_X + city.RIVER_HALF;
  const near0 = project(camera, x0, 0, plane.z + 60, w, h);
  const near1 = project(camera, x1, 0, plane.z + 60, w, h);
  const far0 = project(camera, x0, 0, plane.z + WORLD.viewDistance, w, h);
  const far1 = project(camera, x1, 0, plane.z + WORLD.viewDistance, w, h);
  if (!near0 || !near1 || !far0 || !far1) return;
  ctx.fillStyle = 'rgba(38,68,110,0.55)';
  ctx.beginPath();
  ctx.moveTo(near0.x, near0.y);
  ctx.lineTo(near1.x, near1.y);
  ctx.lineTo(far1.x, far1.y);
  ctx.lineTo(far0.x, far0.y);
  ctx.closePath();
  ctx.fill();
  // Moonlight shimmer on the water.
  ctx.strokeStyle = 'rgba(244,234,208,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const z = plane.z + 300 + i * 320;
    const a = project(camera, city.RIVER_X - 40, 0, z, w, h);
    const b = project(camera, city.RIVER_X + 40, 0, z, w, h);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawBuilding(ctx, w, h, game, b, horizonY) {
  const { plane, mission } = game;
  const camera = { x: plane.x, y: plane.y, z: plane.z };
  const depth = b.z - plane.z;
  if (depth < 20 || depth > WORLD.viewDistance) return;
  const base = project(camera, b.x, 0, b.z, w, h);
  const top = project(camera, b.x, b.height, b.z, w, h);
  if (!base || !top) return;
  const halfW = (b.w / 2) * base.scale;
  const halfD = (b.d / 2) * base.scale;
  if (base.x + halfW < -40 || base.x - halfW > w + 40) return;
  const fogFade = mission.fog > 0 ? Math.max(0.12, 1 - (depth / WORLD.viewDistance) * mission.fog * 1.6) : 1;
  ctx.globalAlpha = fogFade;
  // Roof face.
  ctx.fillStyle = PALETTE.buildingLit;
  ctx.fillRect(base.x - halfW, top.y, halfW * 2, base.y - top.y);
  // Side face, slightly darker, for depth.
  ctx.fillStyle = PALETTE.buildingDark;
  ctx.beginPath();
  ctx.moveTo(base.x + halfW, top.y);
  ctx.lineTo(base.x + halfW + halfD * 0.5, top.y + halfD * 0.3);
  ctx.lineTo(base.x + halfW + halfD * 0.5, base.y + halfD * 0.3);
  ctx.lineTo(base.x + halfW, base.y);
  ctx.closePath();
  ctx.fill();
  // Lit windows on the front face.
  const winW = Math.max(2, (halfW * 2) / b.cols - 3);
  const winH = Math.max(2, (base.y - top.y) / b.rows - 3);
  for (const win of b.windows) {
    const wx = base.x - halfW + 4 + (win.c + 0.5) * ((halfW * 2 - 8) / b.cols);
    const wy = top.y + 4 + (win.r + 0.5) * ((base.y - top.y - 8) / b.rows);
    ctx.fillStyle = win.warm ? PALETTE.windowWarm : PALETTE.windowCool;
    ctx.globalAlpha = fogFade * 0.9;
    ctx.fillRect(wx - winW / 2, wy - winH / 2, winW, winH);
  }
  ctx.globalAlpha = 1;
}

function drawTower(ctx, w, h, game, t, horizonY, time) {
  const { plane, mission, city } = game;
  if (city.inApproachCorridor(t.x, t.z)) return; // the approach stays clear
  const camera = { x: plane.x, y: plane.y, z: plane.z };
  const depth = t.z - plane.z;
  if (depth < 20 || depth > WORLD.viewDistance) return;
  const base = project(camera, t.x, 0, t.z, w, h);
  const top = project(camera, t.x, t.height, t.z, w, h);
  if (!base || !top) return;
  const halfW = 26 * base.scale;
  if (base.x + halfW < -40 || base.x - halfW > w + 40) return;
  ctx.fillStyle = '#101830';
  ctx.fillRect(base.x - halfW, top.y, halfW * 2, base.y - top.y);
  ctx.fillStyle = 'rgba(255,210,122,0.8)';
  for (let i = 0; i < 6; i++) {
    const wy = top.y + ((base.y - top.y) * (i + 0.5)) / 6;
    ctx.fillRect(base.x - halfW + 3, wy, halfW * 2 - 6, 2);
  }
  if (t.beacon) {
    const blink = Math.sin(time * 2.4 + t.x) > 0;
    if (blink) {
      ctx.fillStyle = '#ff5a4a';
      ctx.shadowColor = '#ff5a4a';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(base.x, top.y - 4, 5, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// The harbour runway: edge lights, centre line and threshold bars.
function drawRunway(ctx, w, h, game, horizonY) {
  const { plane, city } = game;
  const camera = { x: plane.x, y: plane.y, z: plane.z };
  const r = city.runway;
  const near = project(camera, r.x, 0, Math.max(r.zStart, plane.z + 30), w, h);
  const far = project(camera, r.x, 0, r.zEnd, w, h);
  if (!near || !far) return;
  const nearHalf = (r.width / 2) * near.scale;
  const farHalf = (r.width / 2) * far.scale;
  ctx.fillStyle = 'rgba(20,26,44,0.9)';
  ctx.beginPath();
  ctx.moveTo(near.x - nearHalf, near.y);
  ctx.lineTo(near.x + nearHalf, near.y);
  ctx.lineTo(far.x + farHalf, far.y);
  ctx.lineTo(far.x - farHalf, far.y);
  ctx.closePath();
  ctx.fill();
  // Edge lights and centre line, marching into the fog.
  for (let z = r.zStart; z <= r.zEnd; z += 120) {
    const depth = z - plane.z;
    if (depth < 30 || depth > WORLD.viewDistance) continue;
    const c = project(camera, r.x, 0, z, w, h);
    if (!c) continue;
    const half = (r.width / 2) * c.scale;
    const fade = Math.max(0.25, 1 - depth / WORLD.viewDistance);
    ctx.fillStyle = 'rgba(255,179,71,' + fade + ')';
    ctx.shadowColor = PALETTE.runwayEdge;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(c.x - half, c.y, 3.4, 0, TAU);
    ctx.arc(c.x + half, c.y, 3.4, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,' + fade * 0.8 + ')';
    ctx.fillRect(c.x - 2, c.y - 1, 4, 2);
  }
}

// Beacon rings float on the route; the next one glows gold, the rest green.
function drawRings(ctx, w, h, game, horizonY) {
  const { plane, missionState } = game;
  const camera = { x: plane.x, y: plane.y, z: plane.z };
  const ring = nextRing(missionState.rings);
  for (const r of missionState.rings) {
    const depth = r.z - plane.z;
    if (depth < 10 || depth > WORLD.viewDistance) continue;
    const c = project(camera, r.x, r.y, r.z, w, h);
    if (!c) continue;
    const radius = r.radius * c.scale;
    if (radius < 2) continue;
    const isNext = ring === r;
    const colour = r.passed ? 'rgba(125,255,176,0.25)' : isNext ? PALETTE.beaconNext : PALETTE.beacon;
    ctx.strokeStyle = colour;
    ctx.lineWidth = isNext ? 5 : 3;
    ctx.shadowColor = colour;
    ctx.shadowBlur = isNext ? 26 : 14;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, radius, radius * 0.92, 0, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (isNext) {
      ctx.fillStyle = 'rgba(255,207,61,0.9)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEXT RING', c.x, c.y - radius - 12);
    }
  }
  // Fog approach beacons: small amber diamonds leading to the runway.
  for (const b of missionState.approach) {
    const depth = b.z - plane.z;
    if (depth < 10 || depth > WORLD.viewDistance) continue;
    const c = project(camera, b.x, b.y, b.z, w, h);
    if (!c) continue;
    ctx.fillStyle = b.passed ? 'rgba(125,255,176,0.4)' : PALETTE.hudAmber;
    ctx.shadowColor = PALETTE.hudAmber;
    ctx.shadowBlur = 12;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}

// The mail plane itself, seen from behind and slightly above: fuselage,
// wings, tail, glowing cockpit windows and blinking navigation lights.
function drawPlane(ctx, w, h, plane, time) {
  const cx = w / 2;
  const cy = h * 0.66;
  const scale = Math.min(w, h) / 900;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.55);
  ctx.scale(scale, scale);
  // Shadow of the plane on the city far below, faint.
  // Fuselage.
  ctx.fillStyle = '#c8ccd8';
  ctx.beginPath();
  ctx.moveTo(0, -118);
  ctx.quadraticCurveTo(26, -70, 22, 30);
  ctx.quadraticCurveTo(20, 96, 0, 108);
  ctx.quadraticCurveTo(-20, 96, -22, 30);
  ctx.quadraticCurveTo(-26, -70, 0, -118);
  ctx.fill();
  // Nose stripe and mail livery.
  ctx.fillStyle = '#e8803a';
  ctx.fillRect(-22, -18, 44, 10);
  ctx.fillStyle = '#274b8f';
  ctx.fillRect(-22, -6, 44, 6);
  // Glowing cockpit windows.
  ctx.fillStyle = '#bfe9ff';
  ctx.shadowColor = '#8fe3ff';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(-13, -86);
  ctx.lineTo(0, -96);
  ctx.lineTo(13, -86);
  ctx.lineTo(10, -70);
  ctx.lineTo(-10, -70);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Main wings.
  ctx.fillStyle = '#9aa0b4';
  ctx.beginPath();
  ctx.moveTo(-20, -30);
  ctx.lineTo(-150, 34);
  ctx.lineTo(-150, 52);
  ctx.lineTo(-20, 6);
  ctx.closePath();
  ctx.moveTo(20, -30);
  ctx.lineTo(150, 34);
  ctx.lineTo(150, 52);
  ctx.lineTo(20, 6);
  ctx.closePath();
  ctx.fill();
  // Tailplane.
  ctx.fillStyle = '#7d8296';
  ctx.beginPath();
  ctx.moveTo(-14, 78);
  ctx.lineTo(-62, 108);
  ctx.lineTo(-62, 120);
  ctx.lineTo(-14, 96);
  ctx.closePath();
  ctx.moveTo(14, 78);
  ctx.lineTo(62, 108);
  ctx.lineTo(62, 120);
  ctx.lineTo(14, 96);
  ctx.closePath();
  ctx.fill();
  // Tail fin with the night-mail star.
  ctx.fillStyle = '#274b8f';
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(-16, 138);
  ctx.lineTo(16, 138);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.arc(0, 122, 5, 0, TAU);
  ctx.fill();
  // Navigation lights: red port, green starboard, blinking white tail.
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = '#ff4a3d';
  ctx.shadowColor = '#ff4a3d';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(-150, 43, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#39ff9d';
  ctx.shadowColor = '#39ff9d';
  ctx.beginPath();
  ctx.arc(150, 43, 6, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 108, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Storm lightning flash, rain streaks and fog veil.
function drawWeather(ctx, w, h, game, time) {
  const { mission, missionState } = game;
  if (mission.weather === 'storm') {
    const age = lightningAge(missionState, time);
    if (age >= 0 && age < 0.28) {
      const strength = age < 0.08 ? 0.5 : 0.5 * (1 - (age - 0.08) / 0.2);
      ctx.fillStyle = 'rgba(220,230,255,' + strength.toFixed(3) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    // Rain streaks, slanted by the wind.
    ctx.strokeStyle = 'rgba(180,200,235,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137.5 + time * 340) % (w + 80)) - 40;
      const y = ((i * 89.3 + time * 620) % (h + 40)) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 9, y + 22);
    }
    ctx.stroke();
  }
  if (mission.fog > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(160,170,190,0)');
    g.addColorStop(0.45, 'rgba(160,170,190,' + (mission.fog * 0.28).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(160,170,190,' + (mission.fog * 0.5).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

// The instrument panel: artificial horizon, altitude, speed, heading,
// throttle, fuel, damage, mission objective and score — all lit.
function drawHud(ctx, w, h, game, time) {
  const { plane, mission, missionState } = game;
  const panelH = 118;
  const panelY = h - panelH;
  ctx.fillStyle = 'rgba(8,12,26,0.88)';
  ctx.fillRect(0, panelY, w, panelH);
  ctx.fillStyle = 'rgba(125,255,176,0.25)';
  ctx.fillRect(0, panelY, w, 1);

  // Mission title and objective.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.shadowColor = PALETTE.hudGreen;
  ctx.shadowBlur = 8;
  ctx.fillText('NIGHT MAIL RUN — ' + mission.name, 18, panelY + 24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c9d4ea';
  ctx.font = '12px system-ui, sans-serif';
  const ring = nextRing(missionState.rings);
  const objective =
    mission.id === 'fog'
      ? 'Find the runway — follow the amber beacons, land gentle.'
      : ring
        ? 'Ring ' + (missionState.ringsPassed + 1) + ' of ' + mission.rings + ' — ' + Math.round(Math.max(0, ring.z - plane.z)) + ' m ahead'
        : 'Route complete';
  ctx.fillText(objective, 18, panelY + 44);

  // Score, timer, rings.
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('SCORE ' + missionState.score, 18, panelY + 68);
  ctx.fillStyle = '#c9d4ea';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('TIME ' + formatTime(missionState.elapsed) + '   RINGS ' + missionState.ringsPassed + '/' + mission.rings, 18, panelY + 88);

  // Flash message centre screen.
  if (missionState.message && time < missionState.messageUntil) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.beaconNext;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.shadowColor = PALETTE.beaconNext;
    ctx.shadowBlur = 14;
    ctx.fillText(missionState.message, w / 2, h * 0.24);
    ctx.shadowBlur = 0;
  }

  // Artificial horizon (centre-left of the panel).
  drawArtificialHorizon(ctx, w / 2 - 190, panelY + 59, 44, plane);

  // Big readouts: altitude, speed, heading.
  drawReadout(ctx, w / 2 - 110, panelY + 30, 'ALT', Math.round(plane.y) + ' m', plane.y < 60 ? PALETTE.hudRed : PALETTE.hudGreen);
  drawReadout(ctx, w / 2 + 10, panelY + 30, 'SPEED', Math.round(plane.speed * 3.6) + ' km/h', plane.stalled ? PALETTE.hudRed : PALETTE.hudGreen);
  drawReadout(ctx, w / 2 + 130, panelY + 30, 'HDG', String(Math.round(headingDegrees(plane))).padStart(3, '0') + '°', PALETTE.hudCyan);
  drawReadout(ctx, w / 2 + 250, panelY + 30, 'V/S', (plane.verticalSpeed >= 0 ? '+' : '') + plane.verticalSpeed.toFixed(1) + ' m/s', '#c9d4ea');

  // Throttle lever.
  const tx = w - 250;
  ctx.fillStyle = '#c9d4ea';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR', tx, panelY + 24);
  ctx.fillStyle = '#1b2440';
  ctx.fillRect(tx + 34, panelY + 14, 110, 10);
  ctx.fillStyle = plane.fuel <= 0 ? PALETTE.hudRed : PALETTE.hudAmber;
  ctx.shadowColor = PALETTE.hudAmber;
  ctx.shadowBlur = 6;
  ctx.fillRect(tx + 34, panelY + 14, 110 * plane.throttle, 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#c9d4ea';
  ctx.fillText(Math.round(plane.throttle * 100) + '%', tx + 150, panelY + 24);

  // Fuel and damage bars.
  drawBar(ctx, tx, panelY + 44, 180, 'FUEL', plane.fuel / 100, plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudGreen);
  drawBar(ctx, tx, panelY + 68, 180, 'DMG', plane.damage / 100, plane.damage > 60 ? PALETTE.hudRed : PALETTE.hudAmber);

  // Stall warning.
  if (plane.stalled && !plane.crashed) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.shadowColor = PALETTE.hudRed;
    ctx.shadowBlur = 12;
    ctx.fillText('STALL — MORE THROTTLE', w / 2, h * 0.3);
    ctx.shadowBlur = 0;
  }
}

function drawArtificialHorizon(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank);
  const pitchPx = plane.pitch * 120;
  ctx.fillStyle = '#274b8f';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(-r, pitchPx, r * 2, r);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-r, pitchPx - 1, r * 2, 2);
  ctx.restore();
  ctx.strokeStyle = PALETTE.hudGreen;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx - 14, cy + 4);
  ctx.lineTo(cx + 14, cy + 4);
  ctx.closePath();
  ctx.fill();
}

function drawReadout(ctx, x, y, label, value, colour) {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b96b0';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = colour;
  ctx.font = 'bold 22px system-ui, monospace';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 8;
  ctx.fillText(value, x, y + 26);
  ctx.shadowBlur = 0;
}

function drawBar(ctx, x, y, width, label, fraction, colour) {
  ctx.fillStyle = '#c9d4ea';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + 10);
  ctx.fillStyle = '#1b2440';
  ctx.fillRect(x + 40, y, width, 10);
  ctx.fillStyle = colour;
  ctx.shadowColor = colour;
  ctx.shadowBlur = 6;
  ctx.fillRect(x + 40, y, Math.max(0, width * fraction), 10);
  ctx.shadowBlur = 0;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
