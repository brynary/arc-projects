
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from enum import Enum
import random


class Suit(str, Enum):
    """Standard playing-card suits."""

    HEARTS = "H"
    DIAMONDS = "D"
    CLUBS = "C"
    SPADES = "S"

    @property
    def color(self) -> str:
        """Return the suit color used by Klondike rules."""
        if self in {Suit.HEARTS, Suit.DIAMONDS}:
            return "red"
        return "black"


class CursorRegion(str, Enum):
    """Top-level UI regions that can receive focus."""

    STOCK = "stock"
    WASTE = "waste"
    FOUNDATION = "foundation"
    TABLEAU = "tableau"


@dataclass(slots=True)
class Card:
    """A single playing card."""

    rank: int
    suit: Suit
    face_up: bool = False

    def __post_init__(self) -> None:
        """Validate rank values for standard playing cards."""
        if not 1 <= self.rank <= 13:
            raise ValueError(f"rank must be between 1 and 13, got {self.rank}")

    @property
    def color(self) -> str:
        """Return ``red`` or ``black`` based on suit."""
        return self.suit.color

    @property
    def rank_label(self) -> str:
        """Return the short display label for the card rank."""
        labels = {1: "A", 11: "J", 12: "Q", 13: "K"}
        return labels.get(self.rank, str(self.rank))

    @property
    def short_name(self) -> str:
        """Return the compact card display name, such as ``AH`` or ``10S``."""
        return f"{self.rank_label}{self.suit.value}"

    def can_stack_on_tableau(self, other: Card) -> bool:
        """Return whether this card can be placed on another tableau card."""
        return (
            self.face_up
            and other.face_up
            and self.color != other.color
            and self.rank == other.rank - 1
        )

    def can_move_to_foundation(self, top: Card | None) -> bool:
        """Return whether this card can be placed on a foundation pile."""
        if not self.face_up:
            return False
        if top is None:
            return self.rank == 1
        return self.suit == top.suit and self.rank == top.rank + 1


def is_valid_tableau_build(lower_card: Card, upper_card: Card) -> bool:
    """Return whether ``upper_card`` can be placed on ``lower_card`` in tableau."""
    return upper_card.can_stack_on_tableau(lower_card)


def is_valid_foundation_build(card: Card, top: Card | None) -> bool:
    """Return whether ``card`` can be placed onto a foundation pile."""
    return card.can_move_to_foundation(top)


def is_valid_tableau_run(cards: Sequence[Card]) -> bool:
    """Return whether ``cards`` form a movable face-up tableau run."""
    if not cards or any(not card.face_up for card in cards):
        return False

    return all(
        is_valid_tableau_build(cards[index - 1], cards[index])
        for index in range(1, len(cards))
    )


@dataclass(slots=True)
class Deck:
    """A standard deck of 52 playing cards."""

    cards: list[Card] = field(default_factory=list)

    @classmethod
    def standard(cls) -> Deck:
        """Build an ordered 52-card deck."""
        cards = [Card(rank=rank, suit=suit) for suit in Suit for rank in range(1, 14)]
        return cls(cards=cards)

    def shuffle(self, rng: random.Random | None = None) -> None:
        """Shuffle the deck in place."""
        (rng or random.Random()).shuffle(self.cards)

    def draw(self) -> Card:
        """Remove and return the top card of the deck."""
        if self.is_empty():
            raise IndexError("deck is empty")
        return self.cards.pop()

    def is_empty(self) -> bool:
        """Return whether the deck has any cards remaining."""
        return not self.cards


@dataclass(slots=True)
class CardPile:
    """Shared list-backed behavior for the different pile types."""

    cards: list[Card] = field(default_factory=list)

    def __len__(self) -> int:
        """Return the number of cards in the pile."""
        return len(self.cards)

    def is_empty(self) -> bool:
        """Return whether the pile contains any cards."""
        return not self.cards

    def top(self) -> Card | None:
        """Return the top card without removing it."""
        return self.cards[-1] if self.cards else None


@dataclass(slots=True)
class WastePile(CardPile):
    """Face-up waste pile."""

    def push(self, card: Card) -> None:
        """Add a card to the waste pile as a face-up card."""
        card.face_up = True
        self.cards.append(card)

    def pop(self) -> Card:
        """Remove and return the top playable waste card."""
        if self.is_empty():
            raise IndexError("waste pile is empty")
        return self.cards.pop()

    def take_all(self) -> list[Card]:
        """Remove and return all waste cards in bottom-to-top order."""
        cards = list(self.cards)
        self.cards.clear()
        return cards


