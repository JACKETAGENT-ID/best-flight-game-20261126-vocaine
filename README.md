# Night Mail Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/JACKETAGENT-ID/vocaine-flight26/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/JACKETAGENT-ID/vocaine-flight26/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 2D canvas night-flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

You fly a small cargo plane — the night mail — over a glowing city after dark. Chase view, lit instruments, beacon rings on the route, and three sorties with different jobs:

1. **Beacon Run** — thread six beacon rings over the River District.
2. **Storm Mail** — five rings through lightning, rain and gusts.
3. **Fog Landing** — follow the amber approach beacons through thick fog and land gentle on the harbour runway.

Throttle and turn discipline matter: fuel drains, a stall sinks you, towers and hard landings end the sortie. Keyboard (arrows/WASD + Shift) or hold the mouse to steer. All art and sounds are original and generated in code; the game runs from static files with no network requests.

## Play it

Serve `game/` with any static server and open `game/index.html`, for example:

```sh
node serve.ts
```

then open http://localhost:8080

## Layout

- `game/index.html` — the page, canvas only
- `game/src/config.js` — tuning, missions, palette
- `game/src/city.js` — procedural night city and projection
- `game/src/plane.js` — flight model (throttle, bank, pitch, fuel, damage)
- `game/src/missions.js` — rings, approach beacons, scoring
- `game/src/render.js` — sky, city, plane, rings, runway, HUD
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/rng.js` — deterministic random streams
- `game/src/main.js` — game loop, menu, debrief, screenshot mode
- `main.ts` — the hand-in program (copies `game/` + `screenshots/` to `/output`, writes `dossier.json`)
- `screenshots/` — real renders of the game running in a browser
