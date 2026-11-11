#!/usr/bin/env bash
# Contrôle de ce qui est EN LIGNE avant une soumission App Store.
#   tools/check-prod.sh [adresse-api]      (défaut : l'API de production)
# Échoue (code 1) si une route attendue manque, si les en-têtes de sécurité ou
# les pages légales ne sont pas là, ou si Écurie Pro apparaît en public.
set -u
API="${1:-https://api-mu-tan-94.vercel.app}"
SITE="${SITE:-https://horsetrack.fr}"
fail=0
ok()  { printf "  ok    %s\n" "$1"; }
bad() { printf "  ÉCHEC %s\n" "$1"; fail=1; }

code() { curl -s -o /dev/null -w "%{http_code}" -m 20 "$@"; }

echo "Routes de l'API (le code attendu prouve que la route existe et exige une connexion)"
check() { # méthode chemin code-attendu
  local got; got=$(code -X "$1" "$API$2")
  [ "$got" = "$3" ] && ok "$1 $2 → $got" || bad "$1 $2 → $got (attendu $3)"
}
check GET  /api/coach/status 401
check POST /api/coach/question 401
check POST /api/coach/suggestion 401
check POST /api/coach/summary 401
check POST /api/planning/notify 401
check POST /api/ride-safety 401
check POST /api/subscription/sync 401
check POST /api/promo/redeem 401
check POST /api/push/register 401
check POST /api/horse-invites 401
check POST /api/revenuecat/webhook 401
check GET  /api/cron/email-reminders 401
check GET  /admin 401

echo "Pages publiques (adresses saisies dans App Store Connect)"
for p in /cgu /confidentialite /support /suppression-compte; do
  got=$(code "$API$p"); [ "$got" = "200" ] && ok "$p → 200" || bad "$p → $got"
done

echo "En-têtes de sécurité"
h=$(curl -sI -m 20 "$API/cgu" | tr 'A-Z' 'a-z')
for k in "x-frame-options" "referrer-policy" "x-content-type-options" "strict-transport-security"; do
  echo "$h" | grep -q "^$k" && ok "$k" || bad "$k absent (API pas à jour ?)"
done

echo "Écurie Pro invisible en public (en pause)"
for u in "$API/cgu" "$API/confidentialite" "$API/support" "$SITE"; do
  n=$(curl -s -m 20 "$u" | grep -ciE "[ée]curie pro")
  [ "$n" = "0" ] && ok "$u" || bad "$u mentionne Écurie Pro ($n)"
done

echo "Version de l'app"
v=$(python3 -c "import json;print(json.load(open('apps/mobile/app.json'))['expo']['version'])" 2>/dev/null || true)
echo "  app.json : $v (App Store Connect doit s'appeler exactement pareil)"

[ "$fail" = "0" ] && echo "TOUT EST EN LIGNE." || echo "À CORRIGER AVANT DE SOUMETTRE."
exit "$fail"
