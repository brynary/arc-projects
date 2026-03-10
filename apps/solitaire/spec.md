# Terminal Klondike Solitaire Specification

## 1. Overview

Build a single-player, terminal-based implementation of **Klondike Solitaire** in Python using the standard-library `curses` module for rendering and keyboard input.

The game should feel responsive in a terminal, present clear visual state for all piles, support standard Klondike rules, and cleanly separate game logic from UI code so that rule validation can be tested independently of rendering.

## 2. Scope

### In scope
- Classic Klondike Solitaire with:
  - 1 standard 52-card deck
  - 7 tableau columns
  - 4 foundation piles
  - stock and waste piles
- Keyboard-driven play in a terminal
- Move validation and user feedback for invalid moves
- Detection of win state
- Restart / new game support
- Optional quit confirmation

### Out of scope
- Mouse support
- Network play or multiplayer
- Saving/loading in the initial version
- Vegas scoring / timed mode / draw-three variants unless explicitly added later
- Fancy graphics beyond text and curses color attributes

## 3. Rules of Play

Implement **standard Klondike, draw-one** by default.

### Initial deal
- Shuffle a 52-card deck.
- Deal cards to 7 tableau piles:
  - pile 1 gets 1 card
  - pile 2 gets 2 cards
  - ...
  - pile 7 gets 7 cards
- In each tableau pile, only the top card is face up; all others are face down.
- Remaining cards go to the stock pile face down.
- Waste and foundation piles start empty.

### Tableau rules
- Tableau builds **downward by rank**.
- Tableau alternates **red and black colors**.
- Only **face-up** cards may be moved.
- A valid move may transfer:
  - a single face-up card, or
  - a properly ordered descending alternating-color run of face-up cards
- An empty tableau pile may only be filled by a **King** or a valid run whose first card is a King.
- When the top face-down card of a tableau pile becomes exposed, it is automatically flipped face up.

### Foundation rules
- There are 4 foundations, one per suit.
- Each foundation builds **upward by rank**, starting from **Ace** and ending at **King**.
- Only cards of the same suit may be placed in a foundation pile.
- Example: Ace of Hearts → 2 of Hearts → ... → King of Hearts.

### Stock and waste rules
- Pressing the draw action moves the top stock card to the waste pile face up.
- Because this is draw-one mode, only one card is drawn per action.
- Only the top waste card is playable.
- When the stock is empty, the player may recycle the waste back into stock.
  - Recycling should preserve standard order semantics by turning the waste over into the stock.
  - Implementation detail: if waste is stored bottom-to-top in list order, restocking must produce the correct next-draw sequence.

### Win condition
- The game is won when all 52 cards are moved to the foundations.

### Loss / stuck condition
Klondike does not always have a formal loss trigger. For this version:
- Do **not** force a hard loss state based on move exhaustion.
- Treat the game as ongoing until either:
  - the user wins,
  - the user starts a new game, or
  - the user quits.
- Optionally, the UI may show a soft status such as **"No obvious moves"** if move detection is implemented.

## 4. Core Data Model

Design the game logic around plain Python classes or `dataclasses`, keeping rendering concerns separate.

### 4.1 Card

Recommended fields:
- `rank: int`
  - 1 = Ace, 11 = Jack, 12 = Queen, 13 = King
- `suit: Suit`
  - enum or literal values: `HEARTS`, `DIAMONDS`, `CLUBS`, `SPADES`
- `face_up: bool`

Recommended derived properties / methods:
- `color -> str`
  - `red` for hearts/diamonds, `black` for clubs/spades
- `rank_label -> str`
  - `A`, `2`-`10`, `J`, `Q`, `K`
- `short_name -> str`
  - examples: `AH`, `10S`, `QC`
- `can_stack_on_tableau(other: Card) -> bool`
  - true if this card can be placed on `other` in tableau rules
- `can_move_to_foundation(top: Card | None) -> bool`
  - true if valid for foundation placement

### 4.2 Deck

Responsibilities:
- Create the 52 unique cards
- Shuffle cards
- Provide cards for initial dealing

Recommended interface:
- `Deck.standard() -> Deck`
- `shuffle(rng: random.Random | None = None) -> None`
- `draw() -> Card`
- `is_empty() -> bool`

