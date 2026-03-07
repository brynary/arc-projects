"""Starter tests for the project scaffold."""

from models import Card, Suit


def test_card_short_name_and_color() -> None:
    card = Card(rank=1, suit=Suit.HEARTS, face_up=True)

    assert card.short_name == "AH"
    assert card.color == "red"