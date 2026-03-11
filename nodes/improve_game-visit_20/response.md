The three camera improvements are complete:

1. **Countdown flyover camera** — Per spec, the camera now does a 3s sweeping aerial flyover of the track before cutting to behind-the-player view for 3-2-1-GO. Uses eased spline following at altitude with gentle side sway.

2. **Spline-aware look-ahead** — Camera look-at target blends with the track spline's upcoming direction (up to 40% at high speed), so it anticipates corners and keeps the kart in frame during tight turns.

3. **Camera shake on impacts** — Wall hits (0.3), kart bumps (0.15), and item hits (0.5) trigger decaying position perturbation for impactful feedback.

All verified with zero errors across all 4 tracks.