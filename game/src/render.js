// Canvas 2D painter: the museum at night, warm pools of light on dark marble,
// amber guard cones, magenta camera cones, red lasers. The HUD is drawn on the
// canvas too, so every screenshot carries the objective, the loot and the alarm.

import { CAMERA, EXIT, FIELD, FONT, GUARD, LASERS, OBSTACLES, PAINTINGS, PALETTE, WALLS } from './config.js';
import { laserStateAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    const ox = (w * dpr - FIELD.width * scale) / 2;
    const oy = (h * dpr - FIELD.height * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
  }

  function cone(ox, oy, angle, halfAngle, range, fill, edge) {
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawFloor() {
    // Three zones, three marbles.
    ctx.fillStyle = PALETTE.entrance;
    ctx.fillRect(0, 0, 340, FIELD.height);
    ctx.fillStyle = PALETTE.gallery;
    ctx.fillRect(340, 0, 520, FIELD.height);
    ctx.fillStyle = PALETTE.vault;
    ctx.fillRect(860, 0, 420, FIELD.height);
    // Tile seams.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // Warm pools of light from the skylights.
    for (const [x, y, r] of [[170, 360, 210], [600, 360, 260], [1070, 360, 240]]) {
      const g = ctx.createRadialGradient(x, y, 10, x, y, r);
      g.addColorStop(0, 'rgba(255, 214, 130, 0.10)');
      g.addColorStop(1, 'rgba(255, 214, 130, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Zone names, stencilled on the floor.
    ctx.fillStyle = 'rgba(244, 239, 228, 0.10)';
    ctx.font = `700 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ENTRANCE', 170, 690);
    ctx.fillText('GALLERY', 600, 690);
    ctx.fillText('VAULT', 1070, 690);
  }

  function drawExit(state) {
    const glow = state.hasDiamond ? 'rgba(61, 220, 132, 0.55)' : 'rgba(61, 220, 132, 0.22)';
    ctx.fillStyle = glow;
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.width, EXIT.height);
    ctx.strokeStyle = PALETTE.ok;
    ctx.lineWidth = 2;
    ctx.strokeRect(EXIT.x + 1, EXIT.y + 1, EXIT.width - 2, EXIT.height - 2);
    ctx.save();
    ctx.translate(24, 648);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#d9ffe6';
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', 0, 7);
    ctx.restore();
  }

  function drawDecor() {
    for (const painting of PAINTINGS) {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(painting.x - 3, painting.y - 3, painting.w + 6, painting.h + 6);
      ctx.fillStyle = painting.hue;
      ctx.fillRect(painting.x, painting.y, painting.w, painting.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(painting.x + 6, painting.y + 6, painting.w - 12, 8);
    }
    for (const ob of OBSTACLES) {
      if (ob.kind === 'planter') {
        ctx.fillStyle = PALETTE.planter;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.fillStyle = '#3f6b46';
        ctx.beginPath();
        ctx.arc(ob.x + ob.w / 2, ob.y + ob.h / 2, 16, 0, TAU);
        ctx.fill();
      } else if (ob.kind === 'bench') {
        ctx.fillStyle = PALETTE.bench;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(ob.x, ob.y, ob.w, 4);
      } else if (ob.kind === 'case') {
        ctx.fillStyle = PALETTE.caseGlass;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.strokeStyle = PALETTE.caseTrim;
        ctx.lineWidth = 3;
        ctx.strokeRect(ob.x + 1, ob.y + 1, ob.w - 2, ob.h - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.moveTo(ob.x + 8, ob.y + ob.h - 6);
        ctx.lineTo(ob.x + ob.w - 8, ob.y + 6);
        ctx.lineTo(ob.x + ob.w - 22, ob.y + 6);
        ctx.lineTo(ob.x + 8, ob.y + ob.h - 20);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ob.x + 3, ob.y + 3, ob.w - 6, ob.h - 6);
      }
    }
    for (const wall of WALLS) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, 3, wall.h);
    }
    // Door frames.
    for (const [x, y, w, h] of [[340, 300, 16, 120], [860, 180, 16, 120]]) {
      ctx.fillStyle = '#5a4d38';
      ctx.fillRect(x - 3, y - 4, w + 6, 4);
      ctx.fillRect(x - 3, y + h, w + 6, 4);
    }
  }

  function drawLasers(state) {
    const mode = laserStateAt(state.time);
    for (const beam of LASERS.beams) {
      // Emitter boxes on both walls.
      ctx.fillStyle = '#2a2d36';
      ctx.fillRect(LASERS.x0 - 8, beam.y - 8, 8, 16);
      ctx.fillRect(LASERS.x1, beam.y - 8, 8, 16);
      if (mode === 'on') {
        ctx.strokeStyle = PALETTE.laserOn;
        ctx.lineWidth = 3;
        ctx.shadowColor = PALETTE.laserOn;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(LASERS.x0, beam.y);
        ctx.lineTo(LASERS.x1, beam.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'warn') {
        // Blink fast: the grid is about to switch on.
        if (Math.floor(state.time * 8) % 2 === 0) {
          ctx.strokeStyle = PALETTE.laserWarn;
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.moveTo(LASERS.x0, beam.y);
          ctx.lineTo(LASERS.x1, beam.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        ctx.strokeStyle = PALETTE.laserOff;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 10]);
        ctx.beginPath();
        ctx.moveTo(LASERS.x0, beam.y);
        ctx.lineTo(LASERS.x1, beam.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.fillStyle = mode === 'on' ? PALETTE.laserOn : PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(mode === 'on' ? 'LASER GRID — LIVE' : mode === 'warn' ? 'LASER GRID — ARMING' : 'LASER GRID — SAFE', 1070, 384);
  }

  function drawLoot(state) {
    const t = state.time;
    for (const item of state.loot) {
      if (item.taken) continue;
      const bob = Math.sin(t * 2.4 + item.x) * 2;
      const y = item.y + bob;
      const pulse = 0.6 + 0.4 * Math.sin(t * 3 + item.y);
      ctx.save();
      ctx.shadowColor = item.kind === 'diamond' ? '#bdf3ff' : PALETTE.gold;
      ctx.shadowBlur = 14 + 8 * pulse;
      if (item.kind === 'diamond') {
        // The Star of Meridian on its pedestal.
        ctx.fillStyle = '#2a2d36';
        ctx.fillRect(item.x - 16, item.y + 8, 32, 22);
        ctx.fillStyle = PALETTE.diamond;
        ctx.beginPath();
        ctx.moveTo(item.x, y - 16);
        ctx.lineTo(item.x + 13, y - 4);
        ctx.lineTo(item.x, y + 10);
        ctx.lineTo(item.x - 13, y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(item.x, y - 16);
        ctx.lineTo(item.x + 6, y - 4);
        ctx.lineTo(item.x, y - 4);
        ctx.lineTo(item.x - 6, y - 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = item.kind === 'idol' ? '#5ec98a' : item.kind === 'crown' ? '#7aa8ff' : PALETTE.gold;
        ctx.beginPath();
        ctx.arc(item.x, y, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(item.x - 3, y - 3, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(244, 239, 228, 0.85)';
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`$${item.value.toLocaleString('en-US')}`, item.x, item.y + (item.kind === 'diamond' ? 48 : 30));
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      cone(camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, camera.range, PALETTE.cameraCone, PALETTE.cameraConeEdge);
      ctx.fillStyle = '#23262e';
      ctx.fillRect(camera.x - 10, camera.y - 8, 20, 14);
      ctx.fillStyle = '#ff5ca8';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y + 2, 4, 0, TAU);
      ctx.fill();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const alert = guard.state === 'chase';
      cone(
        guard.x,
        guard.y,
        guard.facing,
        GUARD.coneHalfAngle,
        GUARD.coneRange,
        alert ? 'rgba(255, 71, 87, 0.35)' : PALETTE.guardCone,
        alert ? 'rgba(255, 71, 87, 0.9)' : PALETTE.guardConeEdge,
      );
      ctx.fillStyle = alert ? '#ff6b76' : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#11131a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Facing tick.
      ctx.strokeStyle = '#11131a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * 12, guard.y + Math.sin(guard.facing) * 12);
      ctx.stroke();
      if (guard.seen || alert) {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = `900 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 22);
      } else if (guard.state === 'investigate') {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = `900 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - 22);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (state.noise) {
      ctx.strokeStyle = 'rgba(255, 214, 130, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.noise.x, state.noise.y, state.noise.r, 0, TAU);
      ctx.stroke();
    }
    if (p.mode === 'sneak') {
      ctx.strokeStyle = 'rgba(55, 224, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, TAU);
      ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PALETTE.playerRing;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#06222b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.dirAngle) * 12, p.y + Math.sin(p.dirAngle) * 12);
    ctx.stroke();
    if (state.spotted) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `900 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED', p.x, p.y - 26);
    }
  }

  function drawHud(state) {
    // Top bar.
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, 58);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 58);
    ctx.lineTo(FIELD.width, 58);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('OBJECTIVE', 16, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(
      state.hasDiamond ? '◆ ESCAPE THROUGH THE EXIT' : '◆ STEAL THE STAR OF MERIDIAN',
      16,
      44,
    );

    // Loot, centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('LOOT', 640, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`$${state.lootValue.toLocaleString('en-US')} / $22,500`, 640, 45);

    // Alarm meter, right.
    ctx.textAlign = 'left';
    ctx.fillStyle = state.alarm ? PALETTE.danger : PALETTE.muted;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(state.alarm ? '⚠ ALARM' : 'ALARM', 1000, 20);
    ctx.fillStyle = '#2a2d36';
    ctx.fillRect(1000, 28, 180, 14);
    const w = Math.round((180 * state.suspicion) / 100);
    ctx.fillStyle = state.suspicion > 66 ? PALETTE.danger : state.suspicion > 33 ? '#ffa53d' : '#e8b93d';
    if (w > 0) ctx.fillRect(1000, 28, w, 14);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.strokeRect(1000, 28, 180, 14);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(state.suspicion)}%`, 1264, 40);

    // Ghost badge.
    if (!state.alarmEver) {
      ctx.fillStyle = PALETTE.ok;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText('👻 GHOST +$2,000', 1264, 20);
    }

    // Bottom hints.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('WASD move · SHIFT sneak (silent) · SPACE sprint (loud) · R restart', 16, 712);
    const zone = state.player.x < 340 ? 'ENTRANCE HALL' : state.player.x < 860 ? 'GALLERY WING' : 'THE VAULT';
    ctx.textAlign = 'right';
    ctx.fillText(zone, 1264, 712);

    // Carried loot pips.
    let px = 16;
    for (const item of state.loot) {
      if (!item.taken) continue;
      ctx.fillStyle = item.kind === 'diamond' ? PALETTE.diamond : PALETTE.gold;
      ctx.beginPath();
      ctx.arc(px + 6, 82, 6, 0, TAU);
      ctx.fill();
      px += 18;
    }
  }

  function drawAlarmFrame(state) {
    if (!state.alarm) return;
    const pulse = 0.5 + 0.5 * Math.sin(state.time * 6);
    ctx.strokeStyle = `rgba(255, 71, 87, ${0.35 + 0.4 * pulse})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, FIELD.width - 6, FIELD.height - 6);
    ctx.fillStyle = `rgba(255, 71, 87, ${0.75 + 0.25 * pulse})`;
    ctx.font = `900 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠  ALARM — GUARDS ARE HUNTING YOU  ⚠', 640, 92);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 8, 12, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText(title, 640, 250);
    ctx.fillStyle = PALETTE.text;
    let y = 310;
    for (const line of lines) {
      ctx.font = line.big ? `700 26px ${FONT}` : `600 18px ${FONT}`;
      ctx.fillStyle = line.big ? PALETTE.text : PALETTE.muted;
      ctx.fillText(line.text, 640, y);
      y += line.big ? 44 : 30;
    }
  }

  function draw(state, screen, best) {
    fit();
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawFloor();
    drawExit(state);
    drawDecor();
    drawLasers(state);
    drawLoot(state);
    drawCameras(state);
    drawGuards(state);
    drawPlayer(state);
    drawHud(state);
    drawAlarmFrame(state);

    if (screen === SCREEN_TITLE) {
      overlay('NIGHT SHIFT', [
        { text: 'The Meridian Museum Heist', big: true },
        { text: 'Steal the Star of Meridian — $10,000 — and walk out the exit.', big: false },
        { text: 'Guards watch in amber cones, cameras in pink. Lasers arm on a timer.', big: false },
        { text: 'Sneak (SHIFT) to stay silent. Sprint (SPACE) is fast — and loud.', big: false },
        { text: 'Grab the mask, the idol and the crown on the way. Stay a ghost for +$2,000.', big: false },
        { text: 'PRESS SPACE TO START', big: true },
      ], PALETTE.gold);
      if (best > 0) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = `600 16px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`Best take: $${best.toLocaleString('en-US')}`, 640, 620);
      }
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', [{ text: 'Press P or Space to keep stealing.', big: true }], PALETTE.text);
    } else if (screen === SCREEN_OVER) {
      if (state.won) {
        const ghost = state.alarmEver ? 0 : 2000;
        const timeBonus = Math.max(0, 1000 - Math.floor(state.time) * 5);
        overlay('CLEAN GETAWAY', [
          { text: `Total take: $${state.score.toLocaleString('en-US')}`, big: true },
          { text: `Loot $${state.lootValue.toLocaleString('en-US')}  ·  Ghost bonus $${ghost.toLocaleString('en-US')}  ·  Time bonus $${timeBonus.toLocaleString('en-US')}`, big: false },
          { text: `Finished in ${state.time.toFixed(1)}s. Best: $${Math.max(best, state.score).toLocaleString('en-US')}.`, big: false },
          { text: 'PRESS SPACE TO STEAL AGAIN', big: true },
        ], PALETTE.ok);
      } else {
        overlay('CAUGHT', [
          { text: state.reason || 'The night shift caught up with you.', big: true },
          { text: `Loot kept: $${state.lootValue.toLocaleString('en-US')} — the museum keeps the rest.`, big: false },
          { text: 'PRESS SPACE TO TRY AGAIN', big: true },
        ], PALETTE.danger);
      }
    }
  }

  return { draw };
}
