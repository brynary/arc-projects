"""Game-state scaffolding for the terminal Klondike Solitaire project."""

from __future__ import annotations

from models import FoundationPile, GameState, TableauPile


def new_game() -> GameState:
    """Return a placeholder game state with the expected pile structure."""
    return GameState(
        foundations=[FoundationPile() for _ in range(4)],
        tableau=[TableauPile() for _ in range(7)],
        message="Klondike scaffold initialized. Deal logic is not implemented yet.",
    )