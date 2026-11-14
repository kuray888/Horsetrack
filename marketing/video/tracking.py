#!/usr/bin/env python3
"""Génère suivi.csv : une ligne par vidéo (id, angle, accroche, durée, lien de suivi à compléter)."""
import csv, json
from pathlib import Path
R = Path(__file__).resolve().parent
rows = []
for j in sorted((R / "videos").glob("HT-*.json")):
    c = json.loads(j.read_text()); t = json.loads((R / "out" / c["id"] / "timeline.json").read_text())
    rows.append([c["id"], c["angle"], c["accroches_candidates"][c["accroche_choisie"]], round(t["total"], 1), f"utm_campaign={c['id']}", "", "", "", ""])
with open(R / "suivi.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id", "angle", "accroche", "duree_s", "lien_bio_utm", "date_publication", "vues", "retention_3s", "clics_bio"]); w.writerows(rows)
print("suivi.csv :", len(rows), "vidéos")
