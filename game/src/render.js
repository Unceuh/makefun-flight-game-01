// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Flat
// vector art in one sunrise style: sky, sea, islands, a smoking volcano, runways, rings, the
// cargo plane with its lit instrument panel, and a HUD with altitude, speed and heading. The
// camera follows the plane east along the archipelago.
import { FIELD, FONT, ISLANDS, LIVES, MISSION, PALETTE, PLANE, WORLD } from './config.js';
import { groundYAt, terrainAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The instrument panel strip along the bottom of the screen. */
const PANEL = { top: 598, height: 122 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function mmss(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Skor ');
  const bestLabel = cachedLabel('Terbaik ');
  const finalLabel = cachedLabel('Skor ');
  const altLabel = cachedLabel('ALT ');
  const spdLabel = cachedLabel('SPD ');
  const hdgLabel = cachedLabel('HDG ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function cameraX(state) {
    return Math.max(0, Math.min(WORLD.width - FIELD.width, state.plane.x - 430));
  }

  function drawSky(state) {
    const sky = context.createLinearGradient(0, 0, 0, FIELD.seaY);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.seaY);
    // Low sun, fixed in the sky: the dawn the cargo run starts in.
    context.save();
    context.shadowColor = PALETTE.sun;
    context.shadowBlur = 60;
    context.fillStyle = PALETTE.sunCore;
    context.beginPath();
    context.arc(1060, 120, 44, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(1060, 120, 30, 0, Math.PI * 2);
    context.fill();
  }

  function drawClouds(state) {
    context.fillStyle = PALETTE.cloud;
    for (let i = 0; i < 11; i += 1) {
      const baseX = (i * 613 + 240) % 5600;
      const x = ((baseX + state.clock * (6 + (i % 3) * 3)) % 5600) - 200;
      const y = 55 + ((i * 97) % 170);
      const s = 0.7 + (i % 3) * 0.35;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.ellipse(x, y, 52 * s, 16 * s, 0, 0, Math.PI * 2);
      context.ellipse(x - 30 * s, y + 5 * s, 30 * s, 12 * s, 0, 0, Math.PI * 2);
      context.ellipse(x + 32 * s, y + 5 * s, 32 * s, 13 * s, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawSea(state) {
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, FIELD.seaY, FIELD.width, FIELD.height - FIELD.seaY);
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, FIELD.seaY + 74, FIELD.width, FIELD.height - FIELD.seaY - 74);
    // Wave lines that slide with the clock.
    context.strokeStyle = PALETTE.seaFoam;
    context.globalAlpha = 0.35;
    context.lineWidth = 2;
    for (let row = 0; row < 3; row += 1) {
      const y = FIELD.seaY + 22 + row * 34;
      context.beginPath();
      for (let x = 0; x <= FIELD.width; x += 24) {
        const wx = x + ((state.clock * 14 + row * 40) % 48);
        const wy = y + Math.sin((x + state.clock * 30 + row * 90) * 0.02) * 3;
        if (x === 0) context.moveTo(wx - 48, wy);
        else context.lineTo(wx - 48, wy);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawTerrain(state, camX) {
    // One filled profile from the world's own ground function, sampled across the view.
    for (const island of ISLANDS) {
      if (island.kind === 'volcano') continue;
      const x0 = Math.max(island.x0, camX - 40);
      const x1 = Math.min(island.x1, camX + FIELD.width + 40);
      if (x0 >= x1) continue;
      context.beginPath();
      context.moveTo(x0, groundYAt(x0));
      for (let x = x0; x <= x1; x += 12) context.lineTo(x, groundYAt(x));
      context.lineTo(x1, FIELD.height);
      context.lineTo(x0, FIELD.height);
      context.closePath();
      context.fillStyle = PALETTE.island;
      context.fill();
      // Sand where the green meets the water.
      context.strokeStyle = PALETTE.sand;
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(x0, groundYAt(x0));
      for (let x = x0; x <= x1; x += 12) context.lineTo(x, groundYAt(x));
      context.stroke();
    }
    // Krakatau: a brown cone with a glowing crater and drifting smoke.
    const vx0 = Math.max(1500, camX - 40);
    const vx1 = Math.min(2100, camX + FIELD.width + 40);
    if (vx0 < vx1) {
      context.beginPath();
      context.moveTo(vx0, groundYAt(vx0));
      for (let x = vx0; x <= vx1; x += 12) context.lineTo(x, groundYAt(x));
      context.lineTo(vx1, FIELD.height);
      context.lineTo(vx0, FIELD.height);
      context.closePath();
      context.fillStyle = PALETTE.volcano;
      context.fill();
      context.fillStyle = PALETTE.lava;
      context.beginPath();
      context.ellipse(1800, 386, 26, 9, 0, 0, Math.PI * 2);
      context.fill();
      for (let i = 0; i < 4; i += 1) {
        const rise = (state.clock * 18 + i * 42) % 170;
        context.globalAlpha = 0.5 - rise / 340;
        context.fillStyle = PALETTE.smoke;
        context.beginPath();
        context.arc(1800 + Math.sin(state.clock + i) * 8, 372 - rise, 12 + rise * 0.12, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  function drawPalm(x, y, s) {
    context.strokeStyle = PALETTE.palmTrunk;
    context.lineWidth = 5 * s;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + 6 * s, y - 26 * s, x + 14 * s, y - 40 * s);
    context.stroke();
    context.strokeStyle = PALETTE.palm;
    context.lineWidth = 4 * s;
    for (let i = 0; i < 5; i += 1) {
      const a = -0.4 - i * 0.55;
      context.beginPath();
      context.moveTo(x + 14 * s, y - 40 * s);
      context.quadraticCurveTo(
        x + 14 * s + Math.cos(a) * 22 * s,
        y - 40 * s + Math.sin(a) * 16 * s - 6 * s,
        x + 14 * s + Math.cos(a) * 34 * s,
        y - 40 * s + Math.sin(a) * 22 * s + 8 * s,
      );
      context.stroke();
    }
  }

  function drawRunways(state) {
    for (const island of ISLANDS) {
      if (!island.runway) continue;
      const r = island.runway;
      context.fillStyle = PALETTE.runway;
      context.fillRect(r.x0, r.y - 4, r.x1 - r.x0, 10);
      context.fillStyle = PALETTE.runwayLine;
      for (let x = r.x0 + 14; x < r.x1 - 14; x += 44) context.fillRect(x, r.y - 1, 22, 3);
      context.fillStyle = PALETTE.runwayEdge;
      context.fillRect(r.x0, r.y - 6, r.x1 - r.x0, 2);
      context.fillRect(r.x0, r.y + 6, r.x1 - r.x0, 2);
      // Windsock at the runway's near end, leaning with the wind.
      const lean = Math.max(-1, Math.min(1, state.wind / 40));
      const sx = r.x0 + 26;
      context.strokeStyle = '#8a8a8a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(sx, r.y - 6);
      context.lineTo(sx, r.y - 34);
      context.stroke();
      context.fillStyle = '#ff7a3c';
      context.beginPath();
      context.moveTo(sx, r.y - 34);
      context.lineTo(sx + 22 * lean + 10, r.y - 30);
      context.lineTo(sx, r.y - 26);
      context.closePath();
      context.fill();
    }
    // Home island: a hangar and a control tower, so the base reads as a base.
    context.fillStyle = '#5a4632';
    context.fillRect(520, 512, 90, 48);
    context.fillStyle = '#7a5c40';
    context.beginPath();
    context.moveTo(520, 512);
    context.quadraticCurveTo(565, 478, 610, 512);
    context.closePath();
    context.fill();
    context.fillStyle = '#3c4148';
    context.fillRect(640, 470, 16, 90);
    context.fillStyle = PALETTE.gaugeAmber;
    context.fillRect(636, 458, 24, 14);
  }

  function drawRings(state) {
    const mission = state.mission;
    if (mission.kind !== 'rings') return;
    mission.rings.forEach((ring, index) => {
      const isNext = index === mission.ringIndex;
      const pulse = isNext ? 1 + Math.sin(state.clock * 5) * 0.08 : 1;
      context.save();
      context.strokeStyle = ring.passed ? PALETTE.ringDone : PALETTE.ring;
      context.shadowColor = ring.passed ? PALETTE.ringDone : PALETTE.ringGlow;
      context.shadowBlur = isNext ? 22 : 8;
      context.lineWidth = isNext ? 7 : 5;
      context.beginPath();
      context.arc(ring.x, ring.y, ring.r * pulse, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      if (isNext) {
        context.fillStyle = PALETTE.ring;
        context.beginPath();
        context.moveTo(ring.x - 8, ring.y - 26);
        context.lineTo(ring.x + 8, ring.y - 26);
        context.lineTo(ring.x, ring.y - 12);
        context.closePath();
        context.fill();
      }
    });
  }

  function drawDropZone(state) {
    const mission = state.mission;
    if (mission.kind !== 'drop') return;
    const zone = mission.zone;
    const y = groundYAt(zone.x);
    const bob = Math.sin(state.clock * 3) * 6;
    context.save();
    context.strokeStyle = PALETTE.zone;
    context.setLineDash([10, 8]);
    context.lineWidth = 4;
    context.beginPath();
    context.ellipse(zone.x, y - 26, zone.halfWidth, 26, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = PALETTE.zone;
    context.font = `bold 17px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('▼ ZONA KARGO ▼', zone.x, y - 120 + bob);
    context.restore();
  }

  function drawPlane(state) {
    const plane = state.plane;
    context.save();
    context.translate(plane.x, plane.y);
    context.rotate(-plane.pitch);
    // Propeller blur and blades, spinning with the clock when the engine runs.
    const propAngle = state.clock * (4 + plane.throttle * 26);
    context.save();
    context.globalAlpha = 0.35 + plane.throttle * 0.3;
    context.fillStyle = PALETTE.prop;
    context.beginPath();
    context.ellipse(56, 0, 4, 26, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.strokeStyle = PALETTE.prop;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(56 + Math.cos(propAngle) * 26, Math.sin(propAngle) * 26);
    context.lineTo(56 - Math.cos(propAngle) * 26, -Math.sin(propAngle) * 26);
    context.moveTo(56 + Math.cos(propAngle + Math.PI / 2) * 22, Math.sin(propAngle + Math.PI / 2) * 22);
    context.lineTo(56 - Math.cos(propAngle + Math.PI / 2) * 22, -Math.sin(propAngle + Math.PI / 2) * 22);
    context.stroke();
    // Tail fin and stabiliser.
    context.fillStyle = PALETTE.planeBelly;
    context.beginPath();
    context.moveTo(-34, -4);
    context.lineTo(-52, -30);
    context.lineTo(-40, -30);
    context.lineTo(-24, -6);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-46, 2);
    context.lineTo(-30, -8);
    context.lineTo(-18, -4);
    context.lineTo(-34, 6);
    context.closePath();
    context.fill();
    // Wing root, seen from the side as the fairing under the fuselage.
    context.fillStyle = PALETTE.planeStripe;
    context.beginPath();
    context.moveTo(-6, 8);
    context.lineTo(18, 8);
    context.lineTo(10, 20);
    context.lineTo(-14, 20);
    context.closePath();
    context.fill();
    // Fuselage: a built-looking cargo plane, white over red with a green cheatline.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-48, -6);
    context.quadraticCurveTo(-52, -12, -40, -13);
    context.lineTo(34, -13);
    context.quadraticCurveTo(54, -12, 56, -2);
    context.quadraticCurveTo(56, 8, 40, 10);
    context.lineTo(-38, 10);
    context.quadraticCurveTo(-50, 8, -48, -6);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeBelly;
    context.fillRect(-38, 4, 78, 6);
    context.fillStyle = PALETTE.planeStripe;
    context.fillRect(-38, 1, 78, 2);
    // Cockpit windows, lit amber: the instruments are on in this cabin.
    context.save();
    context.shadowColor = PALETTE.planeGlassLit;
    context.shadowBlur = 8;
    context.fillStyle = PALETTE.planeGlassLit;
    for (let i = 0; i < 3; i += 1) {
      roundRect(30 + i * 8, -11, 6, 7, 2);
      context.fill();
    }
    context.restore();
    context.fillStyle = PALETTE.planeStripe;
    context.font = `bold 9px ${FONT}`;
    context.textAlign = 'left';
    context.fillText('GARUDA KARGO', -30, -4);
    // The cargo crate slung under the belly, while the plane still carries it.
    if (plane.cargo) {
      context.fillStyle = '#8a5a2b';
      context.fillRect(-8, 10, 18, 12);
      context.strokeStyle = '#5a3a1a';
      context.lineWidth = 1;
      context.strokeRect(-8, 10, 18, 12);
      context.beginPath();
      context.moveTo(-8, 10);
      context.lineTo(10, 22);
      context.moveTo(10, 10);
      context.lineTo(-8, 22);
      context.stroke();
    }
    context.restore();
  }

  function dial(cx, cy, r, label, valueText) {
    context.save();
    context.shadowColor = PALETTE.gaugeAmber;
    context.shadowBlur = 10;
    context.fillStyle = PALETTE.gaugeFace;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.text;
    context.font = `bold 11px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(label, cx, cy + r + 16);
    context.font = `bold 15px ${FONT}`;
    context.fillText(valueText, cx, cy + 5);
  }

  function needle(cx, cy, r, angle) {
    context.strokeStyle = PALETTE.gaugeNeedle;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(angle) * (r - 6), cy + Math.sin(angle) * (r - 6));
    context.stroke();
    context.fillStyle = PALETTE.gaugeNeedle;
    context.beginPath();
    context.arc(cx, cy, 3, 0, Math.PI * 2);
    context.fill();
  }

  function drawPanel(state) {
    const plane = state.plane;
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, PANEL.top, FIELD.width, PANEL.height);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, PANEL.top, FIELD.width, 3);

    // Attitude indicator: the horizon slides with pitch, the little plane stays put.
    const ax = 92;
    const ay = PANEL.top + 56;
    const ar = 42;
    context.save();
    context.beginPath();
    context.arc(ax, ay, ar, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#2f6db3';
    context.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    const horizon = ay + plane.pitch * 90;
    context.fillStyle = '#8a5a2b';
    context.fillRect(ax - ar, horizon, ar * 2, ar * 2);
    context.strokeStyle = PALETTE.gaugeNeedle;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(ax - ar, horizon);
    context.lineTo(ax + ar, horizon);
    context.stroke();
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(ax, ay, ar, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = PALETTE.gaugeAmber;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(ax - 18, ay);
    context.lineTo(ax - 4, ay);
    context.moveTo(ax + 4, ay);
    context.lineTo(ax + 18, ay);
    context.stroke();
    context.fillStyle = PALETTE.gaugeAmber;
    context.beginPath();
    context.arc(ax, ay, 3, 0, Math.PI * 2);
    context.fill();
    text('SIKAP', ax, ay + ar + 16, 11, PALETTE.text, 'center');

    // Altimeter and airspeed, needles lit amber.
    const altFt = Math.max(0, Math.round((FIELD.seaY - plane.y) * 3));
    const spdKt = Math.round(plane.speed * 0.9);
    dial(236, ay, 40, 'ALTIMETER', String(altFt));
    needle(236, ay, 40, -Math.PI / 2 + ((altFt % 1000) / 1000) * Math.PI * 2);
    dial(360, ay, 40, 'KECEPATAN', String(spdKt));
    needle(360, ay, 40, -Math.PI / 2 + (plane.speed / PLANE.maxSpeed) * Math.PI * 1.5);

    // Compass tape: the run is eastbound, so 090 sits in the middle.
    const cx = 640;
    context.fillStyle = PALETTE.gaugeFace;
    roundRect(cx - 170, ay - 30, 340, 60, 8);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(cx - 170, ay - 30, 340, 60, 8);
    context.stroke();
    for (let d = -60; d <= 60; d += 15) {
      const hx = cx + d * 2.4;
      const heading = 90 + d;
      context.strokeStyle = PALETTE.muted;
      context.lineWidth = d % 30 === 0 ? 2 : 1;
      context.beginPath();
      context.moveTo(hx, ay - 26);
      context.lineTo(hx, ay - 14);
      context.stroke();
      if (d % 30 === 0) text(String(heading).padStart(3, '0'), hx, ay + 22, 12, PALETTE.text, 'center');
    }
    context.fillStyle = PALETTE.gaugeAmber;
    context.beginPath();
    context.moveTo(cx - 7, ay - 30);
    context.lineTo(cx + 7, ay - 30);
    context.lineTo(cx, ay - 18);
    context.closePath();
    context.fill();
    text('KOMPAS', cx, ay + 42, 11, PALETTE.text, 'center');

    // Fuel, damage and throttle, left to right at the panel's right end.
    const fx = 920;
    text('BBM', fx, ay - 30, 12, PALETTE.text, 'center');
    context.fillStyle = '#0a121a';
    roundRect(fx - 14, ay - 22, 28, 84, 5);
    context.fill();
    const fuelH = 84 * (plane.fuel / 100);
    context.fillStyle = plane.fuel < 12 ? PALETTE.gaugeRed : PALETTE.gaugeGreen;
    roundRect(fx - 14, ay + 62 - fuelH, 28, fuelH, 5);
    context.fill();
    text(`${Math.round(plane.fuel)}%`, fx, ay + 80, 11, PALETTE.text, 'center');

    const dx = 1000;
    text('RUSAK', dx, ay - 30, 12, PALETTE.text, 'center');
    context.fillStyle = '#0a121a';
    roundRect(dx - 14, ay - 22, 28, 84, 5);
    context.fill();
    const dmgH = 84 * (plane.damage / 100);
    context.fillStyle = PALETTE.gaugeRed;
    roundRect(dx - 14, ay + 62 - dmgH, 28, dmgH, 5);
    context.fill();
    text(`${Math.round(plane.damage)}%`, dx, ay + 80, 11, PALETTE.text, 'center');

    const tx = 1110;
    text('GAS', tx, ay - 30, 12, PALETTE.text, 'center');
    context.fillStyle = '#0a121a';
    roundRect(tx - 8, ay - 22, 16, 84, 5);
    context.fill();
    const leverY = ay + 62 - 84 * plane.throttle;
    context.fillStyle = PALETTE.gaugeAmber;
    context.fillRect(tx - 16, leverY - 4, 32, 8);
    text(`${Math.round(plane.throttle * 100)}%`, tx, ay + 80, 11, PALETTE.text, 'center');

    text(plane.cargo ? 'KARGO: DIBAWA' : 'KARGO: TERKIRIM', 1200, ay - 8, 12, plane.cargo ? PALETTE.zone : PALETTE.good, 'center');
    text(`ANGIN ${state.wind >= 0 ? '→' : '←'} ${Math.abs(Math.round(state.wind))}`, 1200, ay + 14, 12, PALETTE.muted, 'center');
  }

  function missionText(state) {
    const mission = state.mission;
    if (mission.kind === 'rings') return `Terbang melalui cincin ${mission.ringIndex + 1}/3`;
    if (mission.kind === 'drop') return 'Jatuhkan kargo di Pulau Komodo (Spasi)';
    return `Mendarat di landasan ${mission.runwayName}`;
  }

  function drawHud(state, best) {
    const plane = state.plane;
    const altFt = Math.max(0, Math.round((FIELD.seaY - plane.y) * 3));
    const spdKt = Math.round(plane.speed * 0.9);
    const vs = Math.round(-plane.vy * 0.9);
    // Mission card, top left.
    context.fillStyle = 'rgba(11, 30, 51, 0.72)';
    roundRect(16, 14, 430, 66, 10);
    context.fill();
    text(`SORTIE ${state.sortie} · MISI ${state.mission.kind === 'rings' ? 1 : state.mission.kind === 'drop' ? 2 : 3}/3`, 30, 38, 14, PALETTE.gold, 'left');
    text(missionText(state), 30, 62, 16, PALETTE.text, 'left');
    // Timer, top centre.
    text(mmss(state.dayLeft), FIELD.width / 2, 52, 34, state.dayLeft < 30 ? PALETTE.danger : PALETTE.text, 'center');
    // Score and lives, top right.
    text(scoreLabel(state.score), FIELD.width - 170, 38, 18, PALETTE.text, 'right');
    text(bestLabel(best), FIELD.width - 170, 62, 13, PALETTE.muted, 'right');
    for (let i = 0; i < LIVES; i += 1) {
      context.fillStyle = i < state.lives ? PALETTE.gaugeAmber : 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.moveTo(FIELD.width - 150 + i * 26, 26);
      context.lineTo(FIELD.width - 138 + i * 26, 32);
      context.lineTo(FIELD.width - 150 + i * 26, 38);
      context.closePath();
      context.fill();
    }
    // Flight numbers, under the mission card.
    text(altLabel(altFt), 30, 104, 20, PALETTE.text, 'left');
    text(' ft', 118, 104, 14, PALETTE.muted, 'left');
    text(spdLabel(spdKt), 190, 104, 20, PALETTE.text, 'left');
    text(' kt', 278, 104, 14, PALETTE.muted, 'left');
    text(hdgLabel(90), 340, 104, 20, PALETTE.text, 'left');
    text('°', 418, 104, 14, PALETTE.muted, 'left');
    text(`V/S ${vs >= 0 ? '+' : ''}${vs}`, 470, 104, 16, vs >= 0 ? PALETTE.good : PALETTE.muted, 'left');
    // Transient banner.
    if (state.messageT > 0 && state.message) {
      context.fillStyle = 'rgba(11, 30, 51, 0.78)';
      const w = 560;
      roundRect((FIELD.width - w) / 2, 128, w, 40, 10);
      context.fill();
      text(state.message, FIELD.width / 2, 155, 19, PALETTE.gold, 'center');
    }
  }

  function overlay(alpha) {
    context.fillStyle = `rgba(8, 18, 32, ${alpha})`;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    overlay(0.45);
    text('GARUDA KARGO', FIELD.width / 2, 190, 72, PALETTE.text, 'center');
    text('Pilot kargo antar pulau — cincin, kargo, dan landasan pendek', FIELD.width / 2, 232, 22, PALETTE.gold, 'center');
    text('↑ / ↓  atur hidung  ·  → / ←  gas  ·  Spasi  jatuhkan kargo  ·  P  jeda', FIELD.width / 2, 330, 19, PALETTE.text, 'center');
    text('Tahan mouse: arahkan ke atas untuk naik, ke bawah untuk turun', FIELD.width / 2, 360, 16, PALETTE.muted, 'center');
    text('Terbang melewati cincin, jatuhkan kargo di Pulau Komodo,', FIELD.width / 2, 420, 17, PALETTE.muted, 'center');
    text('lalu mendarat di Pulau Raja sebelum hari berakhir.', FIELD.width / 2, 444, 17, PALETTE.muted, 'center');
    const blink = Math.sin(state.clock * 4) > -0.2;
    if (blink) text('Tekan Enter atau klik untuk terbang', FIELD.width / 2, 520, 24, PALETTE.gold, 'center');
    if (best > 0) text(bestLabel(best), FIELD.width / 2, 556, 18, PALETTE.text, 'center');
  }

  function drawOver(state, best) {
    overlay(0.6);
    text('Hari Selesai!', FIELD.width / 2, 190, 56, PALETTE.text, 'center');
    text(finalLabel(state.score), FIELD.width / 2, 258, 34, PALETTE.gold, 'center');
    if (state.score > best) text('Skor terbaik baru!', FIELD.width / 2, 296, 20, PALETTE.good, 'center');
    text(`Sortie selesai: ${state.sortiesDone}  ·  Cincin: ${state.ringsHit}  ·  Kargo: ${state.dropsDone}  ·  Pendaratan: ${state.landingsDone}`, FIELD.width / 2, 350, 19, PALETTE.text, 'center');
    text(`Nyawa tersisa: ${state.lives}  ·  Terbaik: ${Math.max(best, state.score)}`, FIELD.width / 2, 382, 17, PALETTE.muted, 'center');
    const blink = Math.sin(state.clock * 4) > -0.2;
    if (blink) text('Tekan Enter untuk terbang lagi', FIELD.width / 2, 450, 22, PALETTE.gold, 'center');
  }

  function draw(state, screen, best) {
    const width = Math.round(window.innerWidth * (window.devicePixelRatio || 1));
    const height = Math.round(window.innerHeight * (window.devicePixelRatio || 1));
    if (canvas.width !== width || canvas.height !== height) resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const camX = cameraX(state);
    drawSky(state);
    drawClouds(state);
    context.save();
    context.translate(-camX, 0);
    drawSea(state);
    drawTerrain(state, camX);
    // Palm trees on the flat islands, at fixed spots along each shore.
    drawPalm(620, 560, 1);
    drawPalm(2680, 520, 0.9);
    drawPalm(3240, 520, 1.1);
    drawPalm(4080, 500, 1);
    drawPalm(4620, 500, 0.9);
    drawRunways(state);
    drawRings(state);
    drawDropZone(state);
    drawPlane(state);
    context.restore();
    drawPanel(state);
    drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) {
      overlay(0.5);
      text('JEDA', FIELD.width / 2, 300, 56, PALETTE.text, 'center');
      text('Tekan P untuk lanjut', FIELD.width / 2, 350, 20, PALETTE.muted, 'center');
    } else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  window.addEventListener('resize', resize);
  resize();

  return { draw };
}
