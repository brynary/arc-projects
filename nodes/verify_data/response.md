All **44 tests pass** across all test modules. Here's a summary of the verification:

### Data Structures Verified ✅

| Type | Status | Key Operations Tested |
|---|---|---|
| **`Card`** | ✅ | `rank_label`, `short_name`, `color`, `can_stack_on_tableau`, `can_move_to_foundation`, rank validation (rejects 0 and 14) |
| **`Deck`** | ✅ | `standard()` creates 52 unique face-down cards, deterministic `shuffle(rng)`, `draw()`, `is_empty()` |
| **`CardPile`** | ✅ | Base `__len__`, `is_empty`, `top` |
| **`WastePile`** | ✅ | `push` (flips face-up), `pop`, `take_all` |
| **`StockPile`** | ✅ | `draw`, `draw_to_waste` (flips face-up), `recycle_from_waste` (reverses order, flips face-down), rejection when stock non-empty or waste empty |
| **`FoundationPile`** | ✅ | Accepts ace on empty, builds by suit, `can_accept`, `push`/`pop`, dynamic vs configured suit reset, rejects invalid cards/setup |
| **`TableauPile`** | ✅ | `movable_run`, `can_accept_cards` (king-only on empty), `add_cards`, `remove_run`, `auto_flip_top`, rejects invalid pile ordering |
| **Helper functions** | ✅ | `is_valid_tableau_build`, `is_valid_foundation_build`, `is_valid_tableau_run` |

### Test Results
```
44 passed in 0.05s
```

All data structure types (`Card`, `Deck`, `CardPile` and its subclasses `WastePile`, `StockPile`, `FoundationPile`, `TableauPile`) are properly defined with correct basic operations. The game logic, UI, and main entry point tests also pass cleanly.