The spec already exists at `/home/daytona/workspace/apps/solitaire/spec.md` and is comprehensive — it covers all the topics you listed across 14 sections and ~560 lines. Here's a summary of what's already documented:

| Requested Topic | Spec Coverage |
|---|---|
| **Game rules & data structures** | §3 (Rules of Play), §4 (Core Data Model) — Card, Deck, Suit, pile types (Stock, Waste, Foundation, Tableau), GameState, Selection/Cursor |
| **Terminal rendering approach** | §6 (Terminal Rendering) — curses setup, color pairs, card format, rendering strategy per pile type |
| **Input handling & move validation** | §5 (Move Validation Rules), §8 (Input Handling) — legal sources/destinations, validation helpers, atomic moves, key map, state machine |
| **Win/loss detection** | §9 (Win and Progress Detection) — win = 52 cards on foundations, no hard loss state, optional soft "no moves" hint |
| **UI layout** | §7 (UI Layout Spec) — ASCII mockup of full board, cursor behavior options (pile-based vs card-aware), status/help area |
| **Test strategy** | §12 (Test Strategy) — unit tests for cards/rules, deal, moves, stock/waste cycle, win detection, invariant tests, UI helpers, manual QA checklist |

Additionally, the project already has a full implementation (`src/models.py`, `src/game.py`, `src/ui.py`, `main.py`), a test suite (44 tests passing), a README, and a code review (`review.md`) identifying minor follow-up items.

The spec is already written and thorough — no changes needed. Would you like me to proceed with something else, such as addressing the review findings, adding features, or running the tests?