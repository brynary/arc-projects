# Core Verification Results

## Status: ✅ ALL PASSED

## Checks

| # | Check | Result | Details |
|---|-------|--------|---------|
| 1 | HTML loads (status 200) | ✅ | status=200 |
| 2 | Canvas element exists | ✅ |  |
| 3 | UI overlay exists | ✅ |  |
| 4 | Page title correct | ✅ | "Fabro Racer Mini" |
| 5 | No critical JS errors on load | ✅ | clean |
| 6 | WebGL canvas has dimensions | ✅ |  |
| 7 | render_game_to_text() hook exists | ✅ |  |
| 8 | Game starts in menu state | ✅ | mode="menu" |
| 9 | Game entered racing state | ✅ | mode="racing" |
| 10 | Track is loaded | ✅ | track="Sunset Circuit" |
| 11 | Player kart exists | ✅ |  |
| 12 | Player has position | ✅ | pos=(-3.0, -0.0, 10.0) |
| 13 | Player has max speed | ✅ | maxSpeed=48.0 |
| 14 | Canvas visible with proper dimensions | ✅ | 1280x720 |
| 15 | HUD is visible during race | ✅ |  |
| 16 | HUD shows position | ✅ | "1ST" |
| 17 | HUD shows lap counter | ✅ | "LAP 1/3" |
| 18 | HUD shows timer | ✅ | "0:01.067" |
| 19 | HUD shows speed | ✅ | "0%" |
| 20 | Initial speed is ~0 | ✅ | speed=0 |
| 21 | Kart accelerates with W key | ✅ | speed: 0 → 14.6 |
| 22 | Kart moved after acceleration | ✅ | moved 6.6 units |
| 23 | Kart heading changes with A key | ✅ | heading diff=1.09 |
| 24 | Kart decelerates with S key | ✅ | speed: 14.6 → 0.1 |
| 25 | advanceTime() returns valid state | ✅ |  |
| 26 | advanceTime() advances timer | ✅ | timer=4.583 |
| 27 | Escape pauses game | ✅ | mode="paused" |
| 28 | Escape resumes game | ✅ | mode="racing" |
| 29 | No significant JS errors during gameplay | ✅ | clean |

## Screenshots

- `screenshots/01-menu.png` — Title/menu screen
- `screenshots/02-track-loaded.png` — Track loaded, racing state
- `screenshots/03-after-accel.png` — After W key acceleration
- `screenshots/04-after-steer-brake.png` — After steering and braking
- `screenshots/05-paused.png` — Pause menu

## Context Update

{"context_updates": {"core_ok": "true"}}
