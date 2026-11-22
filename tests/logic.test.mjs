// Headless tests for Night Shift (node, no DOM): geometry, detection, lasers,
// noise, loot, win/lose, and the bot playtest. Run: node tests/logic.test.mjs
import { STEP } from '../game/src/config.js';
import { createRandom } from '../game/src/random.js';
import {
  EVENT_CAUGHT,
  EVENT_WIN,
  createWorld,
  hasLineOfSight,
  laserStateAt,
  pointInCone,
  secondsUntilLaserOn,
  segmentHitsRect,
  wouldBeSeen,
} from '../game/src/world.js';
import { createBot } from '../game/src/shots.js';

let passed = 0;
let failed = 0;
function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// --- geometry ---
check('cone: point ahead inside', pointInCone(100, 0, 0, 0, 0, 0.5, 200));
check('cone: point behind outside', !pointInCone(-100, 0, 0, 0, 0, 0.5, 200));
check('cone: point past range outside', !pointInCone(300, 0, 0, 0, 0, 0.5, 200));
check('cone: point at 45deg outside 30deg half-angle', !pointInCone(100, 100, 0, 0, 0, 0.52, 200));
check('cone: point at 20deg inside 30deg half-angle', pointInCone(100, 36, 0, 0, 0, 0.52, 200));
check('segment: crossing rect hits', segmentHitsRect(0, 50, 100, 50, { x: 40, y: 0, w: 20, h: 100 }));
check('segment: missing rect misses', !segmentHitsRect(0, 50, 100, 50, { x: 40, y: 80, w: 20, h: 100 }));
check('segment: inside rect hits', segmentHitsRect(45, 10, 55, 90, { x: 40, y: 0, w: 20, h: 100 }));
check('sight: open gallery floor', hasLineOfSight(400, 360, 800, 360));
check('sight: blocked by the gallery wall', !hasLineOfSight(300, 100, 400, 100));
check('sight: through the gallery door', hasLineOfSight(300, 360, 400, 360));
check('sight: blocked by the vault wall', !hasLineOfSight(800, 500, 900, 500));
check('sight: through the vault door', hasLineOfSight(800, 240, 900, 240));

// --- lasers ---
check('laser: t=0 off', laserStateAt(0) === 'off');
check('laser: t=1.9 off', laserStateAt(1.9) === 'off');
check('laser: t=2.0 warn', laserStateAt(2.0) === 'warn');
check('laser: t=2.7 warn', laserStateAt(2.7) === 'warn');
check('laser: t=2.8 on', laserStateAt(2.8) === 'on');
check('laser: t=5.1 on', laserStateAt(5.1) === 'on');
check('laser: t=5.2 off again (cycle)', laserStateAt(5.2) === 'off');
check('laser: t=10.4 off again (2 cycles)', laserStateAt(10.4) === 'off');
check('laser: seconds until on at t=0 is 2.8', near(secondsUntilLaserOn(0), 2.8));
check('laser: seconds until on at t=2.5 is 0.3', near(secondsUntilLaserOn(2.5), 0.3));
check('laser: seconds until on at t=3.5 is 0', near(secondsUntilLaserOn(3.5), 0));

// --- detection, suspicion, alarm ---
{
  const world = createWorld(createRandom(1));
  const s = world.state;
  // Put the player in front of guard 2 (gallery), in the open, and hold still.
  // The guard's next waypoint is east of it, so it keeps facing the player.
  const g = s.guards[1];
  g.x = 600;
  g.y = 300;
  g.wps = [{ x: 780, y: 300 }];
  g.wp = 0;
  g.facing = 0; // east
  g.state = 'patrol';
  g.pause = 60; // hold the guard in place
  s.player.x = 700;
  s.player.y = 300;
  const seenBefore = wouldBeSeen(s, 700, 300);
  check('detection: player in a guard cone is seen', seenBefore);
  for (let i = 0; i < 60; i += 1) world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('detection: suspicion rises while seen', s.suspicion > 0, `suspicion=${s.suspicion}`);
  // Step out of the cone: suspicion decays.
  s.player.x = 600;
  s.player.y = 600;
  const high = s.suspicion;
  for (let i = 0; i < 120; i += 1) world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('detection: suspicion decays while hidden', s.suspicion < high, `before=${high} after=${s.suspicion}`);
}

{
  // A long stare trips the alarm.
  const world = createWorld(createRandom(1));
  const s = world.state;
  const g = s.guards[1];
  g.x = 600;
  g.y = 300;
  g.wps = [{ x: 780, y: 300 }];
  g.wp = 0;
  g.facing = 0;
  g.pause = 60;
  s.player.x = 700;
  s.player.y = 300;
  let alarmAt = -1;
  for (let i = 0; i < 600; i += 1) {
    world.step(STEP, { x: 0, y: 0, mode: 'walk' });
    if (s.alarm) {
      alarmAt = s.time;
      break;
    }
  }
  check('alarm: trips after a sustained stare', alarmAt > 0, `alarmAt=${alarmAt}`);
  // Guards switch on the step after the alarm trips (the guard loop runs first).
  world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('alarm: guards switch to chase', s.guards.every((guard) => guard.state === 'chase'));
}

