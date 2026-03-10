# Klondike Solitaire

A terminal-based draw-one Klondike solitaire game written in Python with the standard-library `curses` UI.

## Requirements

- Python 3.11+
- A Unix-like terminal with `curses` support

## Setup

This project does not require a separate build step, but creating a virtual environment is recommended:

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install --upgrade pip pytest
python3 -m pip install -e .
```

If your environment already includes the provided `.venv`, you can use that interpreter directly.

## Run the game

From the repository root:

```bash
python3 main.py
```

If `python3` is not available in your shell, use the virtualenv interpreter instead:

```bash
.venv/bin/python main.py
```

## Run tests

```bash
python3 -m pytest tests/
```

Fallback for environments without a `python3` command:

```bash
.venv/bin/python -m pytest tests/
```

## Controls

- Arrow keys: move the cursor
- Enter / Space: select a source or place selected cards
- `D`: draw one card from the stock
- `R`: recycle the waste into the stock when the stock is empty
- `F`: move the top eligible card to a foundation
- `U`: undo the previous action
- `Esc`: clear the current selection
- `H` or `?`: toggle the help menu
- `N`: start a new game
- `Q`: quit

## Notes

- The game shows a help overlay for controls and a centered game-over screen when you win.
- Resize the terminal to at least `100x30` for the full layout.
