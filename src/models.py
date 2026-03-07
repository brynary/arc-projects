"""Core data models for the terminal Klondike Solitaire project."""

from __future__ import annotations

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
        return self.face_up and other.face_up and self.color != other.color and self.rank == other.rank - 1

    def can_move_to_foundation(self, top: Card | None) -> bool:
        """Return whether this card can be placed on a foundation pile."""
        if not self.face_up:
            return False
        if top is None:
            return self.rank == 1
        return self.suit == top.suit and self.rank == top.rank + 1


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
        return self.cards.pop()

    def is_empty(self) -> bool:
        """Return whether the deck has any cards remaining."""
        return not self.cards


@dataclass(slots=True)
class StockPile:
    """Face-down stock pile."""

    cards: list[Card] = field(default_factory=list)

    def top(self) -> Card | None:
        """Return the top card without removing it."""
        return self.cards[-1] if self.cards else None


@dataclass(slots=True)
class WastePile:
    """Face-up waste pile."""

    cards: list[Card] = field(default_factory=list)

    def top(self) -> Card | None:
        """Return the top card without removing it."""
        return self.cards[-1] if self.cards else None


@dataclass(slots=True)
class FoundationPile:
    """Foundation pile built upward by suit."""

    cards: list[Card] = field(default_factory=list)

    def top(self) -> Card | None:
        """Return the top card without removing it."""
        return self.cards[-1] if self.cards else None


@dataclass(slots=True)
class TableauPile:
    """Tableau pile containing face-down and face-up cards."""

    cards: list[Card] = field(default_factory=list)

    def top(self) -> Card | None:
        """Return the top card without removing it."""
        return self.cards[-1] if self.cards else None

    def movable_run(self, start_index: int) -> list[Card]:
        """Return a face-up run from ``start_index`` onward when valid."""
        if start_index < 0 or start_index >= len(self.cards):
            return []
        run = self.cards[start_index:]
        if all(card.face_up for card in run):
            return run
        return []

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