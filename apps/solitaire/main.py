#!/usr/bin/env python3

from __future__ import annotations

import curses
import sys
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parent / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from ui import run


def main() -> int:
    """Launch the terminal Klondike Solitaire game."""
    try:
        run()
    except KeyboardInterrupt:
        print("\nExiting Klondike Solitaire.", file=sys.stderr)
        return 130
    except curses.error as error:
        print(f"Unable to start the terminal UI: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
