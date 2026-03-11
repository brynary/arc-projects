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
