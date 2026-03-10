from __future__ import annotations

from copy import deepcopy
import random
import time

from models import (
    Card,
    CursorPosition,
    CursorRegion,
    Deck,
    FoundationPile,
    GameSnapshot,
    GameState,
    StockPile,
    Suit,
    TableauPile,
    WastePile,
)


def new_game(rng: random.Random | None = None) -> GameState:
    """Create and deal a new draw-one Klondike game."""
    deck = Deck.standard()
    deck.shuffle(rng)

    tableau: list[TableauPile] = []
    for pile_size in range(1, 8):
        pile_cards: list[Card] = []
        for depth in range(pile_size):
            card = deck.draw()
            card.face_up = depth == pile_size - 1
            pile_cards.append(card)
        tableau.append(TableauPile(cards=pile_cards))

    stock_cards = list(deck.cards)
    stock = StockPile(cards=stock_cards)
    foundations = [FoundationPile(suit=suit) for suit in Suit]

    return GameState(
        stock=stock,
        waste=WastePile(),
        foundations=foundations,
        tableau=tableau,
        message="New game started.",
        start_time=time.time(),
    )


def draw_from_stock(state: GameState) -> bool:
    """Draw one card from stock to waste."""
    if state.won:
        state.message = "Game already won. Start a new game or undo."
        return False

    if state.stock.is_empty():
        if state.waste.is_empty():
            state.message = "Stock and waste are empty."
        else:
            state.message = "Stock is empty. Recycle the waste first."
        return False

    snapshot = _snapshot_state(state)
    card = state.stock.draw_to_waste(state.waste)
    state.history.append(snapshot)
    state.selected = None
    state.draw_count += 1
    state.message = f"Drew {card.short_name}."
    return True


def recycle_waste(state: GameState) -> bool:
    """Recycle the waste pile back into stock when legal."""
    if state.won:
        state.message = "Game already won. Start a new game or undo."
        return False

    if not state.stock.is_empty():
        state.message = "Cannot recycle while stock still has cards."
        return False
    if state.waste.is_empty():
        state.message = "Waste pile is empty."
        return False

    snapshot = _snapshot_state(state)
    state.stock.recycle_from_waste(state.waste)
    state.history.append(snapshot)
    state.selected = None
    state.message = "Recycled waste back into stock."
    return True


def move_cards(
    state: GameState,
    source: CursorPosition,
    destination: CursorPosition,
) -> bool:
    """Move a legal card or tableau run from ``source`` to ``destination``."""
    if state.won:
        state.message = "Game already won. Start a new game or undo."
        return False

    try:
        cards = _get_movable_cards(state, source)
        _validate_destination(state, source, destination, cards)
    except ValueError as error:
        state.message = str(error)
        return False

    snapshot = _snapshot_state(state)
    try:
        moved_cards = _remove_cards(state, source)
        _add_cards(state, destination, moved_cards)
    except (IndexError, ValueError) as error:
        _restore_state(state, snapshot)
        state.message = str(error)
        return False

    state.history.append(snapshot)
    state.selected = None
    state.move_count += 1

    if not check_win(state):
        state.message = _format_move_message(moved_cards, destination)
    return True


def move_card_to_foundation(state: GameState, source: CursorPosition) -> bool:
    """Move a single legal top card from waste or tableau to its foundation."""
    try:
        cards = _get_movable_cards(state, source)
    except ValueError as error:
        state.message = str(error)
        return False

    if len(cards) != 1:
        state.message = "Only one card can move to a foundation."
        return False

    foundation_index = find_foundation_for_card(state, cards[0])
    if foundation_index is None:
        state.message = f"Cannot place {cards[0].short_name} on any foundation."
        return False

    destination = CursorPosition(region=CursorRegion.FOUNDATION, pile_index=foundation_index)
    return move_cards(state, source, destination)


def undo(state: GameState) -> bool:
    """Restore the previous game state when an undo snapshot exists."""
    if not state.history:
        state.message = "Nothing to undo."
        return False

    snapshot = state.history.pop()
    _restore_state(state, snapshot)
    state.selected = None
    state.message = "Undid last action."
    return True


