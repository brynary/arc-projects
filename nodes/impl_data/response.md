All 44 tests pass. The Card, Deck, and Pile types are already fully implemented in `src/models.py` with comprehensive unit tests in `tests/test_models.py`. Let me verify the test coverage specifically for the models:

**Card type** (`test_models.py` lines 26-91):
- ✅ `test_card_short_name_rank_label_and_color` — rank_label, short_name, color properties
- ✅ `test_card_rejects_invalid_rank[0]` and `[14]` — rank validation
- ✅ `test_card_can_stack_on_tableau_for_descending_opposite_colors` — tableau stacking rules
- ✅ `test_card_can_move_to_foundation` — foundation placement rules
- ✅ `test_tableau_and_foundation_validation_helpers` — `is_valid_tableau_build`, `is_valid_tableau_run`, `is_valid_foundation_build`
- ✅ `test_invalid_tableau_run_helper_rejects_face_down_or_wrong_order` — invalid run rejection

**Deck type** (`test_models.py` lines 93-122):
- ✅ `test_standard_deck_contains_52_unique_cards` — 52 unique cards, all face-down
- ✅ `test_deck_shuffle_is_deterministic_with_supplied_rng` — deterministic shuffle with seeded RNG
- ✅ `test_deck_draw_removes_top_card_and_empty_draw_raises` — draw and empty-deck error

**Pile types** (`test_models.py` lines 125-272):
- ✅ `test_waste_push_pop_and_take_all` — WastePile push/pop/take_all/face-up flip
- ✅ `test_stock_draw_to_waste_flips_card_face_up` — StockPile draw-to-waste
- ✅ `test_stock_recycle_from_waste_restores_draw_order_and_turns_cards_face_down` — recycle ordering and face-down
- ✅ `test_stock_recycle_requires_empty_stock_and_nonempty_waste` — recycle error conditions
- ✅ `test_foundation_accepts_ace_then_builds_by_suit` — FoundationPile accept/push/suit-lock
- ✅ `test_foundation_pop_resets_dynamic_suit_but_keeps_configured_suit` — pop suit behavior
- ✅ `test_foundation_rejects_invalid_push_and_invalid_initial_cards` — invalid foundation ops
- ✅ `test_tableau_movable_run_returns_only_valid_face_up_runs` — TableauPile movable_run
- ✅ `test_tableau_can_accept_cards_and_requires_king_for_empty_pile` — can_accept_cards with King rule
- ✅ `test_tableau_add_cards_and_remove_run_auto_flips_exposed_card` — add/remove/auto-flip
- ✅ `test_tableau_rejects_invalid_setup_and_invalid_remove_run` — invalid tableau construction and removal

All Card, Deck, and Pile types are implemented and all 44 tests (including 21 specifically for models) pass with `python3 -m pytest tests/ -v`.