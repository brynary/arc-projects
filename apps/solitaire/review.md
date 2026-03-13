# Klondike Solitaire Review

## Scope reviewed
- `spec.md` (full)
- `README.md`
- `main.py`
- `src/models.py`
- `src/game.py`
- `src/ui.py`
- `tests/`

## Test execution
Requested command:
- `python3 -m pytest tests/ -v`

Result in this environment:
- `python3` is not installed (`sh: 1: python3: not found`)

Equivalent command run successfully:
- `.venv/bin/python -m pytest tests/ -v`
- Result: **44 passed**

## Summary
Overall, this is a strong implementation.

### What looks good
- Core Klondike rules are implemented cleanly and largely match the spec.
- Game logic is well separated from the curses UI.
- Stock/waste recycle order is correct for draw-one Klondike.
- Tableau run validation, auto-flip behavior, foundation rules, undo, and win detection are all handled well.
- The UI code is structured clearly, with pure helpers for layout/navigation that are testable outside curses.
- The README is concise, accurate, and usable.
- The test suite is solid for models and game logic, and all tests pass.

## Findings

### 1. Medium: empty foundation piles are fixed-suit, but the UI does not show their suit mapping
`new_game()` creates four preconfigured foundations in `Suit` order, so the piles are effectively suit-specific from the start. However, `ui.py` labels them only as `F1` to `F4`, and empty piles all render as identical `--` placeholders.

Impact:
- A player cannot tell which empty foundation corresponds to which suit.
- Manual moves to empty foundations are therefore not intuitive.
- The `F` shortcut helps, but it does not fully solve the discoverability problem for normal cursor-based play.

Why this matters:
- The implementation is rule-correct internally.
- The UI is less intuitive than the spec intends because one of the main destination types is ambiguous when empty.

Suggested fix:
- Show suit labels for the four foundations (for example `♥ ♦ ♣ ♠`, or `FH FD FC FS` in ASCII mode), or
- Switch empty foundations to dynamic suit assignment on first Ace if that interaction is preferred.

### 2. Minor: too-small-terminal mode hides quit/new confirmation prompts
When the terminal is smaller than the required layout, `render()` returns early and only displays the resize warning. However, `handle_key()` can still set `pending_action` to `"quit"` or `"new"`.

Impact:
- The screen says `Resize the terminal or press Q to quit.`
- Pressing `Q` does not immediately quit; it enters confirmation mode.
- That confirmation prompt is not shown while the terminal is too small, because the normal status area is not rendered in that path.

Suggested fix:
- Either allow direct quit from the too-small screen, or
- Render the pending confirmation prompt even when the normal board layout cannot be shown.

### 3. Minor: UI tests are good, but full render-path coverage is still light
The automated tests do a good job covering the logic layer and several UI helpers. That said, the highest-risk curses behaviors are still mostly covered by code inspection rather than tests.

Notable gaps:
- too-small-terminal rendering path
- confirmation prompt behavior for new game / quit
- top-row rendering details such as foundation labeling
- overlay interactions when help and win states are active

This is not unusual for curses apps, but it is the main remaining area where regressions could slip through.

## Rules review
From code inspection, the important Klondike rules appear to be implemented correctly:
- standard 52-card deck
- 7 tableau piles with 1..7 cards dealt
- only top tableau card initially face up
- tableau builds downward with alternating colors
- only face-up tableau cards/runs move
- empty tableau requires a King-led move
- foundations build Ace-to-King by suit
- waste exposes only the top card
- stock draw is draw-one
- waste recycle order is correct
- exposed tableau cards auto-flip
- win is detected when foundations total 52 cards

I did not find a blocking logic defect in the core rules engine.

## README review
The README is clear and mostly accurate.

Strengths:
- setup instructions are straightforward
- run/test commands are easy to follow
- controls are documented clearly
- terminal size expectation is stated

Minor note:
- Because foundations are fixed-suit in the implementation, the README does not currently explain the foundation mapping a player would need for manual placement.

## Verdict
**Recommended status: pass with minor follow-up work.**

This is a good, well-structured implementation with passing tests and a solid logic layer. The only notable product issue I found is the UI ambiguity around empty fixed-suit foundations. If that is addressed, the game will better meet the spec's goal of being intuitive in terminal play.