def check_win(state: GameState) -> bool:
    """Update and return the win flag for ``state``."""
    state.won = sum(len(pile.cards) for pile in state.foundations) == 52
    if state.won:
        state.selected = None
        state.message = "You won!"
    return state.won


def can_auto_complete(state: GameState) -> bool:
    """Return whether repeated foundation moves can finish the current game."""
    if state.won:
        return True

    simulation = _clone_state(state)
    while not simulation.won:
        moved = False
        for source in _auto_complete_sources(simulation):
            if move_card_to_foundation(simulation, source):
                moved = True
                break
        if not moved:
            break

    return simulation.won


def find_foundation_for_card(state: GameState, card: Card) -> int | None:
    """Return the foundation index that can currently accept ``card``."""
    configured_match: int | None = None
    for index, foundation in enumerate(state.foundations):
        if foundation.suit == card.suit and foundation.can_accept(card):
            configured_match = index
            break

    if configured_match is not None:
        return configured_match

    for index, foundation in enumerate(state.foundations):
        if foundation.can_accept(card):
            return index

    return None


def _auto_complete_sources(state: GameState) -> list[CursorPosition]:
    """Collect top cards that can immediately move to foundation."""
    sources: list[CursorPosition] = []

    waste_top = state.waste.top()
    if waste_top is not None and find_foundation_for_card(state, waste_top) is not None:
        sources.append(CursorPosition(region=CursorRegion.WASTE))

    for pile_index, pile in enumerate(state.tableau):
        top_card = pile.top()
        if top_card is None or not top_card.face_up:
            continue
        if find_foundation_for_card(state, top_card) is not None:
            sources.append(
                CursorPosition(
                    region=CursorRegion.TABLEAU,
                    pile_index=pile_index,
                    card_index=len(pile.cards) - 1,
                )
            )

    return sources


def _clone_state(state: GameState) -> GameState:
    """Create a deep copy of the current state without undo history."""
    snapshot = _snapshot_state(state)
    return GameState(
        stock=snapshot.stock,
        waste=snapshot.waste,
        foundations=snapshot.foundations,
        tableau=snapshot.tableau,
        selected=deepcopy(snapshot.selected),
        message=snapshot.message,
        move_count=snapshot.move_count,
        draw_count=snapshot.draw_count,
        start_time=snapshot.start_time,
        won=snapshot.won,
    )


def _snapshot_state(state: GameState) -> GameSnapshot:
    """Capture the mutable gameplay state for undo support."""
    return GameSnapshot(
        stock=deepcopy(state.stock),
        waste=deepcopy(state.waste),
        foundations=deepcopy(state.foundations),
        tableau=deepcopy(state.tableau),
        selected=deepcopy(state.selected),
        message=state.message,
        move_count=state.move_count,
        draw_count=state.draw_count,
        start_time=state.start_time,
        won=state.won,
    )


def _restore_state(state: GameState, snapshot: GameSnapshot) -> None:
    """Replace ``state`` with the contents of ``snapshot``."""
    state.stock = snapshot.stock
    state.waste = snapshot.waste
    state.foundations = snapshot.foundations
    state.tableau = snapshot.tableau
    state.selected = snapshot.selected
    state.message = snapshot.message
    state.move_count = snapshot.move_count
    state.draw_count = snapshot.draw_count
    state.start_time = snapshot.start_time
    state.won = snapshot.won


