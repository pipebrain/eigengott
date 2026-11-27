#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
repository_root=$(cd .. && pwd)
if [ -n "${ENGINE_RUSTC:-}" ]; then
 compiler="$ENGINE_RUSTC"
elif command -v rustc >/dev/null 2>&1; then
 compiler=rustc
else
 compiler="$repository_root/.local/rust/cargo/bin/rustc"
 export RUSTUP_HOME="$repository_root/.local/rust/rustup"
 export CARGO_HOME="$repository_root/.local/rust/cargo"
fi
"$compiler" --edition=2021 --crate-type=cdylib --target=wasm32-unknown-unknown \
 -A dead_code -C opt-level=3 -C lto=fat -C codegen-units=1 -C panic=abort -C strip=symbols \
 -C link-arg=--export-memory -C link-arg=--export=__heap_base -C link-arg=--stack-first -C link-arg=-zstack-size=262144 \
 -C link-arg=--initial-memory=33554432 -C link-arg=--max-memory=33554432 engine/src/lib.rs -o engine/blockout.wasm
