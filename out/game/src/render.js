// Ember Ridge Airlift — renderer.
// Draws terrain, aircraft, rings, HUD, and panels to a canvas.
// Pure drawing logic; no game state mutation.

import { FIELD, WORLD, RINGS, HUD, CAMERA, MISSIONS } from '../config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_MISSION_COMPLETE = 'mission_complete';

function createGradient(ctx, x, y, w, h, stops) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  return grad;
}

function drawMountain(ctx, m, camX, camZ, scale, parallax) {
  const screenX = (m.x - camX * parallax) * scale + FIELD.width * 0.5;
  const baseScreenY = FIELD.horizonY + (m.baseY * 0.3 - camZ * parallax) * scale * 0.5;
  const screenWidth = m.width * scale * (0.5 + parallax * 0.5);

  if (screenX + screenWidth < 0 || screenX - screenWidth > FIELD.width) return;

  ctx.beginPath();
  ctx.moveTo(screenX - screenWidth, FIELD.height);
  const peakX = screenX;
  const peakY = baseScreenY - m.baseY * scale * 0.3 * parallax;
  ctx.quadraticCurveTo(peakX, peakY, screenX + screenWidth, FIELD.height);
  ctx.closePath();

  const grad = createGradient(ctx, 0, peakY, 0, FIELD.height, [
    [0, m.color],
    [1, '#0d1b2a'],
  ]);
  ctx.fillStyle = grad;
  ctx.fill();

  // Snow caps on higher peaks
  if (m.baseY > 1000) {
    ctx.beginPath();
    ctx.moveTo(peakX - screenWidth * 0.15, peakY + 20);
    ctx.lineTo(peakX, peakY - 10);
    ctx.lineTo(peakX + screenWidth * 0.15, peakY + 20);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }
}

