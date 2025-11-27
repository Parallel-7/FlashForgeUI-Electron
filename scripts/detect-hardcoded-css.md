## detect-hardcoded-css

Go-based CLI that crawls the repo looking for “manual” theming (color literals, gradients, named colors) so we can prioritize migrating them into the theme editor system.

### Why it exists

- Flags obvious hex/rgb/hsl/gradient/named colors that aren’t wrapped in `var(--theme-*)`.
- Supports huge codebase scans quickly thanks to a worker pool and minimal allocations.
- Focuses on actionable hits: ignores lines that are already theme-aware fallbacks and skips inline explanations such as “// Green” in Discord embeds.

### Building blocks

Path: `scripts/detect-hardcoded-css.go`

Key heuristics:

1. Walks the workspace with include/exclude filters.
2. For each file it strips block/line comments, then detects:
   - Hex literals (`#4285f4`)
   - `rgb()`/`rgba()`
   - `hsl()`/`hsla()`
   - `*-gradient(...)`
   - Named colors (`white`, `transparent`, etc.) when used in property contexts
3. Suppresses matches that live inside `var(...)` tokens so CSS custom property fallbacks aren’t flagged.

### Usage

From repo root:

```bash
go run ./scripts/detect-hardcoded-css.go
```

You can route the Go build cache locally if `$HOME/.cache` isn’t writable:

```bash
GOCACHE=$(pwd)/.cache/go-build go run ./scripts/detect-hardcoded-css.go
```

### Useful flags

| Flag | Description |
| --- | --- |
| `--root PATH` | Override workspace root (defaults to `.`). |
| `--ext ".css,.ts,..."`
 | File extensions to inspect. |
| `--ignore "dir1,dir2"`
 | Directories to skip entirely. |
| `--path-include "substringA,substringB"`
 | Only scan files whose relative path contains any substring. |
| `--path-exclude "substring"`
 | Drop files whose path contains any substring. |
| `--match-types "hex,rgb,hsl,gradient,named"`
 | Limit matches to specific literal kinds. |
| `--line-contains "text"`
 | Only emit lines that contain a case-insensitive substring. |
| `--workers N` | Concurrency level (defaults to CPU count). |
| `--summary` | Skip per-line output; only print aggregate counts. |
| `--help-details` | Echo a short description before scanning. |

### Example workflows

1. **Full scan, summary only**

   ```bash
   go run ./scripts/detect-hardcoded-css.go --summary
   ```

2. **Inspect WebUI CSS hex + rgb**

   ```bash
   go run ./scripts/detect-hardcoded-css.go \
     --path-include src/webui \
     --match-types hex,rgb
   ```

3. **Hunt for “palette” strings**

   ```bash
   go run ./scripts/detect-hardcoded-css.go \
     --line-contains palette
   ```

Keep this doc close when iterating on theming so future agents have a repeatable workflow.***
