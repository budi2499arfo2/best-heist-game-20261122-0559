// The museum, its guards, cameras, lasers and loot: pure logic, no DOM, so the
// same file runs in the browser and under node (tests and the bot playtest).
//
// Zones by x: Entrance Hall x < 340, Gallery Wing 340..860, Vault x > 860. Two
// doors join them: (348, 360) and (868, 240). Guards patrol waypoint loops; a
// guard or camera that sees the player raises suspicion, and suspicion at 100
// trips the alarm. The vault's laser grid cycles off -> warning -> on.
import {
  BONUS,
  CAMERA,
  CAMERAS,
  EXIT,
  FIELD,
  GUARD,
  GUARDS,
  LASER,
  LASERS,
  LOOT,
  LOOT_WEIGHT,
  NOISE,
  OBSTACLES,
  PLAYER,
  START,
  SUSPICION,
  WALLS,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_ALARM = 4;
export const EVENT_LASER = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_WIN = 32;

const TAU = Math.PI * 2;
const LASER_CYCLE = LASER.offSeconds + LASER.warnSeconds + LASER.onSeconds;

export const DOOR_GALLERY = { x: 348, y: 360 };
export const DOOR_VAULT = { x: 868, y: 240 };

/** Which zone an x coordinate is in: 0 entrance, 1 gallery, 2 vault. */
export function zoneOf(x) {
  return x < 340 ? 0 : x < 860 ? 1 : 2;
}

/** The laser grid's state at a time: 'off' | 'warn' | 'on'. */
export function laserStateAt(time) {
  const phase = ((time % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE;
  if (phase < LASER.offSeconds) return 'off';
  if (phase < LASER.offSeconds + LASER.warnSeconds) return 'warn';
  return 'on';
}

/** Seconds until the lasers next switch off (0 when already off). */
export function secondsUntilLaserOff(time) {
  const phase = ((time % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE;
  if (phase < LASER.offSeconds) return 0;
  return LASER_CYCLE - phase;
}

/** Seconds until the lasers next switch on (0 when already on). The warning
 *  blink counts as still safe: the beams only bite once they are on. */
export function secondsUntilLaserOn(time) {
  const phase = ((time % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE;
  const onAt = LASER.offSeconds + LASER.warnSeconds;
  if (phase >= onAt) return 0;
  return onAt - phase;
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Is the point (px, py) inside the cone from (ox, oy) facing `angle`? */
export function pointInCone(px, py, ox, oy, angle, halfAngle, range) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  return Math.abs(angleDiff(Math.atan2(dy, dx), angle)) <= halfAngle;
}

/** Does the segment (x0,y0)-(x1,y1) touch the rectangle? (Liang-Barsky clip.) */
export function segmentHitsRect(x0, y0, x1, y1, rect) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, x0 - rect.x],
    [dx, rect.x + rect.w - x0],
    [-dy, y0 - rect.y],
    [dy, rect.y + rect.h - y0],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

/** Line of sight: true when no wall stands between the two points. Furniture is
 *  low glass and planters; it blocks movement, not sight. */
export function hasLineOfSight(x0, y0, x1, y1) {
  for (const wall of WALLS) {
    if (segmentHitsRect(x0, y0, x1, y1, wall)) return false;
  }
  return true;
}

/** Push a circle out of every wall, obstacle and the field edge. Mutates `pos`. */
function resolveCollisions(pos, radius) {
  pos.x = Math.min(FIELD.width - radius, Math.max(radius, pos.x));
  pos.y = Math.min(FIELD.height - radius, Math.max(radius, pos.y));
  for (const rect of [...WALLS, ...OBSTACLES]) {
    const nx = Math.min(rect.x + rect.w, Math.max(rect.x, pos.x));
    const ny = Math.min(rect.y + rect.h, Math.max(rect.y, pos.y));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) {
      // Centre inside the rectangle: push out along the shallowest side.
      const left = pos.x - rect.x;
      const right = rect.x + rect.w - pos.x;
      const top = pos.y - rect.y;
      const bottom = rect.y + rect.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = rect.x - radius;
      else if (m === right) pos.x = rect.x + rect.w + radius;
      else if (m === top) pos.y = rect.y - radius;
      else pos.y = rect.y + rect.h + radius;
      continue;
    }
    const d = Math.sqrt(d2);
    pos.x = nx + (dx / d) * radius;
    pos.y = ny + (dy / d) * radius;
  }
}

/** Would a watcher at (ox, oy) facing `angle` see the point (px, py)? */
function watcherSees(px, py, ox, oy, angle, halfAngle, range) {
  return pointInCone(px, py, ox, oy, angle, halfAngle, range) && hasLineOfSight(ox, oy, px, py);
}

/** Would any guard or camera see a player standing at (x, y) right now? The bot
 *  uses this to plan; the live game uses the same test on the real player. */
export function wouldBeSeen(state, x, y) {
  for (const guard of state.guards) {
    if (watcherSees(x, y, guard.x, guard.y, guard.facing, GUARD.coneHalfAngle, GUARD.coneRange)) return true;
  }
  for (const camera of state.cameras) {
    if (watcherSees(x, y, camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, camera.range)) return true;
  }
  return false;
}

function guardSeesPlayer(state, guard) {
  return watcherSees(
    state.player.x,
    state.player.y,
    guard.x,
    guard.y,
    guard.facing,
    GUARD.coneHalfAngle,
    GUARD.coneRange,
  );
}

function cameraSeesPlayer(state, camera) {
  return watcherSees(
    state.player.x,
    state.player.y,
    camera.x,
    camera.y,
    camera.angle,
    CAMERA.coneHalfAngle,
    camera.range,
  );
}

/** The door a guard must pass through to get from its zone toward `targetX`. */
function chaseTarget(guard, tx, ty) {
  const gz = zoneOf(guard.x);
  const tz = zoneOf(tx);
  if (gz === tz) return { x: tx, y: ty };
  if (gz < tz) return gz === 0 ? DOOR_GALLERY : DOOR_VAULT;
  return gz === 2 ? DOOR_VAULT : DOOR_GALLERY;
}

/** Move `pos` toward (tx, ty) at `speed` for dt, sliding on walls. Returns true on arrival. */
function moveToward(pos, tx, ty, speed, dt, radius) {
  const dx = tx - pos.x;
  const dy = ty - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  pos.x += (dx / dist) * step;
  pos.y += (dy / dist) * step;
  resolveCollisions(pos, radius);
  return Math.hypot(tx - pos.x, ty - pos.y) < 4;
}

export function createWorld(random) {
  const state = {
    time: 0,
    player: { x: START.x, y: START.y, dirAngle: 0, moving: false, mode: 'walk' },
    guards: [],
    cameras: [],
    loot: [],
    suspicion: 0,
    spotTime: 0,
    spotted: false,
    alarm: false,
    alarmEver: false,
    caught: false,
    won: false,
    over: false,
    reason: '',
    lootValue: 0,
    carried: 0,
    hasDiamond: false,
    inBeam: false,
    noise: null,
    noiseTimer: 0,
    score: 0,
  };

  function reset() {
    state.time = 0;
    state.player.x = START.x;
    state.player.y = START.y;
    state.player.dirAngle = 0;
    state.player.moving = false;
    state.player.mode = 'walk';
    state.guards = GUARDS.map((def, i) => {
      // The seed staggers each guard along its loop so every seed plays differently.
      const startWp = Math.floor(random.next() * def.waypoints.length);
      const at = def.waypoints[startWp];
      const next = def.waypoints[(startWp + 1) % def.waypoints.length];
      return {
        name: def.name,
        x: at.x,
        y: at.y,
        wps: def.waypoints,
        wp: (startWp + 1) % def.waypoints.length,
        pause: 0,
        facing: Math.atan2(next.y - at.y, next.x - at.x),
        state: 'patrol',
        tx: 0,
        ty: 0,
        look: 0,
        seen: false,
        id: i,
        // Stuck watch: a guard pinned against furniture skips its waypoint.
        stuckX: at.x,
        stuckY: at.y,
        stuckFor: 0,
      };
    });
    state.cameras = CAMERAS.map((def) => ({
      x: def.x,
      y: def.y,
      baseAngle: def.baseAngle,
      sweepAmp: def.sweepAmp,
      sweepSeconds: def.sweepSeconds,
      range: def.range,
      phase: def.phase + random.next(),
      angle: def.baseAngle,
    }));
    state.loot = LOOT.map((item) => ({ ...item, taken: false }));
    state.suspicion = 0;
    state.spotTime = 0;
    state.spotted = false;
    state.alarm = false;
    state.alarmEver = false;
    state.caught = false;
    state.won = false;
    state.over = false;
    state.reason = '';
    state.lootValue = 0;
    state.carried = 0;
    state.hasDiamond = false;
    state.inBeam = false;
    state.noise = null;
    state.noiseTimer = 0;
    state.score = 0;
  }

  function playerSpeed() {
    const base =
      state.player.mode === 'sneak'
        ? PLAYER.sneakSpeed
        : state.player.mode === 'sprint'
          ? PLAYER.sprintSpeed
          : PLAYER.walkSpeed;
    return base * Math.pow(1 - LOOT_WEIGHT, state.carried);
  }

  function step(dt, input, attract = false) {
    let events = 0;
    state.time += dt;

    // Cameras sweep on their own clock.
    for (const camera of state.cameras) {
      camera.angle =
        camera.baseAngle +
        camera.sweepAmp * Math.sin((TAU * (state.time / camera.sweepSeconds)) + camera.phase * TAU);
    }

    if (!attract && !state.over) {
      // --- the player moves ---
      const p = state.player;
      p.mode = input.mode || 'walk';
      const len = Math.hypot(input.x, input.y);
      p.moving = len > 0.01;
      if (p.moving) {
        const speed = playerSpeed();
        p.dirAngle = Math.atan2(input.y, input.x);
        p.x += (input.x / len) * speed * dt;
        p.y += (input.y / len) * speed * dt;
        resolveCollisions(p, PLAYER.radius);
      }

      // --- noise: a moving player rings out on a pulse ---
      state.noiseTimer -= dt;
      if (p.moving && state.noiseTimer <= 0) {
        const radius =
          p.mode === 'sprint' ? NOISE.sprintRadius : p.mode === 'walk' ? NOISE.walkRadius : NOISE.sneakRadius;
        state.noiseTimer = NOISE.pulseSeconds;
        if (radius > 0) {
          state.noise = { x: p.x, y: p.y, r: radius, until: state.time + 0.5 };
          for (const guard of state.guards) {
            if (guard.state === 'chase') continue;
            const dist = Math.hypot(guard.x - p.x, guard.y - p.y);
            const heard = hasLineOfSight(guard.x, guard.y, p.x, p.y)
              ? radius
              : radius * NOISE.throughWall;
            if (dist <= heard) {
              guard.state = 'investigate';
              guard.tx = p.x;
              guard.ty = p.y;
              guard.look = 0;
            }
          }
        }
      }
      if (state.noise && state.time > state.noise.until) state.noise = null;

      // --- loot pickup ---
      for (const item of state.loot) {
        if (item.taken) continue;
        if (Math.hypot(item.x - p.x, item.y - p.y) < 26) {
          item.taken = true;
          state.lootValue += item.value;
          state.carried += 1;
          if (item.kind === 'diamond') state.hasDiamond = true;
          events |= EVENT_PICKUP;
        }
      }
    }

    // --- guards move and watch ---
    for (const guard of state.guards) {
      if (state.alarm) guard.state = 'chase';
      else if (guard.state === 'chase') guard.state = 'patrol';

      if (guard.state === 'patrol') {
        const target = guard.wps[guard.wp];
        if (guard.pause > 0) {
          guard.pause -= dt;
          guard.facing = Math.atan2(target.y - guard.y, target.x - guard.x);
          guard.stuckX = guard.x;
          guard.stuckY = guard.y;
          guard.stuckFor = 0;
        } else {
          guard.facing = Math.atan2(target.y - guard.y, target.x - guard.x);
          if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, GUARD.radius)) {
            guard.wp = (guard.wp + 1) % guard.wps.length;
            guard.pause = GUARD.waypointPause;
            guard.stuckFor = 0;
          } else if (Math.hypot(guard.x - guard.stuckX, guard.y - guard.stuckY) < 5) {
            // Pinned against something (a wall corner, a case): give up on
            // this waypoint after two seconds rather than standing there all night.
            guard.stuckFor += dt;
            if (guard.stuckFor > 2) {
              guard.wp = (guard.wp + 1) % guard.wps.length;
              guard.stuckFor = 0;
            }
          } else {
            guard.stuckX = guard.x;
            guard.stuckY = guard.y;
            guard.stuckFor = 0;
          }
        }
      } else if (guard.state === 'investigate') {
        const target = chaseTarget(guard, guard.tx, guard.ty);
        const arrived = moveToward(guard, target.x, target.y, GUARD.investigateSpeed, dt, GUARD.radius);
        guard.facing = Math.atan2(target.y - guard.y, target.x - guard.x);
        if (arrived && target.x === guard.tx && target.y === guard.ty) {
          guard.look += dt;
          guard.facing += dt * 1.8;
          if (guard.look > 2.5) {
            guard.state = 'patrol';
            // Resume from the nearest waypoint.
            let best = 0;
            let bestDist = Infinity;
            guard.wps.forEach((wp, i) => {
              const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
              if (d < bestDist) {
                bestDist = d;
                best = i;
              }
            });
            guard.wp = best;
          }
        }
      } else {
        // chase: straight at the player, via the doors between zones.
        const target = chaseTarget(guard, state.player.x, state.player.y);
        guard.facing = Math.atan2(target.y - guard.y, target.x - guard.x);
        moveToward(guard, target.x, target.y, GUARD.chaseSpeed, dt, GUARD.radius);
      }
    }

    if (!attract && !state.over) {
      // --- who sees the player? ---
      let seen = false;
      let rate = 0;
      for (const guard of state.guards) {
        guard.seen = guardSeesPlayer(state, guard);
        if (guard.seen) {
          seen = true;
          rate = Math.max(rate, GUARD.spotRate);
        }
      }
      for (const camera of state.cameras) {
        if (cameraSeesPlayer(state, camera)) {
          seen = true;
          rate = Math.max(rate, CAMERA.spotRate);
        }
      }
      state.spotted = seen;
      if (seen) {
        state.spotTime += dt;
        if (state.spotTime > PLAYER.spotDelay) {
          state.suspicion = Math.min(100, state.suspicion + rate * dt);
          if (!(events & EVENT_SPOTTED)) events |= EVENT_SPOTTED;
        }
      } else {
        state.spotTime = 0;
        const decay = state.alarm ? SUSPICION.alarmDecayPerSecond : SUSPICION.decayPerSecond;
        state.suspicion = Math.max(0, state.suspicion - decay * dt);
      }

      // --- the laser grid ---
      const laser = laserStateAt(state.time);
      let inBeam = false;
      if (laser === 'on') {
        const p = state.player;
        if (p.x >= LASERS.x0 && p.x <= LASERS.x1) {
          for (const beam of LASERS.beams) {
            if (Math.abs(p.y - beam.y) < LASER.halfWidth + PLAYER.radius * 0.5) {
              inBeam = true;
              break;
            }
          }
        }
      }
      if (inBeam && !state.inBeam) {
        state.suspicion = Math.min(100, state.suspicion + LASER.hitPenalty);
        events |= EVENT_LASER;
      }
      if (inBeam) state.suspicion = Math.min(100, state.suspicion + LASER.burnRate * dt);
      state.inBeam = inBeam;

      // --- the alarm trips and clears ---
      if (!state.alarm && state.suspicion >= 100) {
        state.alarm = true;
        state.alarmEver = true;
        events |= EVENT_ALARM;
      } else if (state.alarm && state.suspicion < SUSPICION.alarmClearBelow) {
        state.alarm = false;
      }

      // --- caught? ---
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - state.player.x, guard.y - state.player.y) < GUARD.catchRadius) {
          state.caught = true;
          state.over = true;
          state.reason = `Caught by ${guard.name}`;
          events |= EVENT_CAUGHT;
          break;
        }
      }

      // --- the getaway ---
      if (!state.over && state.hasDiamond) {
        const p = state.player;
        if (p.x >= EXIT.x && p.x <= EXIT.x + EXIT.width && p.y >= EXIT.y && p.y <= EXIT.y + EXIT.height) {
          state.won = true;
          state.over = true;
          const timeBonus = Math.max(0, BONUS.timeStart - Math.floor(state.time) * BONUS.timePerSecond);
          state.score = state.lootValue + (state.alarmEver ? 0 : BONUS.ghost) + timeBonus;
          events |= EVENT_WIN;
        }
      }
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
