
from __future__ import annotations

import random

import pytest

from models import (
    Card,
    Deck,
    FoundationPile,
    StockPile,
    Suit,
    TableauPile,
    WastePile,
    is_valid_foundation_build,
    is_valid_tableau_build,
    is_valid_tableau_run,
)


def make_card(rank: int, suit: Suit, *, face_up: bool = True) -> Card:
    return Card(rank=rank, suit=suit, face_up=face_up)


def test_card_short_name_rank_label_and_color() -> None:
    ace_hearts = make_card(1, Suit.HEARTS)
    ten_spades = make_card(10, Suit.SPADES)
    queen_clubs = make_card(12, Suit.CLUBS)

    assert ace_hearts.rank_label == "A"
    assert ace_hearts.short_name == "AH"
    assert ace_hearts.color == "red"
    assert ten_spades.rank_label == "10"
    assert ten_spades.short_name == "10S"
    assert queen_clubs.rank_label == "Q"
    assert queen_clubs.color == "black"


@pytest.mark.parametrize("rank", [0, 14])
def test_card_rejects_invalid_rank(rank: int) -> None:
    with pytest.raises(ValueError, match="rank must be between 1 and 13"):
        Card(rank=rank, suit=Suit.HEARTS)


def test_card_can_stack_on_tableau_for_descending_opposite_colors() -> None:
    eight_spades = make_card(8, Suit.SPADES)
    seven_hearts = make_card(7, Suit.HEARTS)
    seven_diamonds = make_card(7, Suit.DIAMONDS)
    six_clubs_face_down = make_card(6, Suit.CLUBS, face_up=False)

    assert seven_hearts.can_stack_on_tableau(eight_spades) is True
    assert seven_diamonds.can_stack_on_tableau(eight_spades) is True
    assert eight_spades.can_stack_on_tableau(seven_hearts) is False
    assert six_clubs_face_down.can_stack_on_tableau(seven_hearts) is False


def test_card_can_move_to_foundation() -> None:
    ace_hearts = make_card(1, Suit.HEARTS)
    two_hearts = make_card(2, Suit.HEARTS)
    two_spades = make_card(2, Suit.SPADES)
    face_down_ace = make_card(1, Suit.SPADES, face_up=False)

    assert ace_hearts.can_move_to_foundation(None) is True
    assert two_hearts.can_move_to_foundation(ace_hearts) is True
    assert two_spades.can_move_to_foundation(ace_hearts) is False
    assert face_down_ace.can_move_to_foundation(None) is False


def test_tableau_and_foundation_validation_helpers() -> None:
    nine_clubs = make_card(9, Suit.CLUBS)
    eight_hearts = make_card(8, Suit.HEARTS)
    seven_spades = make_card(7, Suit.SPADES)
    ace_diamonds = make_card(1, Suit.DIAMONDS)
    two_diamonds = make_card(2, Suit.DIAMONDS)

    assert is_valid_tableau_build(nine_clubs, eight_hearts) is True
    assert is_valid_tableau_run([nine_clubs, eight_hearts, seven_spades]) is True
    assert is_valid_foundation_build(ace_diamonds, None) is True
    assert is_valid_foundation_build(two_diamonds, ace_diamonds) is True


def test_invalid_tableau_run_helper_rejects_face_down_or_wrong_order() -> None:
    valid_top = make_card(9, Suit.CLUBS)
    same_color = make_card(8, Suit.SPADES)
    face_down = make_card(8, Suit.HEARTS, face_up=False)

    assert is_valid_tableau_run([valid_top, same_color]) is False
    assert is_valid_tableau_run([valid_top, face_down]) is False
    assert is_valid_tableau_run([]) is False


def test_standard_deck_contains_52_unique_cards() -> None:
    deck = Deck.standard()

    assert len(deck.cards) == 52
    assert len({card.short_name for card in deck.cards}) == 52
    assert all(card.face_up is False for card in deck.cards)


def test_deck_shuffle_is_deterministic_with_supplied_rng() -> None:
    deck_one = Deck.standard()
    deck_two = Deck.standard()
    original_order = [card.short_name for card in deck_one.cards]

    deck_one.shuffle(random.Random(7))
    deck_two.shuffle(random.Random(7))

    assert [card.short_name for card in deck_one.cards] == [card.short_name for card in deck_two.cards]
    assert [card.short_name for card in deck_one.cards] != original_order


def test_deck_draw_removes_top_card_and_empty_draw_raises() -> None:
    deck = Deck(cards=[make_card(1, Suit.HEARTS, face_up=False)])

    drawn = deck.draw()

    assert drawn.short_name == "AH"
    assert deck.is_empty() is True

    with pytest.raises(IndexError, match="deck is empty"):
        deck.draw()


def test_waste_push_pop_and_take_all() -> None:
    waste = WastePile()
    first = make_card(4, Suit.CLUBS, face_up=False)
    second = make_card(5, Suit.HEARTS, face_up=False)

    waste.push(first)
    waste.push(second)

    assert first.face_up is True
    assert second.face_up is True
    assert waste.top() == second
    assert waste.pop() == second
    assert waste.take_all() == [first]
    assert waste.is_empty() is True


def test_stock_draw_to_waste_flips_card_face_up() -> None:
    stock = StockPile(cards=[make_card(9, Suit.CLUBS, face_up=False)])
    waste = WastePile()

    drawn = stock.draw_to_waste(waste)

    assert drawn.face_up is True
    assert waste.top() == drawn
    assert stock.is_empty() is True


