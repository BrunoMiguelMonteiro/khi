#!/usr/bin/env bash
# Builds khi-mcp in release mode and stages it as a Tauri sidecar
# (bundle.externalBin) at src-tauri/binaries/khi-mcp-<target-triple>.
# Run from the repo root. Releases are Apple Silicon only.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

TRIPLE="aarch64-apple-darwin"
MANIFEST="src-tauri/Cargo.toml"
SRC="src-tauri/target/release/khi-mcp"
DEST_DIR="src-tauri/binaries"
DEST="$DEST_DIR/khi-mcp-$TRIPLE"

echo "==> cargo build --release -p khi-mcp"
cargo build --release -p khi-mcp --manifest-path "$MANIFEST"

echo "==> checking khi-mcp dependency tree"
# Crate names only: paths contain "src-tauri", so match the first column.
FORBIDDEN='^(tauri[A-Za-z0-9_-]*|wry|tao|reqwest|hyper[A-Za-z0-9_-]*)$'
TREE="$(cargo tree -p khi-mcp -e normal --prefix none --manifest-path "$MANIFEST")"
BAD="$(printf '%s\n' "$TREE" | awk '{print $1}' | sort -u | grep -E "$FORBIDDEN" || true)"
if [ -n "$BAD" ]; then
  echo "error: khi-mcp must not depend on these crates:" >&2
  printf '  %s\n' $BAD >&2
  exit 1
fi
echo "    ok: no tauri*, wry, tao, reqwest or hyper* in the tree"

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"
chmod +x "$DEST"
echo "==> copied $SRC -> $DEST ($(du -h "$DEST" | cut -f1))"
