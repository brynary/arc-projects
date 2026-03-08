
from __future__ import annotations

from models import Card, CursorPosition, CursorRegion, FoundationPile, GameState, StockPile, Suit, TableauPile, WastePile
from ui import calculate_layout, card_lines, clamp_cursor, move_cursor


def make_card(rank: int, suit: Suit, *, face_up: bool = True) -> Card:
    return Card(rank=rank, suit=suit, face_up=face_up)


def empty_state(*, tableau: list[TableauPile] | None = None) -> GameState:
    return GameState(
        stock=StockPile(),
        waste=WastePile(),
        foundations=[FoundationPile(suit=suit) for suit in Suit],
        tableau=tableau or [TableauPile() for _ in range(7)],
        message="Ready.",
    )


def test_card_lines_render_face_up_hidden_and_empty_cards() -> None:
    ace_hearts = make_card(1, Suit.HEARTS)

    assert card_lines(ace_hearts, use_unicode=False) == (
        "+-----+",
        "|  AH |",
        "+-----+",
    )
    assert card_lines(None, hidden=True) == (
        "+-----+",
        "|#####|",
        "+-----+",
    )
    assert card_lines(None) == (
        "+-----+",
        "|  -- |",
        "+-----+",
    )


def test_calculate_layout_uses_ascii_art_then_compact_when_tableau_is_tall() -> None:
    art_layout = calculate_layout(100, 30, 7, True)
    compact_layout = calculate_layout(100, 30, 10, True)

    assert art_layout is not None
    assert art_layout.tableau_mode == "art"
    assert art_layout.tableau_step == 2

    assert compact_layout is not None
    assert compact_layout.tableau_mode == "compact"
    assert compact_layout.tableau_step == 1


def test_clamp_cursor_moves_tableau_focus_to_first_face_up_card() -> None:
    state = empty_state(
        tableau=[
            TableauPile(cards=[
                make_card(10, Suit.SPADES, face_up=False),
                make_card(8, Suit.CLUBS),
                make_card(7, Suit.HEARTS),
            ]),
            *[TableauPile() for _ in range(6)],
        ]
    )

    cursor = clamp_cursor(
        state,
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=0),
    )

    assert cursor == CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=1)


def test_move_cursor_navigates_between_top_row_and_tableau_cards() -> None:
    state = empty_state(
        tableau=[
            TableauPile(cards=[
                make_card(10, Suit.SPADES, face_up=False),
                make_card(8, Suit.CLUBS),
                make_card(7, Suit.HEARTS),
            ]),
            TableauPile(cards=[make_card(9, Suit.DIAMONDS)]),
            TableauPile(cards=[make_card(13, Suit.CLUBS)]),
            *[TableauPile() for _ in range(4)],
        ]
    )

    cursor = move_cursor(state, CursorPosition(region=CursorRegion.STOCK), "down")
    assert cursor == CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=2)

    cursor = move_cursor(state, cursor, "up")
    assert cursor == CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=1)

    cursor = move_cursor(state, cursor, "up")
    assert cursor == CursorPosition(region=CursorRegion.STOCK, pile_index=0, card_index=None)

    cursor = move_cursor(state, CursorPosition(region=CursorRegion.FOUNDATION, pile_index=0), "down")
    assert cursor == CursorPosition(region=CursorRegion.TABLEAU, pile_index=2, card_index=0)
