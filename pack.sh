#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$source_dir/dist"
gnome-extensions pack "$source_dir" --force --out-dir="$source_dir/dist" --extra-source=LICENSE
