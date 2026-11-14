#!/usr/bin/env bash
# Reproduit le lot 1 : voix off locale (Piper), montage, export MP4, contrôles.
# Prérequis : ./setup.sh (une fois), ffmpeg. Durée : quelques minutes.
set -euo pipefail
cd "$(dirname "$0")"
for j in videos/HT-*.json; do
  id=$(basename "$j" .json)
  .venv/bin/python build.py "$j"
  .venv/bin/python verify.py "out/$id/$id.mp4"
done
.venv/bin/python tracking.py
