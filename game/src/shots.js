// The autopilot and the screenshot scenes behind ?shot=approach|lasers|grab|escape.
// Each scene plays the real rules forward from a fresh world with a fixed seed, so
// the frame is what a real game looks like and the same seed always gives the same
// frame. The bot also backs the headless playtest (see tests/).
import { STEP } from './config.js';
import {
  DOOR_GALLERY,
  DOOR_VAULT,
  laserStateAt,
  secondsUntilLaserOn,
  wouldBeSeen,
  zoneOf,
} from './world.js';
import { SCREEN_PLAY } from './render.js';

/**
 * The point just past the door the bot must pass to get from one zone to
 * another, or null when both points are already in the same zone. A straight
 * line between zones runs into the wall below the gap — the bot once pinned
 * itself against the vault wall for a whole run this way, after a retreat
 * skipped the door. The point is past the door on purpose: aiming at the
 * door itself once stranded the bot standing on the threshold, never
 * crossing, because the direction to the door shrank to zero.
 */
function doorBetween(fromX, toX) {
  const a = zoneOf(fromX);
  const b = zoneOf(toX);
  if (a === b) return null;
  if (a < b) {
    return a === 0
      ? { x: DOOR_GALLERY.x + 20, y: DOOR_GALLERY.y }
      : { x: DOOR_VAULT.x + 20, y: DOOR_VAULT.y };
  }
  return a === 2
    ? { x: DOOR_VAULT.x - 20, y: DOOR_VAULT.y }
    : { x: DOOR_GALLERY.x - 20, y: DOOR_GALLERY.y };
}

/** The bot's route through the museum: doors, loot, the laser grid, the exit. */
export const ROUTE = [
  { x: 348, y: 360 }, // gallery door
  { x: 500, y: 235 }, // Golden Mask
  { x: 590, y: 360 }, // gallery centre
  { x: 700, y: 580 }, // Jade Idol
  { x: 590, y: 360 }, // back through the centre (safe ground) instead of a diagonal across the guard's beat
  { x: 868, y: 240 }, // vault door
  { x: 1000, y: 340 }, // Sapphire Crown (south of the guard's beat)
  { x: 1000, y: 370 }, // duck below the vault guard's beat — and the grid crossing
  // itself: x=1000 is 200 px from the guard's east leg, so no cone ever
  // covers the crossing, and the wait point is out of every camera's range.
  { x: 1000, y: 600, laserCross: true }, // across the grid, south vault
  { x: 1150, y: 600 }, // the Star of Meridian
  { x: 1000, y: 600, laserCross: true }, // back across the grid
  { x: 1000, y: 370 }, // duck below the beat again on the way out
  { x: 868, y: 240 }, // vault door
  { x: 348, y: 360 }, // gallery door
  { x: 24, y: 648 }, // the exit
];

/** Seconds the bot waits at a waypoint before pushing on regardless (a safety valve). */
const MAX_WAIT = 20;

/**
 * A careful thief: walks waypoint to waypoint, freezes when suspicion rises,
 * retreats when it rises too far, and only crosses the laser grid while the
 * beams are off. In escape mode it sprints and ignores suspicion (but still
 * respects the lasers — a live beam is not worth the shortcut).
 */