def test_stock_recycle_from_waste_restores_draw_order_and_turns_cards_face_down() -> None:
    stock = StockPile()
    waste = WastePile(cards=[
        make_card(3, Suit.CLUBS),
        make_card(2, Suit.HEARTS),
        make_card(1, Suit.SPADES),
    ])

    stock.recycle_from_waste(waste)

    assert waste.is_empty() is True
    assert [card.short_name for card in stock.cards] == ["AS", "2H", "3C"]
    assert all(card.face_up is False for card in stock.cards)
    assert stock.draw().short_name == "3C"


def test_stock_recycle_requires_empty_stock_and_nonempty_waste() -> None:
    stock = StockPile(cards=[make_card(13, Suit.SPADES, face_up=False)])
    waste = WastePile(cards=[make_card(1, Suit.HEARTS)])

    with pytest.raises(ValueError, match="stock still contains cards"):
        stock.recycle_from_waste(waste)

    stock = StockPile()
    empty_waste = WastePile()

    with pytest.raises(ValueError, match="empty waste pile"):
        stock.recycle_from_waste(empty_waste)


def test_foundation_accepts_ace_then_builds_by_suit() -> None:
    foundation = FoundationPile()
    ace_hearts = make_card(1, Suit.HEARTS)
    two_hearts = make_card(2, Suit.HEARTS)
    two_spades = make_card(2, Suit.SPADES)

    assert foundation.can_accept(ace_hearts) is True
    foundation.push(ace_hearts)
    assert foundation.suit == Suit.HEARTS
    assert foundation.can_accept(two_hearts) is True
    assert foundation.can_accept(two_spades) is False
    foundation.push(two_hearts)
    assert foundation.top() == two_hearts


def test_foundation_pop_resets_dynamic_suit_but_keeps_configured_suit() -> None:
    dynamic_foundation = FoundationPile()
    dynamic_foundation.push(make_card(1, Suit.DIAMONDS))

    popped = dynamic_foundation.pop()

    assert popped.short_name == "AD"
    assert dynamic_foundation.suit is None

    fixed_foundation = FoundationPile(suit=Suit.SPADES)
    fixed_foundation.push(make_card(1, Suit.SPADES))
    fixed_foundation.pop()

    assert fixed_foundation.suit == Suit.SPADES


def test_foundation_rejects_invalid_push_and_invalid_initial_cards() -> None:
    foundation = FoundationPile(suit=Suit.HEARTS)

    with pytest.raises(ValueError, match="cannot place 2H on foundation"):
        foundation.push(make_card(2, Suit.HEARTS))

    with pytest.raises(ValueError, match="same suit"):
        FoundationPile(cards=[make_card(1, Suit.HEARTS), make_card(2, Suit.SPADES)])


def test_tableau_movable_run_returns_only_valid_face_up_runs() -> None:
    tableau = TableauPile(cards=[
        make_card(11, Suit.CLUBS, face_up=False),
        make_card(10, Suit.HEARTS),
        make_card(9, Suit.CLUBS),
        make_card(8, Suit.DIAMONDS),
    ])

    assert [card.short_name for card in tableau.movable_run(1)] == ["10H", "9C", "8D"]
    assert [card.short_name for card in tableau.movable_run(2)] == ["9C", "8D"]
    assert tableau.movable_run(0) == []
    assert tableau.movable_run(99) == []


def test_tableau_can_accept_cards_and_requires_king_for_empty_pile() -> None:
    empty_tableau = TableauPile()
    king_run = [make_card(13, Suit.SPADES), make_card(12, Suit.HEARTS)]
    queen_run = [make_card(12, Suit.HEARTS)]
    occupied_tableau = TableauPile(cards=[make_card(8, Suit.CLUBS)])

    assert empty_tableau.can_accept_cards(king_run) is True
    assert empty_tableau.can_accept_cards(queen_run) is False
    assert occupied_tableau.can_accept_cards([make_card(7, Suit.HEARTS)]) is True
    assert occupied_tableau.can_accept_cards([make_card(7, Suit.SPADES)]) is False


def test_tableau_add_cards_and_remove_run_auto_flips_exposed_card() -> None:
    source = TableauPile(cards=[
        make_card(5, Suit.SPADES, face_up=False),
        make_card(4, Suit.HEARTS),
        make_card(3, Suit.CLUBS),
    ])
    destination = TableauPile(cards=[make_card(5, Suit.SPADES)])

    moved_cards = source.remove_run(1)
    destination.add_cards(moved_cards)

    assert [card.short_name for card in moved_cards] == ["4H", "3C"]
    assert source.top() is not None and source.top().face_up is True
    assert [card.short_name for card in destination.cards] == ["5S", "4H", "3C"]


def test_tableau_rejects_invalid_setup_and_invalid_remove_run() -> None:
    with pytest.raises(ValueError, match="face-down cards cannot sit above face-up cards"):
        TableauPile(cards=[make_card(7, Suit.HEARTS), make_card(6, Suit.CLUBS, face_up=False)])

    tableau = TableauPile(cards=[make_card(9, Suit.SPADES), make_card(8, Suit.HEARTS)])

    with pytest.raises(ValueError, match="no movable run"):
        tableau.remove_run(5)
