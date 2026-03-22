All 44 tests pass. The existing `spec.md` is already thorough and covers every area you requested. Here's a summary of what's in it:

| Requested Topic | Spec Coverage |
|---|---|
| **Game rules & data structures** | §3 (Rules of Play) + §4 (Core Data Model: `Card`, `Deck`, `Suit`, `StockPile`, `WastePile`, `FoundationPile`, `TableauPile`, `GameState`, `CursorPosition`, `Selection`) |
| **Terminal rendering (curses)** | §6 (screen init, color pairs, card rendering format, rendering strategy for piles) |
| **Input handling & move validation** | §5 (legal sources, legal destinations, validation helpers, atomic move application) + §8 (key map, input state machine, invalid input handling) |
| **Win/loss detection** | §9 (win = all 52 cards on foundations; no hard loss; optional soft "no moves" hint) |
| **UI layout** | §7 (full ASCII mockup, layout requirements, cursor behavior — card-aware for tableau, pile-aware elsewhere) |
| **Test strategy** | §12 (unit tests for cards/rules, initial deal, move execution, stock/waste cycle, win detection, property/invariant tests, UI helper tests, manual test checklist) |

The spec also includes §10 (Architecture / module split), §11 (Error handling & edge cases), §13 (Acceptance criteria), and §14 (Future enhancements).

The implementation is **complete and working** — all source files (`models.py`, `game.py`, `ui.py`, `main.py`) plus a full test suite (44 tests) are already in place and passing. A code review (`review.md`) has also been done, noting only minor issues (foundation suit labels in UI, too-small-terminal confirmation prompt, and light curses render-path test coverage).

The `spec.md` already exists and fully satisfies the request. No changes are needed.