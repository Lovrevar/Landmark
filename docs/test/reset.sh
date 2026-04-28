#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<EOF >&2
Usage: $(basename "$0") <NN> | -a

  NN   Two-digit file number 01-10 (e.g. 03 resets 03-sales.md)
  -a   Reset every NN-*.md file in $SCRIPT_DIR

Resets end-of-line status markers: (+), (-), (~), (N/A) -> ( ).
EOF
  exit 1
}

reset_file() {
  local file="$1"
  local before after
  before=$(grep -cE '\((\+|-|~|N/A)\)[[:space:]]*$' "$file" || true)
  sed -i -E 's/\((\+|-|~|N\/A)\)[[:space:]]*$/( )/' "$file"
  after=$(grep -cE '\((\+|-|~|N/A)\)[[:space:]]*$' "$file" || true)
  echo "Reset $(basename "$file"): $((before - after)) markers cleared"
}

[[ $# -eq 1 ]] || usage

shopt -s nullglob

if [[ "$1" == "-a" ]]; then
  files=("$SCRIPT_DIR"/[0-9][0-9]-*.md)
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No NN-*.md files found in $SCRIPT_DIR" >&2
    exit 1
  fi
  for f in "${files[@]}"; do
    reset_file "$f"
  done
elif [[ "$1" =~ ^[0-9]{2}$ ]]; then
  matches=("$SCRIPT_DIR"/"$1"-*.md)
  if [[ ${#matches[@]} -eq 0 ]]; then
    echo "No file matching $1-*.md in $SCRIPT_DIR" >&2
    exit 1
  fi
  reset_file "${matches[0]}"
else
  usage
fi
