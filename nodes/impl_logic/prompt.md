Goal: Build a terminal-based solitaire (Klondike) game in Python

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 57.9k tokens in / 2.3k out
- **impl_setup**: success
  - Model: claude-opus-4-6, 57.9k tokens in / 1.9k out
- **verify_setup**: success
  - Model: claude-opus-4-6, 19.8k tokens in / 1.4k out
- **check_setup**: success
- **impl_data**: success
  - Model: claude-opus-4-6, 56.1k tokens in / 1.8k out
- **verify_data**: success
  - Model: claude-opus-4-6, 22.2k tokens in / 981 out
- **check_data**: success


Read spec.md and the data structure files.
\
            Implement Klondike rules: initial deal, move validation,
\
            auto-complete detection, win condition, undo.
\
            Write tests for legal/illegal moves, win detection, edge cases.
\
            Run: python3 -m pytest tests/ -v