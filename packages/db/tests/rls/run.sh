#!/usr/bin/env bash
# Tests des règles RLS sur un Postgres local jetable.
#   pnpm --filter @cheval/db test:rls
# Variables : PGHOST (défaut /tmp), RLS_TEST_DB (défaut horsetrack_rls_test).
# Crée la base, charge la doublure Supabase, le schéma Prisma, rls.sql puis
# chaque fichier *.test.sql ; échoue si une assertion échoue.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PRISMA_DIR="$HERE/../../prisma"
DB="${RLS_TEST_DB:-horsetrack_rls_test}"
export PGHOST="${PGHOST:-/tmp}"
export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X -d "$DB")

# Les migrations de prod recopient des sections de rls.sql : elles doivent
# rester identiques.
section() { sed -n "/^-- >>> $2/,/^-- <<< $2/p" "$1"; }
for pair in "droits-par-role:ecurie-pro-v2-2-droits-2026-11-08.sql" "planning-seances:ecurie-pro-v2-3-seances-2026-11-08.sql" "creneaux:ecurie-pro-v2-4-creneaux-2026-11-08.sql"; do
  name="${pair%%:*}"; file="${pair#*:}"
  if ! diff <(section "$PRISMA_DIR/rls.sql" "$name") <(section "$PRISMA_DIR/$file" "$name") >/dev/null; then
    echo "$file ne recopie plus rls.sql (section $name)"; exit 1
  fi
done

dropdb --if-exists "$DB" >/dev/null
createdb "$DB"

"${PSQL[@]}" -f "$HERE/supabase-stub.sql" >/dev/null
(cd "$HERE/../.." && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null) \
  | "${PSQL[@]}" >/dev/null
# Droits par défaut de Supabase sur le schéma public.
"${PSQL[@]}" -c "grant usage on schema public to anon, authenticated, service_role;
  grant all on all tables in schema public to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;" >/dev/null
"${PSQL[@]}" -f "$PRISMA_DIR/rls.sql" >/dev/null 2>&1 || "${PSQL[@]}" -f "$PRISMA_DIR/rls.sql"
"${PSQL[@]}" -f "$HERE/helpers.sql" >/dev/null

status=0
for f in "$HERE"/*.test.sql; do
  # Chaque fichier part d'une base vide (les comptes entraînent tout le reste).
  "${PSQL[@]}" -c "truncate t.results; truncate auth.users, public.users cascade" >/dev/null
  "${PSQL[@]}" -f "$f" >/dev/null
  failed=$("${PSQL[@]}" -At -c "select count(*) from t.results where not ok")
  total=$("${PSQL[@]}" -At -c "select count(*) from t.results")
  echo "$(basename "$f") : $((total - failed))/$total"
  if [ "$failed" != "0" ]; then
    "${PSQL[@]}" -At -F ' — ' -c "select '  ÉCHEC', label, coalesce(detail, '') from t.results where not ok order by n"
    status=1
  fi
done

dropdb "$DB"
exit $status
