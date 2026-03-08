from __future__ import annotations

import random

from game import (
    can_auto_complete,
    check_win,
    draw_from_stock,
    move_card_to_foundation,
    move_cards,
    new_game,
    recycle_waste,
    undo,
)
from models import (
    Card,
    CursorPosition,
    CursorRegion,
    FoundationPile,
    GameState,
    StockPile,
    Suit,
    TableauPile,
    WastePile,
)


def make_card(rank: int, suit: Suit, *, face_up: bool = True) -> Card:
    return Card(rank=rank, suit=suit, face_up=face_up)


def foundation_up_to(suit: Suit, top_rank: int) -> FoundationPile:
    return FoundationPile(
        suit=suit,
        cards=[make_card(rank, suit) for rank in range(1, top_rank + 1)],
    )


def empty_state(
    *,
    stock: list[Card] | None = None,
    waste: list[Card] | None = None,
    foundations: list[FoundationPile] | None = None,
    tableau: list[TableauPile] | None = None,
) -> GameState:
    return GameState(
        stock=StockPile(cards=list(stock or [])),
        waste=WastePile(cards=list(waste or [])),
        foundations=foundations or [FoundationPile(suit=suit) for suit in Suit],
        tableau=tableau or [TableauPile() for _ in range(7)],
        message="Ready.",
    )


def all_cards(state: GameState) -> list[Card]:
    cards = [*state.stock.cards, *state.waste.cards]
    for pile in state.foundations:
        cards.extend(pile.cards)
    for pile in state.tableau:
        cards.extend(pile.cards)
    return cards


def test_new_game_deals_klondike_layout() -> None:
    state = new_game(random.Random(7))

    assert [len(pile.cards) for pile in state.tableau] == [1, 2, 3, 4, 5, 6, 7]
    assert len(state.stock.cards) == 24
    assert state.waste.is_empty() is True
    assert all(foundation.is_empty() for foundation in state.foundations)
    assert all(len([card for card in pile.cards if card.face_up]) == 1 for pile in state.tableau)
    assert all(pile.top() is not None and pile.top().face_up is True for pile in state.tableau)
    assert all(card.face_up is False for card in state.stock.cards)
    assert len(all_cards(state)) == 52
    assert len({card.short_name for card in all_cards(state)}) == 52


def test_move_waste_to_tableau_succeeds_for_valid_alternating_descending_move() -> None:
    state = empty_state(
        waste=[make_card(7, Suit.HEARTS)],
        tableau=[TableauPile(cards=[make_card(8, Suit.CLUBS)])] + [TableauPile() for _ in range(6)],
    )

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.WASTE),
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0),
    )

    assert moved is True
    assert state.waste.is_empty() is True
    assert [card.short_name for card in state.tableau[0].cards] == ["8C", "7H"]
    assert state.move_count == 1


def test_invalid_move_leaves_state_unchanged() -> None:
    state = empty_state(
        waste=[make_card(7, Suit.HEARTS)],
        tableau=[TableauPile(cards=[make_card(8, Suit.DIAMONDS)])] + [TableauPile() for _ in range(6)],
    )
    before_waste = [card.short_name for card in state.waste.cards]
    before_tableau = [card.short_name for card in state.tableau[0].cards]

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.WASTE),
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0),
    )

    assert moved is False
    assert [card.short_name for card in state.waste.cards] == before_waste
    assert [card.short_name for card in state.tableau[0].cards] == before_tableau
    assert state.move_count == 0
    assert state.message == "Cannot place 7H on 8D."


def test_move_waste_to_foundation_places_single_card_on_matching_foundation() -> None:
    state = empty_state(waste=[make_card(1, Suit.HEARTS)])

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.WASTE),
        CursorPosition(region=CursorRegion.FOUNDATION, pile_index=0),
    )

    assert moved is True
    assert state.waste.is_empty() is True
    assert [card.short_name for card in state.foundations[0].cards] == ["AH"]


def test_move_to_foundation_rejects_multiple_cards_from_tableau_run() -> None:
    state = empty_state(
        tableau=[
            TableauPile(cards=[make_card(7, Suit.HEARTS), make_card(6, Suit.CLUBS)]),
            *[TableauPile() for _ in range(6)],
        ]
    )

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=0),
        CursorPosition(region=CursorRegion.FOUNDATION, pile_index=0),
    )

    assert moved is False
    assert [card.short_name for card in state.tableau[0].cards] == ["7H", "6C"]
    assert state.foundations[0].is_empty() is True
    assert state.message == "Only one card can move to a foundation."


def test_tableau_run_move_auto_flips_exposed_card() -> None:
    state = empty_state(
        tableau=[
            TableauPile(cards=[
                make_card(10, Suit.SPADES, face_up=False),
                make_card(8, Suit.CLUBS),
                make_card(7, Suit.HEARTS),
            ]),
            TableauPile(cards=[make_card(9, Suit.DIAMONDS)]),
            *[TableauPile() for _ in range(5)],
        ]
    )

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=1),
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=1),
    )

    assert moved is True
    assert [card.short_name for card in state.tableau[1].cards] == ["9D", "8C", "7H"]
    assert [card.short_name for card in state.tableau[0].cards] == ["10S"]
    assert state.tableau[0].top() is not None and state.tableau[0].top().face_up is True