def _get_movable_cards(state: GameState, source: CursorPosition) -> list[Card]:
    """Return the cards selected from ``source`` or raise ``ValueError``."""
    if source.region == CursorRegion.STOCK:
        raise ValueError("Use draw or recycle for the stock pile.")

    if source.region == CursorRegion.WASTE:
        card = state.waste.top()
        if card is None:
            raise ValueError("Waste pile is empty.")
        return [card]

    if source.region == CursorRegion.FOUNDATION:
        foundation = _get_foundation(state, source.pile_index)
        card = foundation.top()
        if card is None:
            raise ValueError("Foundation pile is empty.")
        return [card]

    if source.region == CursorRegion.TABLEAU:
        tableau = _get_tableau(state, source.pile_index)
        if tableau.is_empty():
            raise ValueError("Tableau pile is empty.")

        start_index = len(tableau.cards) - 1 if source.card_index is None else source.card_index
        if start_index < 0 or start_index >= len(tableau.cards):
            raise ValueError("Selected tableau card is out of range.")
        if not tableau.cards[start_index].face_up:
            raise ValueError("Cannot move a face-down tableau card.")

        run = tableau.movable_run(start_index)
        if not run:
            raise ValueError("Selected cards do not form a movable tableau run.")
        return run

    raise ValueError("Unknown move source.")


def _validate_destination(
    state: GameState,
    source: CursorPosition,
    destination: CursorPosition,
    cards: list[Card],
) -> None:
    """Validate that ``cards`` can be moved to ``destination``."""
    if source.region == destination.region and source.pile_index == destination.pile_index:
        raise ValueError("Source and destination must differ.")

    if destination.region == CursorRegion.TABLEAU:
        tableau = _get_tableau(state, destination.pile_index)
        if tableau.can_accept_cards(cards):
            return
        if tableau.is_empty():
            raise ValueError("Only a King can move to an empty tableau.")
        top_card = tableau.top()
        if top_card is None:
            raise ValueError("Cannot place cards on the target tableau pile.")
        raise ValueError(f"Cannot place {cards[0].short_name} on {top_card.short_name}.")

    if destination.region == CursorRegion.FOUNDATION:
        if len(cards) != 1:
            raise ValueError("Only one card can move to a foundation.")
        foundation = _get_foundation(state, destination.pile_index)
        if foundation.can_accept(cards[0]):
            return
        raise ValueError(f"Cannot place {cards[0].short_name} on foundation.")

    raise ValueError("Cards can only move to tableau or foundation piles.")


def _remove_cards(state: GameState, source: CursorPosition) -> list[Card]:
    """Remove and return cards from ``source`` after prior validation."""
    if source.region == CursorRegion.WASTE:
        return [state.waste.pop()]
    if source.region == CursorRegion.FOUNDATION:
        foundation = _get_foundation(state, source.pile_index)
        return [foundation.pop()]
    if source.region == CursorRegion.TABLEAU:
        tableau = _get_tableau(state, source.pile_index)
        start_index = len(tableau.cards) - 1 if source.card_index is None else source.card_index
        return tableau.remove_run(start_index)
    raise ValueError("Unknown move source.")


def _add_cards(state: GameState, destination: CursorPosition, cards: list[Card]) -> None:
    """Append ``cards`` to ``destination`` after prior validation."""
    if destination.region == CursorRegion.TABLEAU:
        tableau = _get_tableau(state, destination.pile_index)
        tableau.add_cards(cards)
        return
    if destination.region == CursorRegion.FOUNDATION:
        foundation = _get_foundation(state, destination.pile_index)
        foundation.push(cards[0])
        return
    raise ValueError("Unknown move destination.")


def _get_foundation(state: GameState, pile_index: int) -> FoundationPile:
    """Return a foundation pile by index or raise a user-facing error."""
    try:
        return state.foundations[pile_index]
    except IndexError as error:
        raise ValueError("Foundation pile index is out of range.") from error


def _get_tableau(state: GameState, pile_index: int) -> TableauPile:
    """Return a tableau pile by index or raise a user-facing error."""
    try:
        return state.tableau[pile_index]
    except IndexError as error:
        raise ValueError("Tableau pile index is out of range.") from error


def _format_move_message(cards: list[Card], destination: CursorPosition) -> str:
    """Build a short success message for the completed move."""
    card_text = cards[0].short_name if len(cards) == 1 else f"{len(cards)} cards"
    if destination.region == CursorRegion.FOUNDATION:
        return f"Moved {card_text} to foundation."
    return f"Moved {card_text} to tableau {destination.pile_index + 1}."