Note: after the initial deal, gameplay should operate mostly on piles rather than a separate deck object. The stock pile can simply hold the undealt remaining cards.

### 4.3 Pile types

Use a common base abstraction where useful, but avoid inheritance if it adds unnecessary complexity. A tagged class or small set of dedicated classes is sufficient.

Recommended pile types:

#### StockPile
- Holds face-down cards available to draw
- Operations:
  - draw one card to waste
  - receive recycled waste cards

#### WastePile
- Holds face-up drawn cards
- Only top card may be moved
- Operations:
  - push drawn card
  - pop top playable card
  - inspect top card

#### FoundationPile
- Associated with exactly one suit or accepts an Ace of any suit when empty and fixes its suit after first card
- Holds cards in ascending order
- Operations:
  - validate and push card
  - pop top card if undo/back-moves are allowed
  - inspect top card

#### TableauPile
- Holds a mix of face-down and face-up cards
- Must support moving runs of contiguous face-up cards
- Operations:
  - inspect top card
  - determine movable run starting at index
  - validate insertion of a card/run
  - remove a run
  - auto-flip newly exposed top card

### 4.4 GameState

Central state object for one active game.

Recommended fields:
- `stock: StockPile`
- `waste: WastePile`
- `foundations: list[FoundationPile]` length 4
- `tableau: list[TableauPile]` length 7
- `selected: Selection | None`
- `message: str`
- `move_count: int`
- `draw_count: int`
- `start_time: float | datetime`
- `won: bool`

Optional fields:
- `history` for undo support
- `cursor` for UI navigation state if UI and game controller are coupled

### 4.5 Selection / Cursor model

Since this is a terminal game, represent player focus explicitly.

Recommended structures:
- `CursorRegion` enum:
  - `STOCK`, `WASTE`, `FOUNDATION`, `TABLEAU`
- `CursorPosition`:
  - region
  - pile index
  - card index (for tableau run selection)
- `Selection`:
  - source position
  - selected cards or start index

This enables a two-step interaction model:
1. move cursor to source
2. select card/run
3. move cursor to destination
4. confirm move

## 5. Move Validation Rules

The rules engine must be deterministic and independent from curses.

### 5.1 Legal source moves
- Stock cannot be selected as a move source except for draw/recycle action.
- Waste can only move its top card.
- Foundation can move its top card only if reverse moves are allowed.
  - Recommended: allow foundation-to-tableau moves for standard flexibility.
- Tableau can move:
  - its top face-up card, or
  - any face-up run whose cards are already in valid tableau order
- Face-down tableau cards cannot be selected.

### 5.2 Legal destinations
- Waste/stock cannot receive arbitrary moved cards.
- Foundation accepts only one card at a time.
- Tableau accepts one card or a valid run.
- Empty tableau accepts only a King-leading move.
- Empty foundation accepts only an Ace.

### 5.3 Validation helpers

Implement explicit rule helpers such as:
- `is_valid_tableau_build(lower: Card, upper: Card) -> bool`
- `is_valid_foundation_build(card: Card, top: Card | None) -> bool`
- `is_valid_tableau_run(cards: Sequence[Card]) -> bool`
- `can_move_cards(source, destination, cards) -> bool`

### 5.4 Atomic move application

All move execution should be atomic:
1. validate source selection
2. validate destination
3. remove cards from source
4. append cards to destination
5. reveal newly exposed tableau top card if needed
6. update counters/message
7. check win state

If validation fails, the state must remain unchanged.

## 6. Terminal Rendering Approach

Use Python's built-in `curses` library.

### 6.1 Rendering principles
- Redraw the full screen each frame or after each action; performance is sufficient for this game.
- Keep the rendering layer stateless or nearly stateless, reading from `GameState`.
- Separate these concerns:
  - `game_logic.py`: rules and state transitions
  - `ui.py`: curses rendering and input mapping
  - `main.py`: app bootstrap and main loop

### 6.2 Screen initialization
- Use `curses.wrapper(main)`.
- Configure:
  - `curs_set(0)` to hide the text cursor if supported
  - `keypad(True)` to enable special keys
  - `noecho()` and `cbreak()` behavior via wrapper defaults or explicit setup
- Initialize color pairs when supported:
  - red cards
  - black cards
  - highlighted cursor
  - selected source
  - status/error text

### 6.3 Card rendering format