export function createBot(route = ROUTE) {
  let wp = 0;
  let waitTime = 0;
  let mode = 'careful';
  // The retreat waypoint, picked once per retreat and kept until the bot gets
  // there or is safe again. Re-picking it every tick once stranded the bot
  // jittering on a 40 px threshold, flipping between two targets forever.
  let retreatWp = -1;

  function nearestGuard(state) {
    let best = Infinity;
    for (const guard of state.guards) {
      best = Math.min(best, Math.hypot(guard.x - state.player.x, guard.y - state.player.y));
    }
    return best;
  }

  // Retreat toward the previous waypoint — ground the bot just came from, so
  // known-safe — unless a guard is right on top of the bot, when any direction
  // away from the guard beats a planned one. (Fleeing blindly away once ran
  // the bot across the whole museum into a second guard's cone.) When the bot
  // is already standing on the previous waypoint, fall back one more: retreating
  // to the spot it stands on is standing still, and standing still in a cone
  // is how the bot once waited out its own alarm.
  function retreatInput(state, sprint = false) {
    const p = state.player;
    let gx = 0;
    let gy = 0;
    let best = Infinity;
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - p.x, guard.y - p.y);
      if (d < best) {
        best = d;
        gx = guard.x;
        gy = guard.y;
      }
    }
    let dx;
    let dy;
    if (best < 40) {
      dx = p.x - gx;
      dy = p.y - gy;
    } else {
      if (retreatWp < 0 || retreatWp >= wp) {
        retreatWp = wp - 1;
        const first = route[Math.max(0, retreatWp)];
        if (Math.hypot(first.x - p.x, first.y - p.y) < 40) retreatWp = Math.max(0, wp - 2);
      }
      const back = route[Math.max(0, retreatWp)];
      // A retreat across zones goes through the door, same as any other leg.
      const goal = doorBetween(p.x, back.x) ?? back;
      dx = goal.x - p.x;
      dy = goal.y - p.y;
      if (Math.hypot(back.x - p.x, back.y - p.y) < 15) retreatWp = -1;
    }
    if (Math.hypot(dx, dy) < 1) {
      dx = 0;
      dy = -1;
    }
    const len = Math.hypot(dx, dy) || 1;
    // Retreat silently, always: a noisy retreat summons the very investigation
    // the bot is running from (a guard once followed the bot's footsteps to
    // the laser grid and stood on the crossing). Only a raised alarm — when
    // stealth is already spent — earns a sprint.
    return { x: dx / len, y: dy / len, mode: sprint ? 'sprint' : 'sneak' };
  }

  // Sidestep around a guard standing between the bot and its target: run
  // perpendicular to the route, on the side away from the guard. Fleeing
  // straight away from a head-on chaser only backs the bot into a corner.
  function sidestepInput(state, target) {
    const p = state.player;
    let gx = 0;
    let gy = 0;
    let best = Infinity;
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - p.x, guard.y - p.y);
      if (d < best) {
        best = d;
        gx = guard.x;
        gy = guard.y;
      }
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    let px = -dy / len;
    let py = dx / len;
    if (px * (gx - p.x) + py * (gy - p.y) > 0) {
      px = -px;
      py = -py;
    }
    return { x: px, y: py, mode: 'sprint' };
  }

  function toward(state, target, sprint, mode = null) {
    const p = state.player;
    const len = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    return {
      x: (target.x - p.x) / len,
      y: (target.y - p.y) / len,
      mode: mode ?? (sprint ? 'sprint' : 'walk'),
    };
  }

  return {
    get waypoint() {
      return wp;
    },
    get done() {
      return wp >= route.length;
    },
    setEscape() {
      mode = 'escape';
    },
    update(state, dt) {
      if (wp >= route.length) return { x: 0, y: 0, mode: 'walk' };
      const target = route[wp];
      const p = state.player;
      const dist = Math.hypot(target.x - p.x, target.y - p.y);
      if (dist < 12) {
        wp += 1;
        waitTime = 0;
        retreatWp = -1;
        return { x: 0, y: 0, mode: 'walk' };
      }

      // Safe again: drop the sticky retreat target.
      if (state.suspicion < 3 && nearestGuard(state) > 80) retreatWp = -1;

      // If the waypoint is in another zone, head for the door between the
      // zones first. The laser gate and the crossing pace only apply once the
      // bot is actually in the vault, at the grid.
      const door = doorBetween(p.x, target.x);
      const nav = door ?? target;
      const crossing = Boolean(target.laserCross) && !door;

      // Mid-grid, never stop: stopping inside the laser band is how a thief
      // gets caught by the beams. Push through to the far side — at a walk,
      // so the crossing stays quiet (a sprint rings a bell the vault guard
      // hears), unless the alarm is already up and speed is all that matters.
      const inGrid = p.x >= 900 && p.x <= 1240 && p.y > 380 && p.y < 560;
      if (inGrid) return toward(state, target, state.alarm || mode === 'escape');

      // Alarm or escape mode: stealth is over. Sprint for the waypoint and
      // ignore the lasers — suspicion is already maxed, so a live beam costs
      // nothing extra, and standing still in front of a chasing guard is fatal.
      // Still, never sprint into a guard standing in the way: sidestep around.
      if (state.alarm || mode === 'escape') {
        if (nearestGuard(state) < 70) {
          const p2 = state.player;
          const dx = nav.x - p2.x;
          const dy = nav.y - p2.y;
          const len = Math.hypot(dx, dy) || 1;
          let gx = 0;
          let gy = 0;
          let best = Infinity;
          for (const guard of state.guards) {
            const d = Math.hypot(guard.x - p2.x, guard.y - p2.y);
            if (d < best) {
              best = d;
              gx = guard.x;
              gy = guard.y;
            }
          }
          // Only sidestep when the guard is ahead of the bot, on the route.
          if (((gx - p2.x) * dx + (gy - p2.y) * dy) / (len * (best || 1)) > 0.3) {
            return sidestepInput(state, nav);
          }
        }
        return toward(state, nav, true);
      }

      // A guard close by, seen or not: a patrolling guard can walk into the
      // player from the side, outside its own cone. Back away at once.
      if (nearestGuard(state) < 65) {
        waitTime = 0;
        return retreatInput(state);
      }
      // Being watched: suspicion rising means a cone has us. Retreat rather
      // than freeze — a guard walking toward a frozen thief catches them.
      if (state.suspicion > 5) {
        waitTime = 0;
        return retreatInput(state);
      }
      // The laser grid: only start across with enough safe time left to clear
      // the beams. The danger band (y 391..549) takes ~1.4 s at a walk with a
      // full bag; the safe window is 2.8 s (off + warning blink), so demand
      // 1.7 s. No guard can see the x=1000 crossing (checked: the nearest
      // cone stays 7+ degrees off), so no guard check is needed here. This
      // gate has NO patience valve: forcing a crossing into live beams once
      // cost the bot its whole run. The bot waits here as long as it takes.
      if (crossing && secondsUntilLaserOn(state.time) < 1.7) {
        return { x: 0, y: 0, mode: 'walk' };
      }
      // Don't walk into a cone that covers the destination right now — or any
      // point along the way there. A reactive bot that only retreats once it
      // is seen gets ratcheted into the alarm by repeated exposure; waiting
      // for a clear path is what keeps the run ghost.
      let pathWatched = wouldBeSeen(state, nav.x, nav.y);
      if (!pathWatched) {
        for (let i = 1; i <= 6 && !pathWatched; i += 1) {
          const t = i / 6;
          const x = p.x + (nav.x - p.x) * t;
          const y = p.y + (nav.y - p.y) * t;
          if (wouldBeSeen(state, x, y)) pathWatched = true;
        }
      }
      if (pathWatched) {
        waitTime += dt;
        if (waitTime < MAX_WAIT) return { x: 0, y: 0, mode: 'walk' };
      }

      waitTime = 0;
      // Inside the vault the guard's beat is dense: sneak (silent) everywhere
      // except the laser crossing itself, which needs the walk's pace to beat
      // the beams' timer.
      const sneak = p.x > 860 && !crossing;
      return toward(state, nav, crossing, sneak ? 'sneak' : null);
    },
  };
}

