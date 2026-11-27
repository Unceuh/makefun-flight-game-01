# Garuda Kargo — pilot kargo antar pulau

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Unceuh/makefun-flight-game-01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Unceuh/makefun-flight-game-01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Entry for [make.fun's "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

**Garuda Kargo** is an island-hopping cargo flight game, built from scratch in vanilla
JavaScript on a 2D canvas — no libraries, no network, deterministic (seeded RNG).

Take off from Pulau Garuda, thread three glowing rings over the sea and Krakatau, drop your
cargo over Pulau Komodo (Space), and put the plane down on Pulau Raja's short runway — then
do it again, harder, until the 150-second day runs out. Fuel drains with the throttle, hard
landings add damage, and three lost planes end the day.

## Controls

- **↑ / ↓** (or **W / S**) — pitch up / down
- **→ / ←** (or **D / A**) — throttle up / down
- **Space** — drop cargo over the zone
- **P** — pause · **Enter** — start / restart
- **Mouse** — hold to steer: above the middle climbs, below it descends; click drops cargo

## Play

```sh
node serve.ts   # from the kit, then open http://localhost:8080
```

Or open `game/index.html` from any static server. `?seed=N` fixes the island layout;
`?shot=play|drop|land|end&seed=N` stages a screenshot scene.

## Layout

- `game/index.html` — the page, one canvas
- `game/src/config.js` — tuning, islands, missions, palette
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/src/world.js` — flight model, terrain, missions, fuel, damage, score
- `game/src/pilot.js` — the autopilot (screenshot scenes + play-test)
- `game/src/input.js` — keyboard and pointer input
- `game/src/render.js` — sky, sea, islands, plane, lit instruments, HUD
- `game/src/shots.js` — the screenshot scenes
- `game/src/main.js` — boot and the fixed-step loop
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
