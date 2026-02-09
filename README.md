# agentstyle
Teach AI your coding style.

## Usage
Run inside a repository:

```bash
npx agentstyle
# or after install:
agentstyle
```

Keys:
- `↑/↓` move
- `Space` select/deselect
- `←/→` collapse/expand folders
- `/` filter by substring
- `p` toggle absolute/relative paths
- `o` open the highlighted path (`$EDITOR` or OS default)
- `Enter` analyze selected files via Claude CLI
- In results: `c` copy, `s` save, `b` back

## Requirements
- Claude CLI installed and available as `claude` (MVP uses `claude -p <prompt>`).
