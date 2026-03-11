Goal: Build Fabro Racer Mini — a 3D voxel kart racer using Three.js with 2 tracks, 4 characters, 3 items, drifting, and CPU opponents. Output is static HTML + JS files. (Trimodal validation)

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 33.7k tokens in / 14.6k out
  - Files: /home/daytona/workspace/.workflow/spec.md


Read .workflow/spec.md critically. Check for:
\
- Completeness: both tracks, 4 characters, 3 items, drift system, \
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