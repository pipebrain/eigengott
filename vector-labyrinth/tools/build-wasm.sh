#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -n "${WASM_CC:-}" ]; then compiler="$WASM_CC"; elif [ -x /opt/homebrew/opt/llvm/bin/clang ]; then compiler=/opt/homebrew/opt/llvm/bin/clang; else compiler=clang; fi
"$compiler" --target=wasm32 -O3 -nostdlib -fno-builtin src/labyrinth.c \
  -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=67108864 \
  -Wl,--max-memory=67108864 -Wl,--strip-all -o labyrinth.wasm
echo 'Built the separate study: labyrinth.wasm'
