from __future__ import annotations

import curses
from dataclasses import dataclass
import locale
import random
import time
from typing import Literal

from game import (
    draw_from_stock,
    find_foundation_for_card,
    move_card_to_foundation,
    move_cards,
    new_game,
    recycle_waste,
    undo,
)
from models import Card, CursorPosition, CursorRegion, FoundationPile, GameState, Selection, Suit, TableauPile


MIN_TERMINAL_WIDTH = 100
MIN_TERMINAL_HEIGHT = 30
CARD_WIDTH = 7
CARD_HEIGHT = 3
TOP_LABEL_Y = 2
TOP_CARD_Y = 3
TABLEAU_TITLE_Y = 7
TABLEAU_LABEL_Y = 8
TABLEAU_START_Y = 9

PAIR_RED = 1
PAIR_BLACK = 2
PAIR_MESSAGE = 3

TOP_ROW_ORDER: tuple[tuple[CursorRegion, int], ...] = (
    (CursorRegion.STOCK, 0),
    (CursorRegion.WASTE, 0),
    (CursorRegion.FOUNDATION, 0),
    (CursorRegion.FOUNDATION, 1),
    (CursorRegion.FOUNDATION, 2),
    (CursorRegion.FOUNDATION, 3),
)

SUIT_SYMBOLS_ASCII = {
    Suit.HEARTS: "H",
    Suit.DIAMONDS: "D",
    Suit.CLUBS: "C",
    Suit.SPADES: "S",
}

SUIT_SYMBOLS_UNICODE = {
    Suit.HEARTS: "♥",
    Suit.DIAMONDS: "♦",
    Suit.CLUBS: "♣",
    Suit.SPADES: "♠",
}

HELP_MENU_LINES: tuple[str, ...] = (
    "Help",
    "",
    "Goal: Move all 52 cards to the four foundations.",
    "Arrows: move cursor between piles and tableau cards",
    "Enter/Space: select a source or place selected card(s)",
    "D: draw from stock      R: recycle waste into stock",
    "F: move the top eligible card to a foundation",
    "U: undo last action     Esc: clear the current selection",
    "N: start a new game     Q: quit",
    "H or ?: close this help menu",
)


@dataclass(frozen=True, slots=True)
class BoardLayout:
    """Calculated geometry for the current terminal size."""

    width: int
    height: int
    status_y: int
    tableau_step: int
    tableau_mode: Literal["art", "compact"]
    tableau_x: tuple[int, ...]
    foundation_x: tuple[int, ...]

    @property
    def tableau_rows(self) -> int:
        """Return the number of terminal rows available to tableau cards."""
        return self.status_y - TABLEAU_START_Y


def supports_unicode_suits() -> bool:
    """Return whether the locale likely supports Unicode suit glyphs."""
    encoding = locale.getpreferredencoding(False)
    return "UTF" in encoding.upper()


def suit_symbol(suit: Suit, *, use_unicode: bool = False) -> str:
    """Return a single printable suit symbol."""
    symbols = SUIT_SYMBOLS_UNICODE if use_unicode else SUIT_SYMBOLS_ASCII
    return symbols[suit]


def format_card_label(card: Card, *, use_unicode: bool = False) -> str:
    """Return a compact card label such as ``AH`` or ``10♠``."""
    return f"{card.rank_label}{suit_symbol(card.suit, use_unicode=use_unicode)}"


def card_lines(
    card: Card | None,
    *,
    hidden: bool = False,
    empty_label: str = "--",
    use_unicode: bool = False,
) -> tuple[str, str, str]:
    """Return a three-line ASCII-art card box."""
    if hidden:
        middle = "#####"
    elif card is None:
        middle = empty_label.center(5)
    else:
        middle = format_card_label(card, use_unicode=use_unicode).center(5)[:5]

    return (
        "+-----+",
        f"|{middle}|",
        "+-----+",
    )


def compact_card_text(
    card: Card | None,
    *,
    hidden: bool = False,
    empty_label: str = "--",
    use_unicode: bool = False,
) -> str:
    """Return a one-line compact card token."""
    if hidden:
        content = "###"
    elif card is None:
        content = empty_label
    else:
        content = format_card_label(card, use_unicode=use_unicode)
    return f"[{content:^3}]"


def first_face_up_index(pile: TableauPile) -> int | None:
    """Return the first face-up card index in a tableau pile."""
    for index, card in enumerate(pile.cards):
        if card.face_up:
            return index
    return None