function drawRiver(ctx, river, camX, camZ, scale) {
  ctx.beginPath();
  let first = true;
  for (const r of river) {
    const screenX = (r.x - camX) * scale + FIELD.width * 0.5;
    const screenY = (r.z - camZ) * scale * 0.5 + FIELD.horizonY;
    const screenW = r.width * scale;

    if (screenY > FIELD.height) continue;
    if (screenY < -100) continue;

    if (first) {
      ctx.moveTo(screenX - screenW, screenY);
      first = false;
    } else {
      ctx.lineTo(screenX - screenW, screenY);
    }
  }
  for (let i = river.length - 1; i >= 0; i--) {
    const r = river[i];
    const screenX = (r.x - camX) * scale + FIELD.width * 0.5;
    const screenY = (r.z - camZ) * scale * 0.5 + FIELD.horizonY;
    const screenW = r.width * scale;
    if (screenY > FIELD.height) continue;
    ctx.lineTo(screenX + screenW, screenY);
  }
  ctx.closePath();

  // Water
  const waterGrad = createGradient(ctx, 0, FIELD.horizonY, 0, FIELD.height, [
    [0, WORLD.riverWater],
    [1, '#081522'],
  ]);
  ctx.fillStyle = waterGrad;
  ctx.fill();

  // Reflection highlight
  ctx.beginPath();
  first = true;
  for (const r of river) {
    const screenX = (r.x - camX) * scale + FIELD.width * 0.5;
    const screenY = (r.z - camZ) * scale * 0.5 + FIELD.horizonY;
    const screenW = r.width * scale * 0.3;
    if (screenY > FIELD.height || screenY < -100) continue;
    if (first) { ctx.moveTo(screenX - screenW, screenY); first = false; }
    else ctx.lineTo(screenX - screenW, screenY);
  }
  for (let i = river.length - 1; i >= 0; i--) {
    const r = river[i];
    const screenX = (r.x - camX) * scale + FIELD.width * 0.5;
    const screenY = (r.z - camZ) * scale * 0.5 + FIELD.horizonY;
    const screenW = r.width * scale * 0.3;
    if (screenY > FIELD.height || screenY < -100) continue;
    ctx.lineTo(screenX + screenW, screenY);
  }
  ctx.closePath();
  ctx.fillStyle = WORLD.riverReflection;
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawVillage(ctx, v, camX, camZ, scale) {
  const screenX = (v.x - camX) * scale + FIELD.width * 0.5;
  const screenY = (v.z - camZ) * scale * 0.5 + FIELD.horizonY;
  const size = v.size * scale;

  if (screenY > FIELD.height + 50 || screenY < -50) return;
  if (screenX < -50 || screenX > FIELD.width + 50) return;

  // Simple buildings
  const buildingCount = v.buildingCount;
  const buildingWidth = size / buildingCount * 0.8;
  for (let i = 0; i < buildingCount; i++) {
    const bx = screenX - size * 0.5 + i * (size / buildingCount) + (size / buildingCount - buildingWidth) * 0.5;
    const bh = buildingWidth * (0.8 + Math.sin(v.seed + i) * 0.4);
    const by = screenY - bh;

    // Walls
    ctx.fillStyle = WORLD.villageWall;
    ctx.fillRect(bx, by, buildingWidth, bh);

    // Roof
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.lineTo(bx + buildingWidth * 0.5, by - buildingWidth * 0.4);
    ctx.lineTo(bx + buildingWidth + 2, by);
    ctx.closePath();
    ctx.fillStyle = WORLD.villageRoof;
    ctx.fill();
  }
}

function drawAirstrip(ctx, a, camX, camZ, scale, isActive) {
  const cosH = Math.cos(a.heading);
  const sinH = Math.sin(a.heading);
  const halfLen = a.length * 0.5 * scale;
  const halfWid = a.width * 0.5 * scale;

  const corners = [
    { x: -halfLen, z: -halfWid },
    { x: halfLen, z: -halfWid },
    { x: halfLen, z: halfWid },
    { x: -halfLen, z: halfWid },
  ].map(c => ({
    x: (a.x + c.x * cosH - c.z * sinH - camX) * scale + FIELD.width * 0.5,
    y: (a.z + c.x * sinH + c.z * cosH - camZ) * scale * 0.5 + FIELD.horizonY,
  }));

  // Check visibility
  let visible = false;
  for (const c of corners) {
    if (c.y > -50 && c.y < FIELD.height + 50 && c.x > -50 && c.x < FIELD.width + 50) {
      visible = true;
      break;
    }
  }
  if (!visible) return;

  // Surface
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = isActive ? '#3a6a3a' : WORLD.airstripSurface;
  ctx.fill();

  // Markings
  ctx.strokeStyle = WORLD.airstripMarking;
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.moveTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.stroke();

  // Center line
  ctx.setLineDash([20 * scale, 15 * scale]);
  ctx.beginPath();
  ctx.moveTo((corners[0].x + corners[3].x) * 0.5, (corners[0].y + corners[3].y) * 0.5);
  ctx.lineTo((corners[1].x + corners[2].x) * 0.5, (corners[1].y + corners[2].y) * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Threshold numbers
  ctx.fillStyle = WORLD.airstripMarking;
  ctx.font = `${Math.max(10, 14 * scale)}px ${HUD.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) * 0.25;
  const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) * 0.25;
  ctx.fillText(`${a.id + 1}`, cx, cy);
}

function drawRing(ctx, ring, camX, camZ, camYaw, camPitch, scale) {
  // Project ring center to screen
  const dx = ring.x - camX;
  const dy = ring.y - camZ * 0.5; // Z is forward, but camera Y is up
  const dz = ring.z - camZ;

  // Rotate by camera yaw
  const cosYaw = Math.cos(-camYaw);
  const sinYaw = Math.sin(-camYaw);
  const rx = dx * cosYaw - dz * sinYaw;
  const rz = dx * sinYaw + dz * cosYaw;

  if (rz <= 1) return; // Behind camera

  // Simple perspective projection
  const fov = CAMERA.fov * Math.PI / 180;
  const focal = FIELD.width * 0.5 / Math.tan(fov * 0.5);
  const screenX = rx * focal / rz + FIELD.width * 0.5;
  const screenY = FIELD.height * 0.5 - (dy - camYaw * 10) * focal / rz; // Approximate

  if (screenX < -100 || screenX > FIELD.width + 100 ||
      screenY < -100 || screenY > FIELD.height + 100) return;

  // Ring appears as ellipse based on view angle
  const ringRadius = ring.radius * focal / rz * scale;
  const ringThickness = Math.max(1, ring.thickness * focal / rz * scale);

  // Tilt based on camera pitch
  const tilt = Math.sin(camPitch) * 0.5;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(1, 0.5 + tilt * 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.lineWidth = ringThickness;
  ctx.strokeStyle = ring.passed ? '#444' : ring.color;
  ctx.stroke();

  // Glow when not passed
  if (!ring.passed) {
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawAircraft(ctx, state, camX, camZ, scale, shakeX, shakeY) {
  // Draw aircraft as a simple bush plane silhouette in chase view
  // Since we're in chase view, the aircraft is at a fixed screen position relative to camera

  const screenX = FIELD.width * 0.5 + shakeX;
  const screenY = FIELD.height * 0.55 + shakeY; // Slightly below center

  const roll = state.roll;
  const size = 40 * scale;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(roll);

  // Fuselage
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.2);
  ctx.lineTo(-size * 0.15, -size * 0.3);
  ctx.lineTo(-size * 0.25, size * 0.5);
  ctx.lineTo(size * 0.25, size * 0.5);
  ctx.lineTo(size * 0.15, -size * 0.3);
  ctx.closePath();
  ctx.fillStyle = '#c8d0d8';
  ctx.fill();
  ctx.strokeStyle = '#6a7a8a';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  // Wings
  ctx.beginPath();
  ctx.moveTo(-size * 1.5, -size * 0.1);
  ctx.lineTo(-size * 0.25, -size * 0.05);
  ctx.lineTo(-size * 0.3, size * 0.3);
  ctx.lineTo(-size * 1.4, size * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#b8c0c8';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 1.5, -size * 0.1);
  ctx.lineTo(size * 0.25, -size * 0.05);
  ctx.lineTo(size * 0.3, size * 0.3);
  ctx.lineTo(size * 1.4, size * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#b8c0c8';
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, size * 0.5);
  ctx.lineTo(-size * 0.8, size * 1.1);
  ctx.lineTo(size * 0.8, size * 1.1);
  ctx.lineTo(size * 0.4, size * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#a8b0b8';
  ctx.fill();
  ctx.stroke();

  // Vertical stabilizer
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(0, size * 1.2);
  ctx.lineTo(size * 0.2, size * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#a8b0b8';
  ctx.fill();
  ctx.stroke();

  // Propeller disk (animated)
  const propAlpha = 0.3 + Math.abs(state.throttle) * 0.5;
  ctx.beginPath();
  ctx.arc(0, -size * 1.3, size * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(60,60,70,${propAlpha})`;
  ctx.fill();

  ctx.restore();
}

function drawHUD(ctx, state, instruments, mission, screen, messages) {
  const padding = 20;
  const lineH = 24;
  let y = padding;

  // Background panels
  ctx.fillStyle = HUD.panelBg;

  // Left panel - Flight instruments
  const leftW = 220;
  const leftH = 280;
  ctx.fillRect(padding, padding, leftW, leftH);
  ctx.strokeStyle = HUD.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, padding, leftW, leftH);

  ctx.font = HUD.font;
  ctx.fillStyle = HUD.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Altitude
  ctx.fillText(`ALT ${Math.round(instruments.alt).toLocaleString()} m`, padding + 10, y);
  y += lineH;

  // Airspeed
  const iasColor = instruments.ias < 40 ? HUD.colorDanger : HUD.color;
  ctx.fillStyle = iasColor;
  ctx.fillText(`IAS ${Math.round(instruments.ias)} km/h`, padding + 10, y);
  ctx.fillStyle = HUD.color;
  y += lineH;

  // Vertical speed
  const vsColor = instruments.vs < -500 ? HUD.colorDanger : instruments.vs > 500 ? HUD.colorWarn : HUD.color;
  ctx.fillStyle = vsColor;
  const vsSign = instruments.vs >= 0 ? '+' : '';
  ctx.fillText(`VS ${vsSign}${Math.round(instruments.vs)} m/min`, padding + 10, y);
  ctx.fillStyle = HUD.color;
  y += lineH;

  // Heading
  ctx.fillText(`HDG ${Math.round(instruments.hdg).toString().padStart(3, '0')}°`, padding + 10, y);
  y += lineH;

  // Attitude indicator (mini)
  y += 8;
  const attX = padding + 10;
  const attY = y;
  const attSize = 60;
  ctx.strokeStyle = HUD.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(attX + attSize * 0.5, attY + attSize * 0.5, attSize * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // Horizon line
  ctx.save();
  ctx.translate(attX + attSize * 0.5, attY + attSize * 0.5);
  ctx.rotate(instruments.att.roll);
  ctx.strokeStyle = HUD.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-attSize * 0.4, -instruments.att.pitch * 30);
  ctx.lineTo(attSize * 0.4, -instruments.att.pitch * 30);
  ctx.stroke();
  ctx.restore();

  // Pitch ladder marks
  for (let p = -30; p <= 30; p += 10) {
    const py = attY + attSize * 0.5 - p * 30 * Math.cos(instruments.att.roll);
    const px = attX + attSize * 0.5 + p * 30 * Math.sin(instruments.att.roll);
    ctx.strokeStyle = HUD.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 10, py);
    ctx.lineTo(px + 10, py);
    ctx.stroke();
  }

  y += attSize + 10;

  // Throttle
  ctx.fillText(`THR ${Math.round(instruments.thr * 100)}%`, padding + 10, y);
  y += lineH;

  // Fuel
  const fuelPct = instruments.fuel / 450 * 100;
  const fuelColor = fuelPct < 20 ? HUD.colorDanger : fuelPct < MISSIONS.fuelWarning ? HUD.colorWarn : HUD.color;
  ctx.fillStyle = fuelColor;
  ctx.fillText(`FUEL ${Math.round(fuelPct)}%`, padding + 10, y);
  ctx.fillStyle = HUD.color;
  y += lineH;

  // Health
  const hpColor = instruments.hp < 30 ? HUD.colorDanger : instruments.hp < 60 ? HUD.colorWarn : HUD.color;
  ctx.fillStyle = hpColor;
  ctx.fillText(`HP ${Math.round(instruments.hp)}%`, padding + 10, y);
  ctx.fillStyle = HUD.color;

  // Right panel - Mission info
  const rightX = FIELD.width - padding - 280;
  const rightW = 280;
  let rightY = padding;

  if (mission) {
    ctx.fillStyle = HUD.panelBg;
    ctx.fillRect(rightX, rightY, rightW, 180);
    ctx.strokeStyle = HUD.border;
    ctx.strokeRect(rightX, rightX, rightW, 180);

    ctx.font = HUD.fontLarge;
    ctx.fillStyle = HUD.color;
    ctx.textAlign = 'left';
    ctx.fillText(mission.type, rightX + 15, rightY + 25);
    ctx.font = HUD.font;
    ctx.fillText(mission.description, rightX + 15, rightY + 55);

    // Progress
    if (mission.type === 'RINGS') {
      const progress = mission.rings.getProgress();
      ctx.fillText(`Rings: ${progress.passed}/${progress.total}`, rightX + 15, rightY + 85);
    } else if (mission.type === 'DELIVER') {
      ctx.fillText(`Target: Airstrip ${mission.targetStrip.id + 1}`, rightX + 15, rightY + 85);
    } else if (mission.type === 'SURVEY') {
      ctx.fillText(`Target: Village survey`, rightX + 15, rightY + 85);
    }

    // Time remaining
    const timeColor = mission.timeRemaining < 30 ? HUD.colorDanger : HUD.colorWarn;
    ctx.fillStyle = timeColor;
    ctx.fillText(`TIME ${Math.ceil(mission.timeRemaining)}s`, rightX + 15, rightY + 115);
    ctx.fillStyle = HUD.color;

    // Next mission preview
    const progress = mission.getProgress ? mission.getProgress() : { current: 0, total: 0 };
    ctx.font = '12px ' + HUD.font;
    ctx.fillStyle = HUD.color;
    ctx.fillText(`Mission ${progress.current}/${progress.total}  |  Score: ${progress.score}`, rightX + 15, rightY + 145);
  }

  // Messages (top center)
  if (messages.length > 0) {
    ctx.font = HUD.fontLarge;
    ctx.textAlign = 'center';
    for (let i = 0; i < Math.min(3, messages.length); i++) {
      const msg = messages[i];
      const alpha = Math.max(0, 1 - (Date.now() - msg.time) / 4000);
      ctx.fillStyle = `rgba(232, 244, 253, ${alpha})`;
      ctx.fillText(msg.text, FIELD.width * 0.5, 80 + i * 30);
    }
  }

  // Turn coordinator (bottom center)
  const tcX = FIELD.width * 0.5;
  const tcY = FIELD.height - 60;
  const tcSize = 80;
  ctx.strokeStyle = HUD.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tcX, tcY, tcSize * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Ball
  const ballX = tcX + Math.sin(state.roll) * tcSize * 0.3;
  const ballY = tcY - Math.sin(state.pitch) * tcSize * 0.2;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcc00';
  ctx.fill();
}

