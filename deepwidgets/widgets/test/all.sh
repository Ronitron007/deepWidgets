#!/bin/sh
# Run every host check once. Usage: sh all.sh <notes-dir>   (ports 47971-47977; exit 0 = all pass)
N=${1:?notes dir}
T=$(cd "$(dirname "$0")" && pwd)
M="$T/../../mcp/test"
rm -rf "$N"/home-all-*
fail=0
run() { name=$1; shift; WIDGETS_NOTES="$N/" "$@" > "$N/all-$name.txt" 2>&1; code=$?; echo "$name exit=$code $(tail -1 "$N/all-$name.txt")"; [ $code -eq 0 ] || fail=1; }
run run        node "$T/run.mjs" 47973 "$N/home-all-run"
run restart    node "$T/restart.mjs" 47974 "$N/home-all-restart"
run quarantine node "$T/quarantine.mjs" 47975 "$N/home-all-q"
run contract   node "$M/contract.mjs" 47972 "$N/home-all-contract"
exit $fail