def calculate_layout(width: int, height: int, max_tableau_cards: int, help_visible: bool) -> BoardLayout | None:
    """Return the board layout for the current terminal size."""
    if width < MIN_TERMINAL_WIDTH or height < MIN_TERMINAL_HEIGHT:
        return None

    status_lines = 4 if help_visible else 3
    status_y = height - status_lines
    available_rows = status_y - TABLEAU_START_Y
    if available_rows < 3:
        return None

    art_height = CARD_HEIGHT + max(0, max_tableau_cards - 1) * 2
    tableau_mode: Literal["art", "compact"] = "art" if art_height <= available_rows else "compact"
    tableau_step = 2 if tableau_mode == "art" else 1

    left_margin = 2
    step_x = (width - (left_margin * 2) - CARD_WIDTH) // 6
    if step_x < CARD_WIDTH + 1:
        return None

    tableau_x = tuple(left_margin + step_x * index for index in range(7))
    foundation_x = tuple(tableau_x[index + 2] for index in range(4))

    return BoardLayout(
        width=width,
        height=height,
        status_y=status_y,
        tableau_step=tableau_step,
        tableau_mode=tableau_mode,
        tableau_x=tableau_x,
        foundation_x=foundation_x,
    )


def clamp_cursor(state: GameState, cursor: CursorPosition) -> CursorPosition:
    """Clamp a cursor position to the current board state."""
    if cursor.region == CursorRegion.STOCK:
        return CursorPosition(region=CursorRegion.STOCK)

    if cursor.region == CursorRegion.WASTE:
        return CursorPosition(region=CursorRegion.WASTE)

    if cursor.region == CursorRegion.FOUNDATION:
        pile_index = max(0, min(cursor.pile_index, len(state.foundations) - 1))
        return CursorPosition(region=CursorRegion.FOUNDATION, pile_index=pile_index)

    pile_index = max(0, min(cursor.pile_index, len(state.tableau) - 1))
    pile = state.tableau[pile_index]
    if pile.is_empty():
        return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index)

    start_index = first_face_up_index(pile)
    if start_index is None:
        return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index)

    if cursor.card_index is None:
        return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index, card_index=len(pile.cards) - 1)

    card_index = max(start_index, min(cursor.card_index, len(pile.cards) - 1))
    return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index, card_index=card_index)


def move_cursor(
    state: GameState,
    cursor: CursorPosition,
    direction: Literal["left", "right", "up", "down"],
) -> CursorPosition:
    """Return the next cursor position for a navigation direction."""
    cursor = clamp_cursor(state, cursor)

    if direction == "left":
        if cursor.region == CursorRegion.TABLEAU:
            return _tableau_cursor_for_pile(state, max(0, cursor.pile_index - 1), cursor.card_index)
        region, pile_index = TOP_ROW_ORDER[max(0, _top_row_index(cursor) - 1)]
        return CursorPosition(region=region, pile_index=pile_index)

    if direction == "right":
        if cursor.region == CursorRegion.TABLEAU:
            return _tableau_cursor_for_pile(
                state,
                min(len(state.tableau) - 1, cursor.pile_index + 1),
                cursor.card_index,
            )
        region, pile_index = TOP_ROW_ORDER[min(len(TOP_ROW_ORDER) - 1, _top_row_index(cursor) + 1)]
        return CursorPosition(region=region, pile_index=pile_index)

    if direction == "up":
        if cursor.region != CursorRegion.TABLEAU:
            return cursor

        pile = state.tableau[cursor.pile_index]
        if not pile.is_empty() and cursor.card_index is not None:
            start_index = first_face_up_index(pile)
            if start_index is not None and cursor.card_index > start_index:
                return CursorPosition(
                    region=CursorRegion.TABLEAU,
                    pile_index=cursor.pile_index,
                    card_index=cursor.card_index - 1,
                )

        return _top_row_for_tableau_pile(cursor.pile_index)

    if cursor.region != CursorRegion.TABLEAU:
        return _tableau_cursor_for_pile(state, _tableau_pile_for_top_row(cursor), None)

    pile = state.tableau[cursor.pile_index]
    if pile.is_empty() or cursor.card_index is None:
        return cursor
    if cursor.card_index < len(pile.cards) - 1:
        return CursorPosition(
            region=CursorRegion.TABLEAU,
            pile_index=cursor.pile_index,
            card_index=cursor.card_index + 1,
        )
    return cursor


def _top_row_index(cursor: CursorPosition) -> int:
    """Return the linear index of a top-row cursor position."""
    pair = (cursor.region, cursor.pile_index if cursor.region == CursorRegion.FOUNDATION else 0)
    return TOP_ROW_ORDER.index(pair)


