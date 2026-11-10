#!/usr/bin/env bash
# Captures brutes de l'app sur simulateur, dans raw/<langue>/.
# Usage : EMAIL=demo@… PASSWORD=… HORSE="Tornade" ./capture.sh fr
#         (puis « en » après avoir passé le simulateur en anglais)
# Prérequis : un simulateur iPhone 6,9" démarré (iPhone 16/17 Pro Max) avec
# un build de Horsetrack installé, et Maestro (https://maestro.dev).
set -euo pipefail
LANG_DIR="${1:-fr}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FLOW="$HERE/../../apps/mobile/.maestro/store-screenshots.yaml"
OUT="$HERE/raw/$LANG_DIR"
mkdir -p "$OUT"

# Barre d'état propre, comme sur les visuels d'Apple.
xcrun simctl status_bar booted override --time "9:41" --dataNetwork wifi --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100

# Maestro range les captures dans son dossier de test (…/takeScreenshot/) : on
# le fixe, puis on les recopie dans raw/<langue>/ même si le parcours échoue
# en cours de route (les captures déjà prises restent utilisables).
RUN="$(mktemp -d)"
cd "$OUT"
maestro test "$FLOW" --test-output-dir "$RUN" -e EMAIL="${EMAIL:?EMAIL manquant}" -e PASSWORD="${PASSWORD:?PASSWORD manquant}" -e HORSE="${HORSE:-}" || STATUS=$?
find "$RUN" -path "*takeScreenshot*" -name "*.png" -exec cp {} "$OUT/" \;
rm -rf "$RUN"
xcrun simctl status_bar booted clear
[ -z "${STATUS:-}" ] || { echo "Parcours interrompu (code $STATUS)"; exit "$STATUS"; }
echo "Captures dans $OUT"
ls -1 "$OUT"
