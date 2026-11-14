#!/usr/bin/env bash
# Installe Piper (synthèse vocale locale) et la voix française siwis. À lancer une fois.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/pip install -q piper-tts pillow numpy
mkdir -p models
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium
[ -f models/fr_FR-siwis-medium.onnx ] || curl -sL -o models/fr_FR-siwis-medium.onnx $B/fr_FR-siwis-medium.onnx
[ -f models/fr_FR-siwis-medium.onnx.json ] || curl -sL -o models/fr_FR-siwis-medium.onnx.json $B/fr_FR-siwis-medium.onnx.json
echo OK
