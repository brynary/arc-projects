from __future__ import annotations

import ui
from models import Card, CursorPosition, CursorRegion, FoundationPile, GameState, StockPile, Suit, TableauPile, WastePile
from ui import SolitaireUI, calculate_layout, card_lines, clamp_cursor, game_over_lines, help_menu_lines, move_cursor


class FakeScreen:
    def __init__(self, *, height: int = 40, width: int = 120) -> None:
        self.height = height
        self.width = width
        self.calls: list[tuple[int, int, str, int]] = []
        self.keypad_enabled = False

    def keypad(self, enabled: bool) -> None:
        self.keypad_enabled = enabled

    def getmaxyx(self) -> tuple[int, int]:
        return self.height, self.width

    def erase(self) -> None:
        return None

    def refresh(self) -> None:
        return None

    def addstr(self, y: int, x: int, text: str, attr: int = 0) -> None:
        self.calls.append((y, x, text, attr))

    def getch(self) -> int:
        return -1


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


def make_ui(monkeypatch) -> SolitaireUI:
    monkeypatch.setattr(ui.curses, "curs_set", lambda *_args: None)
    monkeypatch.setattr(ui.curses, "has_colors", lambda: False)
    return SolitaireUI(FakeScreen())


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


def test_help_menu_lines_include_core_controls() -> None:
    lines = help_menu_lines()

    assert lines[0] == "Help"
    assert any("Enter/Space" in line for line in lines)
    assert any("H or ?" in line for line in lines)


def test_handle_key_draws_from_stock(monkeypatch) -> None:
    solitaire_ui = make_ui(monkeypatch)
    solitaire_ui.state = empty_state()
    solitaire_ui.state.stock = StockPile(cards=[make_card(1, Suit.SPADES, face_up=False)])

    assert solitaire_ui.handle_key(ord("d")) is False
    assert solitaire_ui.state.draw_count == 1
    assert solitaire_ui.state.waste.top() is not None
    assert solitaire_ui.state.waste.top().short_name == "AS"
    assert solitaire_ui.state.waste.top().face_up is True


def test_handle_key_blocks_selection_after_win(monkeypatch) -> None:
    solitaire_ui = make_ui(monkeypatch)
    solitaire_ui.state = empty_state(
        tableau=[TableauPile(cards=[make_card(13, Suit.CLUBS)]), *[TableauPile() for _ in range(6)]]
    )
    solitaire_ui.state.won = True
    solitaire_ui.state.message = "You won!"
    solitaire_ui.cursor = CursorPosition(region=CursorRegion.TABLEAU, pile_index=0, card_index=0)

    assert solitaire_ui.handle_key(10) is False
    assert solitaire_ui.state.selected is None
    assert solitaire_ui.state.message == "Game over. Press N for a new game, U to undo, or Q to quit."


def test_game_over_lines_include_stats() -> None:
    state = empty_state()
    state.move_count = 12
    state.draw_count = 4

    lines = game_over_lines(state)

    assert lines[0] == "Game Over - You Won!"
    assert "Moves: 12" in lines
    assert "Draws: 4" in lines
    assert any(line.startswith("Time: ") for line in lines)
