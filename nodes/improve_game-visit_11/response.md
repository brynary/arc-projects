The three crash & error fixes are complete:

1. **Physics step cap (3 → 8) + accumulator safety valve** — The game was running in slow motion at low framerates because only 3 physics steps per frame were allowed. With the dt cap of 0.1s and FIXED_DT of 1/60, 6 steps are needed. Increased to 8 with headroom. Added a safety valve that clamps the accumulator to 4 steps if it grows past 0.2s (prevents catch-up bursts after tab backgrounding).

2. **DNF sort order in race results** — `finishTime: null` (DNF) coerces to 0 in JavaScript arithmetic, incorrectly placing DNF karts before timed finishers. Added explicit null checks so DNFs always sort last among finished karts.

3. **Race event priority for player** — The single-value `raceFinished`/`lapCompleted` events could be overwritten when multiple karts triggered them in the same physics frame. If the player and an AI both finished simultaneously, the player's finish event was lost and the game never transitioned to RACE_FINISH. Now player events take priority and can't be overwritten.