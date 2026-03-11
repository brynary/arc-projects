Goal: Build Fabro Racer Mini — a 3D voxel kart racer using Three.js with 2 tracks, 4 characters, 3 items, drifting, and CPU opponents. Output is static HTML + JS files. (Trimodal validation)

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 33.7k tokens in / 14.6k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **review_spec**: success
  - Model: claude-opus-4-6, 40.1k tokens in / 11.8k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **plan_fanout**: success

## Context
- parallel.branch_count: 3
- parallel.results: [{"head_sha":"2f267c29d03b1819a3f0822f456a81dee6664268","id":"plan_opus","status":"success"},{"head_sha":"1aeabef106c62580862ff24fa17eaa11b52981dd","id":"plan_gpt","status":"success"},{"head_sha":"3239a4b21c8dddb4b018cbf0b36a04e069f9a57a","id":"plan_gemini","status":"success"}]


Synthesize three implementation plans into a single best-of-breed \
final plan.

\
Read branch outputs via parallel_results.json. If missing, fall back to \
.workflow/plan_opus.md, .workflow/plan_gpt.md, and .workflow/plan_gemini.md.

\
If .workflow/postmortem_latest.md exists, read it FIRST and adjust the plan \
to address every issue identified.

\
Read .workflow/spec.md for context. Resolve conflicts between plans. Pick \
the most detailed approach for each module. Ensure dependency order is correct.

\
The final plan must produce a work queue of bounded implementation phases:
\
1. Project scaffold + Three.js scene
\
2. Track geometry + rendering
\
3. Kart physics + driving model
\
4. Drift/boost system
\
5. Items + pickups
\
6. AI opponents
\
7. HUD + menus + audio
\
8. Polish + textures (imagegen)

\
Write to .workflow/plan_final.md.