/** Step the world with the bot until `done(state, bot)` or the step cap. */
function runBot(world, bot, done, maxSteps) {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done(world.state, bot)) break;
    if (world.state.over) break;
    world.step(STEP, bot.update(world.state, STEP));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the approach.
 */
export function stageShot(name, world) {
  world.reset();
  const bot = createBot();

  if (name === 'lasers') {
    // Walk to the grid's edge (waypoint 8 means the duck point is reached),
    // then hold still until the beams switch on: the frame shows the thief
    // waiting on a live red grid, the diamond glinting beyond it.
    runBot(world, bot, (s, b) => b.waypoint >= 8, 6000);
    for (let i = 0; i < 600 && laserStateAt(world.state.time) !== 'on'; i += 1) {
      world.step(STEP, { x: 0, y: 0, mode: 'walk' });
      if (world.state.over) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'grab') {
    // All the way to the diamond; freeze the moment it is taken.
    runBot(world, bot, (s) => s.hasDiamond, 12000);
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'escape') {
    // Steal the diamond, then sprint for the exit and damn the cameras: the
    // frame catches the getaway mid-gallery, alarm climbing, guards closing in.
    runBot(world, bot, (s) => s.hasDiamond, 12000);
    bot.setEscape();
    for (let i = 0; i < 6 / STEP; i += 1) {
      if (world.state.over) break;
      world.step(STEP, bot.update(world.state, STEP));
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // approach (default): into the gallery, near the first guard's beat.
  runBot(world, bot, (s, b) => b.waypoint >= 3, 3600);
  return { screen: SCREEN_PLAY, best: 0 };
}
