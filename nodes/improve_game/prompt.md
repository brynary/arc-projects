Goal: Build Fabro Racer Mini — a 3D voxel kart racer using Three.js with 2 tracks, 4 characters, 3 items, drifting, and CPU opponents. Output is static HTML + JS files. (Trimodal validation)

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 33.7k tokens in / 14.6k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **review_spec**: success
  - Model: claude-opus-4-6, 40.1k tokens in / 11.8k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **plan_fanout**: success
- **debate**: success
  - Model: claude-opus-4-6, 86.0k tokens in / 21.1k out
  - Files: /home/daytona/workspace/.workflow/plan_final.md
- **implement_core**: success
  - Model: claude-opus-4-6, 151.9k tokens in / 48.7k out
  - Files: /home/daytona/workspace/.workflow/implementation-core.md, /home/daytona/workspace/output/index.html, /home/daytona/workspace/output/js/drift.js, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/output/js/physics.js
- **verify_core**: success
  - Model: claude-opus-4-6, 61.0k tokens in / 10.3k out
  - Files: /home/daytona/workspace/verify-core.mjs
- **gate_core**: success
- **implement_gameplay**: success
  - Model: claude-opus-4-6, 106.5k tokens in / 34.1k out
  - Files: /home/daytona/workspace/.workflow/implementation-gameplay.md, /home/daytona/workspace/output/js/ai.js, /home/daytona/workspace/output/js/items.js, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/output/js/physics.js, /home/daytona/workspace/output/js/tracks/sunsetCircuit.js
- **verify_gameplay**: success
  - Model: claude-opus-4-6, 107.0k tokens in / 24.2k out
  - Files: /home/daytona/workspace/verify-gameplay.mjs
- **gate_gameplay**: success
- **implement_polish**: success
  - Model: claude-opus-4-6, 44.9k tokens in / 21.8k out
  - Files: /home/daytona/workspace/.workflow/implementation-polish.md, /home/daytona/workspace/output/js/main.js
- **verify_build**: success
  - Script: `test -f output/index.html && echo 'index.html exists' \
&& grep -q 'three' output/index.html output/js/*.js 2>/dev/null \
&& echo 'Three.js references found' \
&& echo 'OK'`
  - Stdout:
    ```
    index.html exists
Three.js references found
OK
    ```
  - Stderr: (empty)
- **verify_playtest**: success
  - Model: claude-opus-4-6, 147.0k tokens in / 37.7k out
  - Files: /home/daytona/workspace/.workflow/playtest-report.md, /home/daytona/workspace/playtest-deterministic.mjs, /home/daytona/workspace/playtest-drift.mjs, /home/daytona/workspace/playtest-drift2.mjs, /home/daytona/workspace/playtest-followup.mjs, /home/daytona/workspace/playtest.mjs
- **gate_playtest**: success
- **pick_improvement**: success
  - Script: `bash workflows/kart-racer-trimodal-mini/scripts/pick-improvement.sh`
  - Stdout:
    ```
    Focus: 5
Wrote .workflow/improvement.md — Focus 5: AI Reliability
    ```
  - Stderr: (empty)

## Context
- core_ok: true
- gameplay_ok: true
- parallel.branch_count: 3
- parallel.results: [{"head_sha":"2f267c29d03b1819a3f0822f456a81dee6664268","id":"plan_opus","status":"success"},{"head_sha":"1aeabef106c62580862ff24fa17eaa11b52981dd","id":"plan_gpt","status":"success"},{"head_sha":"3239a4b21c8dddb4b018cbf0b36a04e069f9a57a","id":"plan_gemini","status":"success"}]
- playtest_pass: true


# Improve Game — Iteration

You are in the iterative improvement phase. The priority is making the game feel rock solid — if it doesn't work properly, it can't be fun.

## Setup

1. Read `.workflow/improvement.md` for your assigned focus area
2. Read `.workflow/spec.md` for game requirements
3. Read `.workflow/improve_log.md` if it exists to see what was already improved
4. Review the current codebase in `output/`

## Instructions

1. Pick 2-4 concrete improvements from your assigned focus area
2. Implement each improvement in the game code under `output/`
3. Start a local server: `npx serve output -p 4567 &`
4. Use Playwright to verify your changes work correctly (take screenshots)
5. Kill the server when done
6. Append a summary of what you changed to `.workflow/improve_log.md` in this format:

```
## Iteration N — Focus: [Name]
- [Change 1]: [brief description]
- [Change 2]: [brief description]
- Verified: [pass/fail with notes]
```

Be surgical. Make small, testable changes. Don't break what already works.