@dataclass(slots=True)
class StockPile(CardPile):
    """Face-down stock pile."""

    def draw(self) -> Card:
        """Remove and return the top face-down stock card."""
        if self.is_empty():
            raise IndexError("stock pile is empty")
        return self.cards.pop()

    def draw_to_waste(self, waste: WastePile) -> Card:
        """Move the top stock card to ``waste`` and flip it face up."""
        card = self.draw()
        waste.push(card)
        return card

    def receive_recycled_waste(self, cards: Sequence[Card]) -> None:
        """Receive recycled waste cards and restore face-down stock order."""
        recycled_cards = list(reversed(cards))
        for card in recycled_cards:
            card.face_up = False
        self.cards.extend(recycled_cards)

    def recycle_from_waste(self, waste: WastePile) -> None:
        """Recycle the waste pile back into stock using Klondike order semantics."""
        if not self.is_empty():
            raise ValueError("cannot recycle waste while stock still contains cards")
        if waste.is_empty():
            raise ValueError("cannot recycle an empty waste pile")
        self.receive_recycled_waste(waste.take_all())


@dataclass(slots=True)
class FoundationPile(CardPile):
    """Foundation pile built upward by suit."""

    suit: Suit | None = None
    _configured_suit: Suit | None = field(init=False, repr=False)

    def __post_init__(self) -> None:
        """Validate preloaded foundation cards and fixed-suit configuration."""
        self._configured_suit = self.suit

        if not self.cards:
            return

        expected_suit = self.suit or self.cards[0].suit
        top: Card | None = None
        for card in self.cards:
            if card.suit != expected_suit:
                raise ValueError("foundation cards must all share the same suit")
            if not is_valid_foundation_build(card, top):
                raise ValueError("foundation cards must build upward from Ace")
            top = card

        self.suit = expected_suit

    def can_accept(self, card: Card) -> bool:
        """Return whether ``card`` can be legally added to this foundation."""
        if self.suit is not None and card.suit != self.suit:
            return False
        return is_valid_foundation_build(card, self.top())

    def push(self, card: Card) -> None:
        """Add a card to the foundation when the move is legal."""
        if not self.can_accept(card):
            raise ValueError(f"cannot place {card.short_name} on foundation")
        if self.suit is None:
            self.suit = card.suit
        card.face_up = True
        self.cards.append(card)

    def pop(self) -> Card:
        """Remove and return the top foundation card."""
        if self.is_empty():
            raise IndexError("foundation pile is empty")
        card = self.cards.pop()
        if self.is_empty():
            self.suit = self._configured_suit
        return card


@dataclass(slots=True)
class TableauPile(CardPile):
    """Tableau pile containing face-down and face-up cards."""

    def __post_init__(self) -> None:
        """Validate tableau pile ordering when initialized with cards."""
        if not self.cards:
            return

        seen_face_up = False
        face_up_run: list[Card] = []
        for card in self.cards:
            if card.face_up:
                seen_face_up = True
                face_up_run.append(card)
                continue

            if seen_face_up:
                raise ValueError("face-down cards cannot sit above face-up cards in tableau")

        if face_up_run and not is_valid_tableau_run(face_up_run):
            raise ValueError("face-up tableau cards must form a valid descending run")

    def movable_run(self, start_index: int) -> list[Card]:
        """Return a face-up run from ``start_index`` onward when valid."""
        if start_index < 0 or start_index >= len(self.cards):
            return []

        run = self.cards[start_index:]
        if is_valid_tableau_run(run):
            return list(run)
        return []

    def can_accept_cards(self, cards: Sequence[Card]) -> bool:
        """Return whether ``cards`` can be placed onto this tableau pile."""
        incoming_cards = list(cards)
        if not is_valid_tableau_run(incoming_cards):
            return False

        if self.is_empty():
            return incoming_cards[0].rank == 13

        top_card = self.top()
        if top_card is None:
            return False
        return is_valid_tableau_build(top_card, incoming_cards[0])

    def add_cards(self, cards: Sequence[Card]) -> None:
        """Append a valid card or run to the tableau pile."""
        incoming_cards = list(cards)
        if not self.can_accept_cards(incoming_cards):
            raise ValueError("cannot place cards on tableau pile")
        self.cards.extend(incoming_cards)

    def remove_run(self, start_index: int) -> list[Card]:
        """Remove and return a movable run starting at ``start_index``."""
        run = self.movable_run(start_index)
        if not run:
            raise ValueError("no movable run starts at the requested index")

        removed_cards = self.cards[start_index:]
        del self.cards[start_index:]
        self.auto_flip_top()
        return removed_cards

    def auto_flip_top(self) -> None:
        """Flip the newly exposed top card face up when needed."""
        if self.cards and not self.cards[-1].face_up:
            self.cards[-1].face_up = True


@dataclass(slots=True)
class CursorPosition:
    """UI cursor location."""

    region: CursorRegion
    pile_index: int = 0
    card_index: int | None = None


@dataclass(slots=True)
class Selection:
    """Current move selection."""

    source: CursorPosition
    start_index: int | None = None


@dataclass(slots=True)
class GameState:
    """Top-level container for a single game session."""

    stock: StockPile = field(default_factory=StockPile)
    waste: WastePile = field(default_factory=WastePile)
    foundations: list[FoundationPile] = field(default_factory=list)
    tableau: list[TableauPile] = field(default_factory=list)
    selected: Selection | None = None
    message: str = "Project scaffold ready."
    move_count: int = 0
    draw_count: int = 0
    start_time: float | None = None
    won: bool = False
