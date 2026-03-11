All 3 improvements are complete and verified:

1. **Engine sound smoothing**: Added lowpass filter (400–1200Hz cutoff modulated by speed) to warm up the raw sawtooth oscillator. Gain ramps up on start and fades out on stop to eliminate clicks/pops.

2. **Dynamic shadow camera**: Directional light now follows the player kart every frame, ensuring shadows are always visible regardless of where on the track the player is.

3. **Missing audio events hooked**: Connected 5 previously-unlinked audio functions: drift start, drift tier up, boost fire, wall hit, and kart-kart bump. All trigger only for the player kart to avoid audio spam.

All 4 tracks load and race with zero console errors, 8/8 karts on each.