def _tableau_cursor_for_pile(
    state: GameState,
    pile_index: int,
    preferred_card_index: int | None,
) -> CursorPosition:
    """Return a tableau cursor that matches the requested pile and depth."""
    pile = state.tableau[pile_index]
    if pile.is_empty():
        return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index)

    start_index = first_face_up_index(pile)
    if start_index is None:
        return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index)

    if preferred_card_index is None:
        return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index, card_index=len(pile.cards) - 1)

    card_index = max(start_index, min(preferred_card_index, len(pile.cards) - 1))
    return CursorPosition(region=CursorRegion.TABLEAU, pile_index=pile_index, card_index=card_index)


def _top_row_for_tableau_pile(pile_index: int) -> CursorPosition:
    """Return the top-row cursor reached by moving upward from a tableau pile."""
    if pile_index == 0:
        return CursorPosition(region=CursorRegion.STOCK)
    if pile_index == 1:
        return CursorPosition(region=CursorRegion.WASTE)
    return CursorPosition(region=CursorRegion.FOUNDATION, pile_index=min(pile_index - 2, 3))


def _tableau_pile_for_top_row(cursor: CursorPosition) -> int:
    """Return the tableau pile reached by moving downward from a top-row pile."""
    if cursor.region == CursorRegion.STOCK:
        return 0
    if cursor.region == CursorRegion.WASTE:
        return 1
    return min(cursor.pile_index + 2, 6)


def _selection_matches_cursor(selection: Selection, cursor: CursorPosition) -> bool:
    """Return whether a cursor points at the selected source card or pile."""
    if selection.source.region != cursor.region or selection.source.pile_index != cursor.pile_index:
        return False
    if selection.source.region != CursorRegion.TABLEAU:
        return True
    return selection.start_index == cursor.card_index


def _message_is_error(message: str) -> bool:
    """Return whether a message should be highlighted as an error."""
    lowered = message.lower()
    return (
        lowered.startswith("cannot")
        or lowered.startswith("only")
        or lowered.startswith("use")
        or lowered.startswith("nothing")
        or lowered.startswith("unsupported")
        or lowered.startswith("waste")
        or lowered.startswith("stock")
        or " empty" in lowered
    )


def _source_from_cursor(state: GameState, cursor: CursorPosition) -> tuple[CursorPosition | None, str | None]:
    """Return a validated move source for the current cursor."""
    cursor = clamp_cursor(state, cursor)

    if cursor.region == CursorRegion.STOCK:
        return None, "Press D or Enter to draw from the stock."

    if cursor.region == CursorRegion.WASTE:
        if state.waste.is_empty():
            return None, "Waste pile is empty."
        return CursorPosition(region=CursorRegion.WASTE), None

    if cursor.region == CursorRegion.FOUNDATION:
        if state.foundations[cursor.pile_index].is_empty():
            return None, "Foundation pile is empty."
        return CursorPosition(region=CursorRegion.FOUNDATION, pile_index=cursor.pile_index), None

    pile = state.tableau[cursor.pile_index]
    if pile.is_empty():
        return None, "Tableau pile is empty."
    if cursor.card_index is None:
        return None, "Choose a face-up tableau card."
    if not pile.cards[cursor.card_index].face_up:
        return None, "Cannot move a face-down tableau card."
    if not pile.movable_run(cursor.card_index):
        return None, "Selected cards do not form a movable tableau run."
    return CursorPosition(
        region=CursorRegion.TABLEAU,
        pile_index=cursor.pile_index,
        card_index=cursor.card_index,
    ), None


def _auto_foundation_source(
    state: GameState,
    cursor: CursorPosition,
    selection: Selection | None,
) -> CursorPosition | None:
    """Return the source used by the auto-foundation shortcut."""
    if selection is not None:
        return selection.source

    cursor = clamp_cursor(state, cursor)
    if cursor.region == CursorRegion.STOCK:
        return None
    if cursor.region == CursorRegion.WASTE:
        return CursorPosition(region=CursorRegion.WASTE)
    if cursor.region == CursorRegion.FOUNDATION:
        return CursorPosition(region=CursorRegion.FOUNDATION, pile_index=cursor.pile_index)

    pile = state.tableau[cursor.pile_index]
    if pile.is_empty():
        return None
    return CursorPosition(
        region=CursorRegion.TABLEAU,
        pile_index=cursor.pile_index,
        card_index=len(pile.cards) - 1,
    )


def _card_at_source(state: GameState, source: CursorPosition) -> Card | None:
    """Return the lead card for a move source."""
    if source.region == CursorRegion.WASTE:
        return state.waste.top()
    if source.region == CursorRegion.FOUNDATION:
        return state.foundations[source.pile_index].top()
    if source.region == CursorRegion.TABLEAU:
        pile = state.tableau[source.pile_index]
        if source.card_index is None or source.card_index >= len(pile.cards):
            return None
        return pile.cards[source.card_index]
    return None


