Goal: Build Fabro Racer — a 3D voxel kart racer using Three.js with 4 tracks, 8 characters, items, drifting, and CPU opponents. Output is static HTML + JS files.

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 27.9k tokens in / 16.3k out
  - Files: /home/daytona/workspace/.workflow/spec.md


Read .workflow/spec.md critically. Check for:
\
- Completeness: all 4 tracks, 8 characters, 6 items, drift system, \
AI behavior, HUD, and audio are specified
\
- Internal consistency: no contradictions in physics/timing values
\
- Testability: every requirement can be verified by playing the game
\
- Missing edge cases: what happens at track boundaries, item collisions, \
race finish ties

\
Write specific improvements to .workflow/spec-review.md.
\
Then apply the improvements by updating .workflow/spec.md directly.