Represent cards in compact text form for predictable layout:
- face-up examples: `AH`, `10D`, `QS`
- face-down placeholder: `[]` or `##`
- empty pile placeholder: `--`

Optional improvement:
- Use Unicode suits if terminal support is acceptable: `A♥`, `10♣`, etc.
- Fall back to ASCII suits if Unicode rendering is inconsistent.

### 6.4 Curses color usage
- Hearts / Diamonds: red color pair
- Clubs / Spades: default or white color pair
- Face-down cards: dim or reversed attribute
- Cursor focus: reverse/highlight
- Selected cards: standout/bold combination

### 6.5 Layout constraints
- Must work on a typical terminal size of at least **100x30**.
- If the terminal is too small, render a clear warning and ask the user to resize.

### 6.6 Rendering strategy for piles

#### Top row
Display:
- Stock
- Waste
- 4 Foundations

Example conceptual row:
`[Stock]  [Waste]        [F1] [F2] [F3] [F4]`

#### Tableau area
Display 7 tableau columns below the top row.
- Cards are shown vertically stacked.
- Each row corresponds to a card depth within a tableau pile.
- Face-down and face-up cards use different visual styles.
- Cursor highlight should identify the focused pile/card.
- When a run is selected, all cards in the run should be visibly highlighted if feasible.

### 6.7 Status and help area
Reserve bottom lines for:
- current mode or prompt
- last action result / error message
- keybindings summary
- optional move count / elapsed time

## 7. UI Layout Specification

Proposed minimum layout:

```text
Klondike Solitaire                                  Moves: 12  Time: 03:41

Stock   Waste                 Foundations
[##]    [QH]                  [A♠] [2♥] [--] [--]

Tableau
T1      T2      T3      T4      T5      T6      T7
[KS]    [##]    [##]    [##]    [##]    [##]    [##]
        [4D]    [##]    [##]    [##]    [##]    [##]
                [JC]    [##]    [##]    [##]    [##]
                        [7H]    [##]    [##]    [##]
                                [9C]    [##]    [##]
                                        [AS]    [##]
                                                [6D]

Mode: Select source
Message: Moved QH to foundation.
Keys: Arrows move | Enter select/place | D draw | R recycle | N new | Q quit
```

### Layout requirements
- Header line with title and basic stats
- Top area for stock, waste, foundations
- Middle area for tableau columns
- Bottom status/help lines
- Focus should remain visible at all times

### Cursor behavior
Two viable designs are acceptable; choose one and keep it consistent.

#### Option A: Pile-based cursor
- Left/right moves across piles
- Up/down toggles between top row and tableau
- Enter on tableau cycles/selects movable run positions if needed
- Simpler to implement but less granular

#### Option B: Card-aware cursor
- Cursor may point to a specific visible tableau card
- Easier to select runs directly
- Slightly more complex navigation logic

Recommended approach: **card-aware cursor for tableau**, pile-aware elsewhere.

## 8. Input Handling

Keyboard-only controls via curses `getch()`.

### Required actions
- Navigate between regions and piles/cards
- Select a source card/run
- Confirm placement to a destination
- Draw from stock
- Recycle waste into stock when stock is empty
- Start a new game
- Quit

### Recommended key map
- Arrow keys:
  - move cursor left/right/up/down
- `Enter` or `Space`:
  - select source / place selected card(s)
- `d`:
  - draw one card from stock to waste
- `r`:
  - recycle waste to stock when allowed
- `f`:
  - optional shortcut: auto-move selected/top eligible card to foundation
- `n`:
  - new game
- `q`:
  - quit
- `h` or `?`:
  - toggle help/status detail
- `u`:
  - optional undo, only if implemented

### Input model
Use a simple state machine:
- `NAVIGATE`: no active selection; cursor moves freely
- `SELECTED`: a source card/run is selected; next confirm attempts a move
- `WON`: game complete; allow new game or quit
- `CONFIRM_QUIT` / `CONFIRM_NEW`: optional modal states

### Invalid input handling
- Invalid moves must not crash or mutate state.
- Show a concise message, e.g.:
  - `Cannot place 7♥ on 8♥`
  - `Only Kings can move to an empty tableau`
  - `No card selected`
- Messages may clear on the next successful action.

## 9. Win and Progress Detection

### Win detection
Check for win after every successful move or auto-move.

