from __future__ import annotations

import curses

import main


def test_main_runs_ui_and_returns_zero(monkeypatch) -> None:
    called: list[str] = []

    monkeypatch.setattr(main, "run", lambda: called.append("run"))

    assert main.main() == 0
    assert called == ["run"]


def test_main_returns_error_code_when_curses_ui_fails(monkeypatch, capsys) -> None:
    def raise_error() -> None:
        raise curses.error("terminal setup failed")

    monkeypatch.setattr(main, "run", raise_error)

    assert main.main() == 1
    assert "Unable to start the terminal UI" in capsys.readouterr().err