// --- lasers bite ---
{
  const world = createWorld(createRandom(1));
  const s = world.state;
  // Stand on a beam while the grid is on (t=3.0 is inside the on-phase).
  s.player.x = 1100;
  s.player.y = 470;
  s.time = 3.0;
  world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('laser: crossing a live beam adds suspicion', s.suspicion >= 50, `suspicion=${s.suspicion}`);
  // Same spot while the grid is off: nothing happens.
  const world2 = createWorld(createRandom(1));
  const s2 = world2.state;
  s2.player.x = 1100;
  s2.player.y = 470;
  s2.time = 0.5;
  world2.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('laser: an off grid is harmless', s2.suspicion === 0, `suspicion=${s2.suspicion}`);
}

// --- noise draws a guard ---
{
  const world = createWorld(createRandom(1));
  const s = world.state;
  const g = s.guards[0];
  g.x = 200;
  g.y = 360;
  g.pause = 0;
  s.player.x = 100;
  s.player.y = 360;
  // Sprint west for a second: the guard is 100px away, inside the sprint radius.
  for (let i = 0; i < 60; i += 1) world.step(STEP, { x: -1, y: 0, mode: 'sprint' });
  check('noise: sprinting nearby sends the guard to investigate', g.state === 'investigate', `state=${g.state}`);
}

// --- loot, weight, win, caught ---
{
  const world = createWorld(createRandom(1));
  const s = world.state;
  // Walk the player onto the mask.
  s.player.x = 500;
  s.player.y = 235;
  world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('loot: pickup adds value', s.lootValue === 4000 && s.carried === 1, `value=${s.lootValue}`);
  // Loot slows the player: same input, less distance with a full bag.
  const w1 = createWorld(createRandom(1));
  const w2 = createWorld(createRandom(1));
  w2.state.carried = 4;
  for (let i = 0; i < 60; i += 1) {
    w1.step(STEP, { x: 1, y: 0, mode: 'walk' });
    w2.step(STEP, { x: 1, y: 0, mode: 'walk' });
  }
  check('loot: weight slows the player', w2.state.player.x < w1.state.player.x,
    `light=${w1.state.player.x.toFixed(1)} heavy=${w2.state.player.x.toFixed(1)}`);
}

{
  const world = createWorld(createRandom(1));
  const s = world.state;
  s.hasDiamond = true;
  s.lootValue = 10000;
  s.player.x = 24;
  s.player.y = 648;
  const events = world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('win: diamond + exit wins', Boolean(events & EVENT_WIN) && s.won && s.over);
  check('win: ghost bonus included when no alarm', s.score === 10000 + 2000 + 1000, `score=${s.score}`);
}

{
  const world = createWorld(createRandom(1));
  const s = world.state;
  const g = s.guards[0];
  g.x = s.player.x + 10;
  g.y = s.player.y;
  const events = world.step(STEP, { x: 0, y: 0, mode: 'walk' });
  check('caught: a guard at arm\'s length catches the player', Boolean(events & EVENT_CAUGHT) && s.caught);
}

// --- determinism: the same seed replays the same run ---
{
  function replay() {
    const world = createWorld(createRandom(1));
    const bot = createBot();
    for (let i = 0; i < 3000; i += 1) world.step(STEP, bot.update(world.state, STEP));
    const s = world.state;
    return [s.player.x.toFixed(3), s.player.y.toFixed(3), s.lootValue, s.suspicion.toFixed(3), bot.waypoint];
  }
  const a = replay();
  const b = replay();
  check('determinism: same seed replays identically', JSON.stringify(a) === JSON.stringify(b), `${a} vs ${b}`);
}

// --- the bot playtest: seeds 1..5 must all end in a clean getaway ---
for (const seed of [1, 2, 3, 4, 5]) {
  const world = createWorld(createRandom(seed));
  const bot = createBot();
  const maxSteps = 240 / STEP;
  let steps = 0;
  for (; steps < maxSteps; steps += 1) {
    if (world.state.over) break;
    world.step(STEP, bot.update(world.state, STEP));
  }
  const s = world.state;
  check(
    `playtest seed ${seed}: bot wins`,
    s.won,
    `over=${s.over} won=${s.won} caught=${s.caught} time=${s.time.toFixed(1)}s loot=$${s.lootValue} wp=${bot.waypoint}/${15} suspicion=${s.suspicion.toFixed(0)} alarm=${s.alarmEver}`,
  );
  if (s.won) console.log(`       seed ${seed}: ${s.time.toFixed(1)}s, take $${s.score}, ghost=${!s.alarmEver}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
