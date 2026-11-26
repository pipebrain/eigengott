#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
engine_root=$(pwd)
if [ -n "${ENGINE_RUSTC:-}" ]; then
  compiler="$ENGINE_RUSTC"
elif command -v rustc >/dev/null 2>&1; then
  compiler=rustc
elif [ -x ../.local/rust/cargo/bin/rustc ]; then
  compiler="$engine_root/../.local/rust/cargo/bin/rustc"
  export RUSTUP_HOME="$engine_root/../.local/rust/rustup"
  export CARGO_HOME="$engine_root/../.local/rust/cargo"
else
  echo 'Rust is required. Install rustup and the wasm32-unknown-unknown target.' >&2
  exit 1
fi
"$compiler" --edition=2021 --crate-type=cdylib --target=wasm32-unknown-unknown \
  -C opt-level=3 -C lto=fat -C codegen-units=1 -C panic=abort -C strip=symbols \
  -C link-arg=--export-memory -C link-arg=--export=__heap_base -C link-arg=--stack-first -C link-arg=-zstack-size=262144 \
  -C link-arg=--initial-memory=4194304 -C link-arg=--max-memory=4194304 \
  src/lib.rs -o fold.wasm