def test_foundation_to_tableau_reverse_move_is_supported() -> None:
    state = empty_state(
        foundations=[
            foundation_up_to(Suit.HEARTS, 3),
            FoundationPile(suit=Suit.DIAMONDS),
            FoundationPile(suit=Suit.CLUBS),
            FoundationPile(suit=Suit.SPADES),
        ],
        tableau=[TableauPile(cards=[make_card(4, Suit.CLUBS)])] + [TableauPile() for _ in range(6)],
    )

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.FOUNDATION, pile_index=0),
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0),
    )

    assert moved is True
    assert [card.short_name for card in state.foundations[0].cards] == ["AH", "2H"]
    assert [card.short_name for card in state.tableau[0].cards] == ["4C", "3H"]


def test_final_foundation_move_sets_win_flag() -> None:
    state = empty_state(
        waste=[make_card(13, Suit.HEARTS)],
        foundations=[
            foundation_up_to(Suit.HEARTS, 12),
            foundation_up_to(Suit.DIAMONDS, 13),
            foundation_up_to(Suit.CLUBS, 13),
            foundation_up_to(Suit.SPADES, 13),
        ],
    )

    moved = move_cards(
        state,
        CursorPosition(region=CursorRegion.WASTE),
        CursorPosition(region=CursorRegion.FOUNDATION, pile_index=0),
    )

    assert moved is True
    assert state.won is True
    assert check_win(state) is True
    assert state.message == "You won!"


def test_draw_and_recycle_edge_cases_and_undo_restore_previous_state() -> None:
    state = empty_state(stock=[make_card(4, Suit.SPADES, face_up=False)])
    original_stock = [card.short_name for card in state.stock.cards]

    assert draw_from_stock(state) is True
    assert [card.short_name for card in state.waste.cards] == ["4S"]
    assert state.draw_count == 1
    assert undo(state) is True
    assert [card.short_name for card in state.stock.cards] == original_stock
    assert state.waste.is_empty() is True
    assert state.draw_count == 0

    assert draw_from_stock(state) is True
    assert draw_from_stock(state) is False
    assert state.message == "Stock is empty. Recycle the waste first."
    assert recycle_waste(state) is True
    assert state.stock.top() is not None and state.stock.top().short_name == "4S"
    assert state.stock.top() is not None and state.stock.top().face_up is False


def test_undo_reverts_tableau_move_and_restores_face_down_card() -> None:
    state = empty_state(
        tableau=[
            TableauPile(cards=[
                make_card(10, Suit.SPADES, face_up=False),
                make_card(8, Suit.CLUBS),
                make_card(7, Suit.HEARTS),
            ]),
            TableauPile(cards=[make_card(9, Suit.DIAMONDS)]),
            *[TableauPile() for _ in range(5)],
        ]
    )

    assert move_cards(
        state,
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=1),
        CursorPosition(region=CursorRegion.TABLEAU, pile_index=1),
    ) is True

    assert undo(state) is True
    assert [card.short_name for card in state.tableau[0].cards] == ["10S", "8C", "7H"]
    assert state.tableau[0].cards[0].face_up is False
    assert [card.short_name for card in state.tableau[1].cards] == ["9D"]
    assert state.move_count == 0


def test_auto_complete_detection_finds_chain_of_foundation_moves() -> None:
    state = empty_state(
        waste=[make_card(12, Suit.HEARTS)],
        foundations=[
            foundation_up_to(Suit.HEARTS, 11),
            foundation_up_to(Suit.DIAMONDS, 13),
            foundation_up_to(Suit.CLUBS, 13),
            foundation_up_to(Suit.SPADES, 13),
        ],
        tableau=[TableauPile(cards=[make_card(13, Suit.HEARTS)])] + [TableauPile() for _ in range(6)],
    )

    assert can_auto_complete(state) is True
    assert state.waste.top() is not None and state.waste.top().short_name == "QH"
    assert state.won is False


def test_auto_complete_detection_returns_false_when_progress_is_blocked() -> None:
    state = empty_state(
        stock=[make_card(12, Suit.HEARTS, face_up=False)],
        foundations=[
            foundation_up_to(Suit.HEARTS, 11),
            foundation_up_to(Suit.DIAMONDS, 13),
            foundation_up_to(Suit.CLUBS, 13),
            foundation_up_to(Suit.SPADES, 13),
        ],
        tableau=[TableauPile(cards=[make_card(13, Suit.HEARTS)])] + [TableauPile() for _ in range(6)],
    )

    assert can_auto_complete(state) is False


def test_move_card_to_foundation_chooses_matching_pile() -> None:
    state = empty_state(waste=[make_card(1, Suit.SPADES)])

    moved = move_card_to_foundation(
        state,
        CursorPosition(region=CursorRegion.WASTE),
    )

    assert moved is True
    assert state.foundations[3].top() is not None
    assert state.foundations[3].top().short_name == "AS"