def help_menu_lines() -> tuple[str, ...]:
    """Return the help menu lines shown in the in-game overlay."""
    return HELP_MENU_LINES


def game_over_lines(state: GameState) -> tuple[str, ...]:
    """Return the centered game-over panel contents for a won game."""
    return (
        "Game Over - You Won!",
        "",
        f"Moves: {state.move_count}",
        f"Draws: {state.draw_count}",
        f"Time: {_format_elapsed_time(state.start_time)}",
        "",
        "Press N to start a new game.",
        "Press U to undo the winning move.",
        "Press Q to quit.",
    )


class SolitaireUI:
    """Terminal controller and renderer for the curses-based game."""

    def __init__(self, stdscr: curses.window) -> None:
        self.stdscr = stdscr
        self.state = new_game()
        self.cursor = CursorPosition(region=CursorRegion.STOCK)
        self.help_visible = False
        self.pending_action: Literal["new", "quit"] | None = None
        self.use_unicode = supports_unicode_suits()
        self.colors_enabled = False
        self.win_animation_played = False

        self.stdscr.keypad(True)
        try:
            curses.curs_set(0)
        except curses.error:
            pass

        self._init_colors()

    def _init_colors(self) -> None:
        """Initialize color pairs when the terminal supports them."""
        if not curses.has_colors():
            return

        curses.start_color()
        try:
            curses.use_default_colors()
            background = -1
        except curses.error:
            background = curses.COLOR_BLACK

        curses.init_pair(PAIR_RED, curses.COLOR_RED, background)
        curses.init_pair(PAIR_BLACK, curses.COLOR_WHITE, background)
        curses.init_pair(PAIR_MESSAGE, curses.COLOR_YELLOW, background)
        self.colors_enabled = True

    def loop(self) -> None:
        """Run the main curses event loop."""
        while True:
            self.cursor = clamp_cursor(self.state, self.cursor)
            self.render()
            if self.handle_key(self.stdscr.getch()):
                return

    def handle_key(self, key: int) -> bool:
        """Handle a single keypress. Return ``True`` when the UI should exit."""
        if self.pending_action is not None:
            return self._handle_pending_action(key)

        if key == curses.KEY_RESIZE:
            return False
        if key == curses.KEY_LEFT:
            self.cursor = move_cursor(self.state, self.cursor, "left")
        elif key == curses.KEY_RIGHT:
            self.cursor = move_cursor(self.state, self.cursor, "right")
        elif key == curses.KEY_UP:
            self.cursor = move_cursor(self.state, self.cursor, "up")
        elif key == curses.KEY_DOWN:
            self.cursor = move_cursor(self.state, self.cursor, "down")
        elif key in (ord("h"), ord("H"), ord("?")):
            self.help_visible = not self.help_visible
        elif key in (ord("u"), ord("U")):
            undo(self.state)
        elif key in (ord("n"), ord("N")):
            self.pending_action = "new"
        elif key in (ord("q"), ord("Q")):
            self.pending_action = "quit"
        elif self.state.won:
            if key != -1:
                self.state.message = "Game over. Press N for a new game, U to undo, or Q to quit."
        elif key in (10, 13, curses.KEY_ENTER, ord(" ")):
            self._activate_cursor()
        elif key == 27:
            self._cancel_selection()
        elif key in (ord("d"), ord("D")):
            draw_from_stock(self.state)
        elif key in (ord("r"), ord("R")):
            recycle_waste(self.state)
        elif key in (ord("f"), ord("F")):
            self._move_selected_to_foundation()
        elif key == ord("W"):
            self._trigger_secret_win()
        elif key != -1:
            self.state.message = "Unsupported key. Press ? for help."

        self.cursor = clamp_cursor(self.state, self.cursor)
        return False

    def render(self) -> None:
        """Redraw the full board state."""
        self.stdscr.erase()
        height, width = self.stdscr.getmaxyx()
        layout = calculate_layout(
            width,
            height,
            max((len(pile.cards) for pile in self.state.tableau), default=0),
            self.help_visible,
        )
        if layout is None:
            self._render_too_small(width, height)
            self.stdscr.refresh()
            return

        self._draw_header(layout)
        self._draw_top_row(layout)
        self._draw_tableau(layout)
        self._draw_status(layout)
        if self.help_visible:
            self._draw_help_menu()
        if self.state.won and self.pending_action is None:
            if not self.win_animation_played:
                self.stdscr.refresh()
                self._play_win_animation(layout)
                self.win_animation_played = True
                self.stdscr.erase()
                self._draw_header(layout)
                self._draw_top_row(layout)
                self._draw_tableau(layout)
                self._draw_status(layout)
            self._draw_game_over_screen()
        self.stdscr.refresh()

    def _draw_header(self, layout: BoardLayout) -> None:
        """Draw the header line with title and stats."""
        title = "Klondike Solitaire"
        stats = (
            f"Moves: {self.state.move_count}  "
            f"Draws: {self.state.draw_count}  "
            f"Time: {_format_elapsed_time(self.state.start_time)}"
        )
        self._draw_text(0, 2, title, curses.A_BOLD)
        self._draw_text(0, max(2, layout.width - len(stats) - 2), stats)

    def _draw_top_row(self, layout: BoardLayout) -> None:
        """Draw stock, waste, and foundations."""
        self._draw_text(TOP_LABEL_Y, layout.tableau_x[0], f"Stock {len(self.state.stock.cards):>2}", curses.A_BOLD)
        self._draw_text(TOP_LABEL_Y, layout.tableau_x[1], f"Waste {len(self.state.waste.cards):>2}", curses.A_BOLD)
        for index, x in enumerate(layout.foundation_x):
            self._draw_text(TOP_LABEL_Y, x, f"F{index + 1}", curses.A_BOLD)

        self._draw_card_box(
            TOP_CARD_Y,
            layout.tableau_x[0],
            None,
            hidden=not self.state.stock.is_empty(),
            focused=self.cursor.region == CursorRegion.STOCK,
            selected=False,
        )

        waste_selected = self.state.selected is not None and self.state.selected.source.region == CursorRegion.WASTE
        self._draw_card_box(
            TOP_CARD_Y,
            layout.tableau_x[1],
            self.state.waste.top(),
            focused=self.cursor.region == CursorRegion.WASTE,
            selected=waste_selected,
            use_empty_label="--",
        )

        for index, x in enumerate(layout.foundation_x):
            selected = (
                self.state.selected is not None
                and self.state.selected.source.region == CursorRegion.FOUNDATION
                and self.state.selected.source.pile_index == index
            )
            self._draw_card_box(
                TOP_CARD_Y,
                x,
                self.state.foundations[index].top(),
                focused=self.cursor.region == CursorRegion.FOUNDATION and self.cursor.pile_index == index,
                selected=selected,
            )

    def _draw_tableau(self, layout: BoardLayout) -> None:
        """Draw all tableau piles."""
        self._draw_text(TABLEAU_TITLE_Y, 2, "Tableau", curses.A_BOLD)
        for index, x in enumerate(layout.tableau_x):
            self._draw_text(TABLEAU_LABEL_Y, x, f"T{index + 1}", curses.A_BOLD)

        for pile_index, pile in enumerate(self.state.tableau):
            if layout.tableau_mode == "art":
                self._draw_tableau_pile_art(layout, pile_index, pile)
            else:
                self._draw_tableau_pile_compact(layout, pile_index, pile)

    def _draw_tableau_pile_art(self, layout: BoardLayout, pile_index: int, pile: TableauPile) -> None:
        """Draw a tableau pile with stacked ASCII-art cards."""
        x = layout.tableau_x[pile_index]
        if pile.is_empty():
            self._draw_card_box(
                TABLEAU_START_Y,
                x,
                None,
                focused=self.cursor.region == CursorRegion.TABLEAU and self.cursor.pile_index == pile_index,
                selected=False,
            )
            return

        for card_index, card in enumerate(pile.cards):
            selected = self._tableau_card_is_selected(pile_index, card_index)
            focused = (
                self.cursor.region == CursorRegion.TABLEAU
                and self.cursor.pile_index == pile_index
                and self.cursor.card_index == card_index
            )
            self._draw_card_box(
                TABLEAU_START_Y + card_index * layout.tableau_step,
                x,
                card if card.face_up else None,
                hidden=not card.face_up,
                focused=focused,
                selected=selected,
            )

    def _draw_tableau_pile_compact(self, layout: BoardLayout, pile_index: int, pile: TableauPile) -> None:
        """Draw a tableau pile in one-line compact mode."""
        x = layout.tableau_x[pile_index]
        if pile.is_empty():
            attr = self._card_attr(
                None,
                hidden=False,
                focused=self.cursor.region == CursorRegion.TABLEAU and self.cursor.pile_index == pile_index,
                selected=False,
            )
            self._draw_text(TABLEAU_START_Y, x, compact_card_text(None), attr)
            return

        visible_capacity = max(1, layout.tableau_rows)
        hidden_count = max(0, len(pile.cards) - visible_capacity)
        visible_start = hidden_count
        row_y = TABLEAU_START_Y
        if hidden_count > 0:
            self._draw_text(row_y, x, "  ...  ", curses.A_DIM)
            row_y += 1
            visible_start = len(pile.cards) - max(1, visible_capacity - 1)

        for offset, card_index in enumerate(range(visible_start, len(pile.cards))):
            card = pile.cards[card_index]
            focused = (
                self.cursor.region == CursorRegion.TABLEAU
                and self.cursor.pile_index == pile_index
                and self.cursor.card_index == card_index
            )
            selected = self._tableau_card_is_selected(pile_index, card_index)
            attr = self._card_attr(
                card if card.face_up else None,
                hidden=not card.face_up,
                focused=focused,
                selected=selected,
            )
            self._draw_text(
                row_y + offset,
                x,
                compact_card_text(card if card.face_up else None, hidden=not card.face_up, use_unicode=self.use_unicode),
                attr,
            )

    def _draw_status(self, layout: BoardLayout) -> None:
        """Draw the mode, message, and help footer."""
        self._draw_text(layout.status_y, 2, self._mode_text(), curses.A_BOLD)

        message_attr = curses.color_pair(PAIR_MESSAGE) if self.colors_enabled and _message_is_error(self.state.message) else 0
        if self.state.won:
            message_attr |= curses.A_BOLD
        self._draw_text(layout.status_y + 1, 2, f"Message: {self.state.message}", message_attr)

        if not self.help_visible:
            self._draw_text(layout.status_y + 2, 2, "Press H or ? for help.")
            return

        self._draw_text(
            layout.status_y + 2,
            2,
            "Keys: Arrows move | Enter/Space select/place | D draw | R recycle | F foundation | U undo",
        )
        self._draw_text(
            layout.status_y + 3,
            2,
            "      N new | Q quit | H/? help | Esc cancel selection | Enter on Stock draws",
        )

    def _draw_help_menu(self) -> None:
        """Draw a centered help overlay with key bindings and goals."""
        self._draw_centered_panel(help_menu_lines(), bold_first_line=True)

    def _play_win_animation(self, layout: BoardLayout) -> None:
        """Play the classic bouncing-cards celebration animation."""
        # Collect cards from foundations, top (King) first
        anim_cards: list[tuple[Card, int]] = []
        for foundation_index in range(4):
            pile = self.state.foundations[foundation_index]
            for card in reversed(pile.cards):
                anim_cards.append((card, foundation_index))

        if not anim_cards:
            return

        height, width = self.stdscr.getmaxyx()
        bottom_y = height - CARD_HEIGHT - 1
        rng = random.Random()

        # Active bouncing cards: (card, x, y, vx, vy)
        active: list[tuple[Card, float, float, float, float]] = []
        launch_index = 0
        frames_since_launch = 0
        launch_interval = 3

        gravity = 0.6
        damping = 0.75

        self.stdscr.nodelay(True)
        try:
            while launch_index < len(anim_cards) or active:
                # Check for keypress to skip
                key = self.stdscr.getch()
                if key != -1:
                    return

                # Launch a new card every launch_interval frames
                if launch_index < len(anim_cards) and frames_since_launch >= launch_interval:
                    card, fi = anim_cards[launch_index]
                    start_x = float(layout.foundation_x[fi])
                    start_y = float(TOP_CARD_Y)
                    # Alternate direction: even foundations go left, odd go right
                    direction = -1.0 if fi % 2 == 0 else 1.0
                    vx = direction * (rng.uniform(1.5, 3.5))
                    vy = rng.uniform(0.5, 2.0)
                    active.append((card, start_x, start_y, vx, vy))
                    launch_index += 1
                    frames_since_launch = 0

                # Update physics and draw
                next_active: list[tuple[Card, float, float, float, float]] = []
                for card, x, y, vx, vy in active:
                    vy += gravity
                    x += vx
                    y += vy

                    # Bounce off bottom
                    if y >= bottom_y:
                        y = float(bottom_y)
                        vy = -abs(vy) * damping
                        # Stop bouncing when velocity is negligible
                        if abs(vy) < 1.0:
                            vy = 0.0

                    # Draw the card at its current position (trail effect: no erase)
                    ix, iy = int(x), int(y)
                    if 0 <= ix < width - CARD_WIDTH and 0 <= iy <= bottom_y:
                        attr = self._card_attr(card, hidden=False, focused=False, selected=False)
                        for offset, line in enumerate(
                            card_lines(card, use_unicode=self.use_unicode)
                        ):
                            self._draw_text(iy + offset, ix, line, attr)

                    # Keep card if still on screen horizontally
                    if -CARD_WIDTH < x < width:
                        next_active.append((card, x, y, vx, vy))

                active = next_active
                frames_since_launch += 1

                self.stdscr.refresh()
                curses.napms(33)
        finally:
            self.stdscr.nodelay(False)

    def _draw_game_over_screen(self) -> None:
        """Draw a centered game-over overlay when the player wins."""
        self._draw_centered_panel(game_over_lines(self.state), bold_first_line=True)

    def _mode_text(self) -> str:
        """Return the current mode line text."""
        if self.pending_action == "quit":
            return "Prompt: Quit the current game? [y/N]"
        if self.pending_action == "new":
            return "Prompt: Start a new game? [y/N]"
        if self.state.won:
            return "Mode: You won. Press N for a new game, U to undo, or Q to quit."
        if self.state.selected is None:
            return "Mode: Navigate. Move the cursor and press Enter/Space to select or place cards."

        source = self.state.selected.source
        card = _card_at_source(self.state, source)
        if card is None:
            return "Mode: Card selected. Choose a destination."

        card_text = format_card_label(card, use_unicode=self.use_unicode)
        if source.region == CursorRegion.TABLEAU and source.card_index is not None:
            run_length = len(self.state.tableau[source.pile_index].cards) - source.card_index
            return f"Mode: Selected {run_length} card(s) starting with {card_text}. Choose a tableau or foundation destination."
        return f"Mode: Selected {card_text}. Choose a tableau or foundation destination."

    def _activate_cursor(self) -> None:
        """Handle Enter/Space on the current cursor."""
        if self.state.selected is None:
            if self.cursor.region == CursorRegion.STOCK:
                draw_from_stock(self.state)
                return

            source, error = _source_from_cursor(self.state, self.cursor)
            if source is None:
                if error is not None:
                    self.state.message = error
                return

            self.state.selected = Selection(source=source, start_index=source.card_index)
            self.state.message = self._selection_message(source)
            return

        if _selection_matches_cursor(self.state.selected, self.cursor):
            self._cancel_selection()
            return

        destination = CursorPosition(region=self.cursor.region, pile_index=self.cursor.pile_index)
        if move_cards(self.state, self.state.selected.source, destination):
            self.cursor = clamp_cursor(self.state, destination)

    def _selection_message(self, source: CursorPosition) -> str:
        """Return the message shown after selecting a source."""
        card = _card_at_source(self.state, source)
        if card is None:
            return "Selected source."

        card_text = format_card_label(card, use_unicode=self.use_unicode)
        if source.region == CursorRegion.TABLEAU and source.card_index is not None:
            run_length = len(self.state.tableau[source.pile_index].cards) - source.card_index
            return f"Selected {run_length} card(s) starting with {card_text}."
        return f"Selected {card_text}."

    def _cancel_selection(self) -> None:
        """Clear the current selection if one exists."""
        if self.state.selected is None:
            self.state.message = "No card selected."
            return
        self.state.selected = None
        self.state.message = "Selection cleared."

    def _move_selected_to_foundation(self) -> None:
        """Attempt to move the selected or focused card to a foundation pile."""
        source = _auto_foundation_source(self.state, self.cursor, self.state.selected)
        if source is None:
            self.state.message = "Choose a waste, foundation, or top tableau card first."
            return

        card = _card_at_source(self.state, source)
        if card is None:
            self.state.message = "No card selected."
            return

        foundation_index = find_foundation_for_card(self.state, card)
        if move_card_to_foundation(self.state, source) and foundation_index is not None:
            self.cursor = CursorPosition(region=CursorRegion.FOUNDATION, pile_index=foundation_index)

    def _trigger_secret_win(self) -> None:
        """Move all cards into foundations to trigger the win state."""
        state = self.state
        # Gather every card from stock, waste, and tableau
        all_cards: list[Card] = []
        all_cards.extend(state.stock.cards)
        state.stock.cards.clear()
        all_cards.extend(state.waste.cards)
        state.waste.cards.clear()
        for pile in state.tableau:
            all_cards.extend(pile.cards)
            pile.cards.clear()
        # Sort into suits, then by rank ascending
        suit_order = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES]
        by_suit: dict[Suit, list[Card]] = {s: [] for s in suit_order}
        for card in all_cards:
            card.face_up = True
            by_suit[card.suit].append(card)
        for cards in by_suit.values():
            cards.sort(key=lambda c: c.rank)
        # Place into foundations
        state.foundations = [
            FoundationPile(cards=by_suit[s], suit=s) for s in suit_order
        ]
        state.won = True
        state.selected = None
        state.message = "You won!"
        self.win_animation_played = False

    def _handle_pending_action(self, key: int) -> bool:
        """Handle confirmation input for new-game and quit prompts."""
        if key in (ord("y"), ord("Y"), 10, 13, curses.KEY_ENTER):
            action = self.pending_action
            self.pending_action = None
            if action == "quit":
                return True

            self.state = new_game()
            self.cursor = CursorPosition(region=CursorRegion.STOCK)
            self.win_animation_played = False
            return False

        if key in (27, ord("n"), ord("N")):
            self.pending_action = None
            self.state.message = "Cancelled."
            return False

        if key == curses.KEY_RESIZE:
            return False

        self.state.message = "Press Y to confirm or N to cancel."
        return False

    def _tableau_card_is_selected(self, pile_index: int, card_index: int) -> bool:
        """Return whether a tableau card belongs to the selected run."""
        selection = self.state.selected
        return (
            selection is not None
            and selection.source.region == CursorRegion.TABLEAU
            and selection.source.pile_index == pile_index
            and selection.start_index is not None
            and card_index >= selection.start_index
        )

    def _draw_card_box(
        self,
        y: int,
        x: int,
        card: Card | None,
        *,
        hidden: bool = False,
        focused: bool = False,
        selected: bool = False,
        use_empty_label: str = "--",
    ) -> None:
        """Draw a three-line card box at the given position."""
        attr = self._card_attr(card, hidden=hidden, focused=focused, selected=selected)
        for offset, line in enumerate(
            card_lines(card, hidden=hidden, empty_label=use_empty_label, use_unicode=self.use_unicode)
        ):
            self._draw_text(y + offset, x, line, attr)

    def _card_attr(self, card: Card | None, *, hidden: bool, focused: bool, selected: bool) -> int:
        """Return curses attributes for a rendered card."""
        attr = 0
        if self.colors_enabled:
            if hidden or card is None:
                attr |= curses.color_pair(PAIR_BLACK)
            elif card.color == "red":
                attr |= curses.color_pair(PAIR_RED)
            else:
                attr |= curses.color_pair(PAIR_BLACK)

        if hidden:
            attr |= curses.A_DIM
        if selected:
            attr |= curses.A_STANDOUT | curses.A_BOLD
        if focused:
            attr |= curses.A_REVERSE | curses.A_BOLD
        return attr

    def _draw_text(self, y: int, x: int, text: str, attr: int = 0) -> None:
        """Safely draw clipped text inside the current screen bounds."""
        height, width = self.stdscr.getmaxyx()
        if y < 0 or y >= height or x >= width:
            return
        if x < 0:
            text = text[-x:]
            x = 0
        clipped = text[: max(0, width - x)]
        if not clipped:
            return
        try:
            self.stdscr.addstr(y, x, clipped, attr)
        except curses.error:
            pass

    def _draw_centered_panel(self, lines: tuple[str, ...], *, bold_first_line: bool = False) -> None:
        """Draw a simple centered bordered panel over the current board."""
        height, width = self.stdscr.getmaxyx()
        if height < 6 or width < 20:
            return

        inner_width = max(len(line) for line in lines)
        panel_width = min(width - 4, inner_width + 4)
        panel_height = len(lines) + 2
        start_y = max(1, (height - panel_height) // 2)
        start_x = max(2, (width - panel_width) // 2)

        border = "+" + "-" * (panel_width - 2) + "+"
        self._draw_text(start_y, start_x, border, curses.A_BOLD)
        for index, line in enumerate(lines, start=1):
            text = line[: panel_width - 4]
            padded = text.ljust(panel_width - 4)
            attr = curses.A_BOLD if bold_first_line and index == 1 else 0
            self._draw_text(start_y + index, start_x, f"| {padded} |", attr)
        self._draw_text(start_y + panel_height - 1, start_x, border, curses.A_BOLD)

    def _render_too_small(self, width: int, height: int) -> None:
        """Render a resize warning when the terminal is too small."""
        lines = [
            "Klondike Solitaire",
            "",
            f"Terminal too small: {width}x{height}",
            f"Resize to at least {MIN_TERMINAL_WIDTH}x{MIN_TERMINAL_HEIGHT}.",
            "Resize the terminal or press Q to quit.",
        ]
        for index, line in enumerate(lines):
            self._draw_text(2 + index, 2, line, curses.A_BOLD if index == 0 else 0)


def _format_elapsed_time(start_time: float | None) -> str:
    """Return elapsed time in MM:SS format."""
    if start_time is None:
        return "00:00"
    elapsed = max(0, int(time.time() - start_time))
    minutes, seconds = divmod(elapsed, 60)
    return f"{minutes:02d}:{seconds:02d}"


def _run_curses(stdscr: curses.window) -> None:
    """Curses wrapper callback that owns the UI lifecycle."""
    SolitaireUI(stdscr).loop()


def run() -> None:
    """Run the Klondike terminal UI."""
    curses.wrapper(_run_curses)