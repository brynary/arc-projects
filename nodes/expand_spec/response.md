The spec already exists at `apps/solitaire/spec.md` and is comprehensive. It covers all six areas you requested:

| Requested Topic | Spec Coverage |
|---|---|
| **Game rules & data structures** | §3 (Rules of Play), §4 (Core Data Model) — Card, Deck, Suit, all pile types (Stock, Waste, Foundation, Tableau), GameState, Cursor/Selection |
| **Terminal rendering (curses)** | §6 (Terminal Rendering Approach) — `curses.wrapper`, color pairs, card rendering format, Unicode/ASCII fallback, rendering strategy per pile type |
| **Input handling & move validation** | §5 (Move Validation Rules), §8 (Input Handling) — legal sources/destinations, validation helpers, atomic moves, key map, state machine (`NAVIGATE`→`SELECTED`→`WON`) |
| **Win/loss detection** | §9 (Win and Progress Detection) — win when foundations total 52 cards, no hard loss state, optional soft "no moves" hint |
| **UI layout** | §7 (UI Layout Specification) — ASCII art mockup, header/top-row/tableau/status zones, 100×30 minimum, card-aware cursor for tableau |
| **Test strategy** | §12 (Test Strategy) — unit tests for cards, rules, deals, moves, stock/waste cycle, win detection; property/invariant tests; UI helper tests; manual QA checklist |

The spec also includes additional sections on architecture (§10), error handling/edge cases (§11), acceptance criteria (§13), and future enhancements (§14).

The implementation is fully built out across `src/models.py`, `src/game.py`, `src/ui.py`, and `main.py`, with 44 passing tests. A `review.md` documents the code review findings (all minor). The spec as written guided a complete, working terminal solitaire game — no changes needed.