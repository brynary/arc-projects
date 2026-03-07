"""Application entry point stub for the Klondike Solitaire project."""

from __future__ import annotations

import sys
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parent / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from ui import run


def main() -> int:
    """Run the placeholder application entry point."""
    run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())