function drawPanel(ctx, title, lines, prompt, subtext) {
  const panelW = 600;
  const lineH = 32;
  const panelH = 120 + lines.length * lineH + (subtext ? 40 : 0);
  const x = (FIELD.width - panelW) * 0.5;
  const y = (FIELD.height - panelH) * 0.5;

  ctx.fillStyle = 'rgba(13, 27, 42, 0.95)';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = HUD.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.font = '36px ' + HUD.font;
  ctx.fillStyle = HUD.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(title, FIELD.width * 0.5, y + 40);

  ctx.font = HUD.font;
  ctx.fillStyle = '#8b93a3';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], FIELD.width * 0.5, y + 100 + i * lineH);
  }

  if (subtext) {
    ctx.font = '14px ' + HUD.font;
    ctx.fillStyle = '#6b7a8a';
    ctx.fillText(subtext, FIELD.width * 0.5, y + 100 + lines.length * lineH + 10);
  }

  ctx.font = '20px ' + HUD.font;
  ctx.fillStyle = '#ffcc00';
  ctx.fillText(prompt, FIELD.width * 0.5, y + panelH - 50);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let shakeX = 0;
  let shakeY = 0;
  let shakeIntensity = 0;
  const messages = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function addMessage(text) {
    messages.push({ text, time: Date.now() });
    if (messages.length > 10) messages.shift();
  }

  function drawSky(ctx, camPitch, timeOfDay) {
    // Sky gradient
    const grad = createGradient(ctx, 0, 0, 0, FIELD.horizonY, [
      [0, WORLD.skyTop],
      [0.6, WORLD.skyHorizon],
      [1, WORLD.skyGlow],
    ]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.horizonY);

    // Sun glow
    const sunX = FIELD.width * 0.8;
    const sunY = FIELD.horizonY * 0.3;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 200);
    sunGrad.addColorStop(0, 'rgba(255, 150, 50, 0.4)');
    sunGrad.addColorStop(1, 'rgba(255, 100, 30, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 200, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround(ctx) {
    // Ground plane below horizon
    const grad = createGradient(ctx, 0, FIELD.horizonY, 0, FIELD.height, [
      [0, '#1a2a3a'],
      [1, '#0d1520'],
    ]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, FIELD.horizonY, FIELD.width, FIELD.height - FIELD.horizonY);
  }

  function draw(state, screen, mission, bestScore) {
    const cam = state.camera || { x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch };
    const camX = cam.x;
    const camY = cam.y;
    const camZ = cam.z;
    const camYaw = cam.yaw;
    const camPitch = cam.pitch;

    // Update shake
    if (shakeIntensity > 0.5) {
      shakeX = (Math.random() - 0.5) * shakeIntensity * 20;
      shakeY = (Math.random() - 0.5) * shakeIntensity * 20;
      shakeIntensity *= CAMERA.shakeDecay;
    } else {
      shakeX = 0;
      shakeY = 0;
      shakeIntensity = 0;
    }

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale for logical resolution
    const ratio = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const scale = ratio;
    const offsetX = (canvas.width - FIELD.width * scale) * 0.5;
    const offsetY = (canvas.height - FIELD.height * scale) * 0.5;

    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // Draw sky and ground
    drawSky(ctx, camPitch, 0);
    drawGround(ctx);

    // Draw terrain (far to near)
    if (state.terrain) {
      // Far mountains
      for (const m of state.terrain.mountains) {
        if (m.parallax < 0.45) drawMountain(ctx, m, camX, camZ, scale, m.parallax);
      }
      // River
      drawRiver(ctx, state.terrain.river, camX, camZ, scale);
      // Mid mountains
      for (const m of state.terrain.mountains) {
        if (m.parallax >= 0.45 && m.parallax < 0.65) drawMountain(ctx, m, camX, camZ, scale, m.parallax);
      }
      // Villages
      for (const v of state.terrain.villages) {
        drawVillage(ctx, v, camX, camZ, scale);
      }
      // Airstrips
      for (const a of state.terrain.airstrips) {
        const active = mission && mission.type === 'DELIVER' && mission.targetStrip.id === a.id;
        drawAirstrip(ctx, a, camX, camZ, scale, active);
      }
      // Near mountains
      for (const m of state.terrain.mountains) {
        if (m.parallax >= 0.65) drawMountain(ctx, m, camX, camZ, scale, m.parallax);
      }
    }

    // Draw rings
    if (state.rings && (mission?.type === 'RINGS' || screen === SCREEN_PLAY)) {
      for (const ring of state.rings.rings) {
        drawRing(ctx, ring, camX, camZ, camYaw, camPitch, scale);
      }
    }

    // Draw aircraft (chase view)
    drawAircraft(ctx, state, camX, camZ, scale, shakeX, shakeY);

    // Draw HUD
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHUD(ctx, state, state.instruments || {}, mission, screen, messages);
    }

    // Screen overlays
    if (screen === SCREEN_TITLE) {
      drawPanel(ctx, 'EMBER RIDGE AIRLIFT', [
        'Bush pilot operations in the Ember Ridge valley.',
        'Deliver cargo • Fly the rings • Survey the land',
        '',
        'Controls: WASD / Arrows = Pitch & Roll, Q/E = Yaw',
        'Shift/Ctrl = Throttle, F = Flaps, G = Gear',
        'Mouse = Freelook (click to lock), C = Camera toggle',
        'P = Pause, R = Restart',
      ], 'Click or press SPACE to start', 'An original flight game for make.fun');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel(ctx, 'PAUSED', [
        'The valley waits for your return.',
        `Fuel: ${Math.round(state.instruments?.fuel || 0)}%  |  Health: ${Math.round(state.instruments?.hp || 0)}%`,
      ], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        `Final Score: ${Math.round(state.finalScore || 0)}`,
        `Missions: ${state.missionsCompleted || 0} completed`,
        `Best: ${bestScore || 0}`,
      ];
      if (state.crashed) lines.unshift('AIRCRAFT LOST');
      drawPanel(ctx, state.crashed ? 'CRASH' : 'MISSION COMPLETE', lines, 'Press R to fly again');
    } else if (screen === SCREEN_MISSION_COMPLETE) {
      drawPanel(ctx, 'ALL MISSIONS COMPLETE', [
        `Total Score: ${Math.round(state.finalScore || 0)}`,
        `Deliveries: ${state.deliveredCount || 0}`,
        `Rings: ${state.ringsPassed || 0}`,
        `Surveys: ${state.surveyedCount || 0}`,
        `Best: ${bestScore || 0}`,
      ], 'Press R for a new career', 'Ember Ridge thanks you, pilot.');
    }

    // Clean up old messages
    const now = Date.now();
    while (messages.length > 0 && now - messages[0].time > 5000) {
      messages.shift();
    }
  }

  function triggerShake(intensity) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
  }

  resize();
  window.addEventListener('resize', resize);

  return { draw, addMessage, triggerShake };
}