A win occurs when:
- all 4 foundations each contain 13 cards, or
- equivalently, the total number of cards across foundations is 52.

On win:
- set `GameState.won = True`
- show a victory message
- disable further move selection except new game / quit, or allow harmless browsing

### Soft progress detection
Optional but useful:
- implement `find_legal_moves(state) -> list[Move]`
- use it for hints or to show `No legal moves visible`
- do not treat zero legal moves as an automatic loss unless explicitly desired in a future mode

## 10. Architecture

Recommended module split:

### `models.py`
- `Suit`, `Card`, pile classes, cursor/selection structures

### `game.py`
- initial deal
- move validation
- move execution
- draw/recycle logic
- win detection
- optional legal-move scanning

### `ui.py`
- curses initialization
- screen rendering
- key-to-action translation
- cursor movement logic
- status/help display

### `main.py`
- entry point
- main game loop
- exception-safe curses wrapper integration

## 11. Error Handling and Edge Cases

Handle these cases explicitly:
- drawing from empty stock when waste is also empty
- recycling waste when stock is not empty, if disallowed by chosen rule interpretation
- selecting face-down tableau cards
- selecting empty piles
- moving multiple cards to foundation
- moving invalid tableau runs
- attempting moves with no selection
- terminal too small for layout
- color support unavailable in terminal
- Unicode suit rendering unavailable or visually broken

## 12. Test Strategy

Prioritize logic tests over curses integration tests.

### 12.1 Unit tests for card and rule helpers
Test:
- card color derivation
- rank label formatting
- tableau stacking validity
- foundation stacking validity
- valid vs invalid tableau runs

Examples:
- red 7 can stack on black 8
- black 7 cannot stack on black 8
- 2♥ can move onto A♥ in foundation
- 2♥ cannot move onto A♣ in foundation

### 12.2 Unit tests for initial deal
Verify:
- total cards across all piles = 52
- tableau pile sizes are 1..7
- only top tableau card is face up
- stock has 24 cards after deal
- waste and foundations start empty
- all cards are unique

### 12.3 Unit tests for move execution
Cover:
- waste to tableau
- waste to foundation
- tableau to tableau single card
- tableau to tableau run
- tableau to empty tableau with King
- invalid move rejection
- automatic flip of exposed tableau card
- foundation to tableau, if supported

### 12.4 Unit tests for stock/waste cycle
Cover:
- draw one moves top stock card to waste face up
- repeated draws empty stock correctly
- recycle reconstructs stock correctly
- drawing after recycle produces expected card order

### 12.5 Unit tests for win detection
Verify:
- incomplete foundation state is not a win
- full 52-card foundation state is a win
- win flag is set after the final successful move

### 12.6 Property-style or invariant tests
If desired, add broader state integrity checks after operations:
- total card count always remains 52
- no duplicated cards
- no missing cards
- foundation piles always remain suit-consistent and ascending
- tableau visible runs remain well-formed after legal moves

### 12.7 UI tests
Since curses is difficult to test directly, keep UI tests lightweight.

Recommended approach:
- test pure helper functions used by UI, such as:
  - layout calculations
  - cursor movement decisions
  - card string formatting
- keep curses rendering functions thin and mostly untested, or smoke-test them where practical

### 12.8 Manual test checklist
Manual QA should verify:
- game launches cleanly in supported terminal size
- navigation feels intuitive
- selected cards are visibly distinct
- invalid moves show clear messages
- draw/recycle behavior matches rules
- tableau auto-flip works consistently
- win message appears correctly
- quit/new game prompts do not corrupt terminal state

## 13. Acceptance Criteria

The implementation is complete when:
- A user can play a full game of draw-one Klondike in the terminal using keyboard controls only.
- All standard pile rules are enforced correctly.
- The display clearly shows stock, waste, foundations, tableau, selection, and status.
- The program detects a win correctly.
- Invalid actions are safely rejected with feedback.
- Game logic is structured so that core rules are testable without running curses.
- Automated tests cover the rules engine and core state transitions.

## 14. Future Enhancements

Possible follow-up features:
- draw-three mode
- scoring and timer modes
- undo/redo
- hints
- auto-move safe cards to foundation
- save/load game state
- accessibility themes / colorblind-friendly mode
- animated card movement within terminal constraints
