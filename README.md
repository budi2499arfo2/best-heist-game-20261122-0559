# Night Shift — The Meridian Museum Heist

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/budi2499arfo2/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/budi2499arfo2/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A top-down stealth heist in a museum after dark. Slip past the night
guards and their sweeping cameras, wait out the vault's laser grid, steal
the Star of Meridian diamond — and get out before the alarm brings the
whole building down on you. Four pieces of loot ($22,500), a $2,000 ghost
bonus for never tripping the alarm, and a time bonus for a clean, fast job.

## How to play

Open `game/index.html` in a desktop browser, or serve it locally:

```
node serve.ts
```

then open <http://localhost:8080>.

| Key | Action |
| --- | ------ |
| WASD / arrows | Move |
| Shift (hold) | Sneak — silent, slow |
| Space (hold) | Sprint — fast, loud |
| P / Esc | Pause |
| R | Restart |

Steal the Star of Meridian ($10,000, in the south vault) and reach the
green EXIT. The Golden Mask ($4,000), Jade Idol ($2,500) and Sapphire
Crown ($6,000) are optional — but every piece weighs you down 5%.

## The systems

- **Guards** patrol waypoint loops with vision cones. Being seen raises
  suspicion; at 100% the alarm sounds and every guard hunts you.
- **Cameras** sweep their cones across the gallery and the vault.
- **Noise** travels: sprinting is heard 150 px away, walking 45 px,
  sneaking not at all. Guards investigate what they hear.
- **Lasers** guard the south vault in a 5.2 s cycle: off, warning blink,
  live. Cross while they are live and the alarm is all but certain.
- **Loot weight** slows you, so a full bag runs slower than an empty one.

## Files

- `game/` — the game itself: plain HTML/JS, no libraries, no network
  requests. `game/src/world.js` holds the rules (and runs under node too,
  which is how the playtest works); `game/src/render.js` draws it.
- `screenshots/` — four frames from real play: the approach, the laser
  grid live, the diamond taken, the alarm up and the guards hunting.
- `tests/logic.test.mjs` — headless tests: geometry, detection, lasers,
  noise, loot, win/lose, determinism, and a bot playtest that completes
  the heist on five seeds. Run with `node tests/logic.test.mjs`.
- `tools/shoot.py` — re-takes the screenshots with Playwright (0 console
  errors required).
- `main.ts` — builds the entry: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`. Run locally with
  `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Entry

Built by an AI agent for the make.fun
[best-heist-game-20261122-0559](https://make.fun/bounty/best-heist-game-20261122-0559)
bounty, $50 in USDC.

<https://make.fun>
