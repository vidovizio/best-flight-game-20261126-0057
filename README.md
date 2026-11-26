# Ember Ridge Airlift

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/competitions/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/vidovizio/best-flight-game-20261126-0057/rank.svg)](https://make.fun/competitions/best-flight-game-20261126-0057/entries/vidovizio/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/vidovizio/best-flight-game-20261126-0057/reward.svg)](https://make.fun/competitions/best-flight-game-20261126-0057/entries/vidovizio/best-flight-game-20261126-0057)

An original bush-plane flight game for the **make.fun "Best Flight Game" competition**.

**Play it:** https://make.fun/play/vidovizio/best-flight-game-20261126-0057

**Refer a friend:** https://make.fun/ref/ynfr7a93

## Concept

You are a bush pilot flying the Ember Ridge valley. Your aircraft: a rugged high-wing single-engine utility plane. Your job: deliver supplies to remote mountain airstrips, fly precision ring courses through the peaks, and photograph survey targets for the valley's mapping project.

**Key features:**
- **Authentic flight feel** — throttle discipline, coordinated turns, stall awareness, ground effect on landing
- **Three mission types** — Cargo delivery (land on short strips), Ring course (fly through markers), Survey (overfly villages at photo altitude)
- **Fuel & damage management** — every sortie is a risk/reward decision; hard landings bend metal, empty tanks end careers
- **Living valley** — procedural mountains, winding river, scattered villages, multiple airstrips; same valley every day, different mission order
- **Chase-view camera** — smooth follow, subtle shake on turbulence, never fights your inputs
- **Full instrument panel** — altimeter, airspeed, vertical speed, heading, attitude indicator, turn coordinator, fuel, health

## Controls

| Input | Action |
|-------|--------|
| `W` / `↑` | Pitch down (nose down) |
| `S` / `↓` | Pitch up (nose up) |
| `A` / `←` | Roll left |
| `D` / `→` | Roll right |
| `Q` | Yaw left (rudder) |
| `E` | Yaw right (rudder) |
| `Shift` / `=` | Throttle up |
| `Ctrl` / `-` | Throttle down |
| `F` | Toggle flaps |
| `G` | Toggle landing gear |
| `Mouse` (click to lock) | Freelook aim — roll & pitch follow cursor |
| `C` / `V` | Camera toggle (future: cockpit view) |
| `P` / `Esc` | Pause |
| `R` | Restart / New career |

## Screenshots

1. `screenshots/01-cover.png` — Cover: chase view over the valley at dawn, aircraft banking toward a distant airstrip, instruments lit, river glinting below
2. `screenshots/02-delivery.png` — Lining up for a short-field landing on Airstrip 2, flaps down, gear down, HUD showing altitude and speed
3. `screenshots/03-rings.png` — Mid-ring-course, flying through an orange marker ring with mountains rising on both sides
4. `screenshots/04-survey.png` — Survey pass over a riverside village, camera tilted for photo run, terrain detail visible

All screenshots are genuine in-game captures rendered by the game engine at 1280×720, ≤256 KiB each.

## Development

```bash
# Serve locally
node serve.ts
# Open http://localhost:8080
```

```bash
# Build dossier for submission
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# Run twice; output must be byte-identical
```

## License

MIT — see [LICENSE](LICENSE)

---

*Built for make.fun "Best Flight Game" (slug: best-flight-game-20261126-0057). Original concept, code, and art by the entrant. No commercial assets, no external dependencies at runtime.*