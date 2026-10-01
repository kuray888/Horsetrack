-- Correction des 6 dates abîmées par le bug de fuseau horaire (cf.
-- diagnostic-dates-decalees-2026-10-02.sql et apps/mobile/src/lib/serverDate.ts).
--
-- À lancer UNE fois dans l'éditeur SQL Supabase (prod), APRÈS la publication
-- de la version corrigée de l'app : une ancienne version relit encore ces
-- dates avec 2 h de retard et pourrait renvoyer la valeur décalée.
--
-- Ne touche que ces 6 lignes (3 comptes à l'heure de Paris, modifiées après
-- le 26/09, date à laquelle l'app s'est mise à relire le serveur à chaque
-- lancement), et seulement si elles ont encore la valeur constatée au
-- diagnostic : une ligne modifiée depuis est laissée telle quelle.
--
-- Volontairement EXCLUS, car justes : les comptes dont le téléphone n'est pas
-- à l'heure de Paris (aucune de leurs dates à minuit de Paris) — UTC+4
-- (Réunion, Maurice : 22:00 vu de Paris), UTC−4 (Antilles, Québec : 06:00),
-- UTC+0 (02:00).
--
-- Chaque date est ramenée à minuit (heure de Paris) du lendemain du jour
-- affiché, c'est-à-dire au jour choisi par l'utilisateur. Le résultat final
-- affiche les 6 lignes après correction.

begin;

update training_sessions t
set date = ((((t.date at time zone 'UTC') at time zone 'Europe/Paris')::date + 1)::timestamp
             at time zone 'Europe/Paris') at time zone 'UTC',
    "updatedAt" = now() at time zone 'UTC'
from (values
  ('smum6s21g2sgwds', timestamp '2026-09-27 20:00'),  -- affichée 27/09 22:00 → 28/09
  ('smukx8fvl43z3bh', timestamp '2026-09-26 20:00'),  -- affichée 26/09 22:00 → 27/09
  ('smukx95io51ussq', timestamp '2026-09-28 20:00'),  -- affichée 28/09 22:00 → 29/09
  ('smupydod05dbmh3', timestamp '2026-09-29 20:00'),  -- affichée 29/09 22:00 → 30/09
  ('smula1tyh0s75wb', timestamp '2026-09-29 20:00')   -- affichée 29/09 22:00 → 30/09
) as v(id, constatee)
where t.id = v.id and t.date = v.constatee;

update documents d
set date = ((((d.date at time zone 'UTC') at time zone 'Europe/Paris')::date + 1)::timestamp
             at time zone 'Europe/Paris') at time zone 'UTC',
    "updatedAt" = now() at time zone 'UTC'
where d.id = 'dmtsr76bz95jz49' and d.date = timestamp '2026-08-22 16:00';  -- affichée 22/08 18:00 → 23/08

commit;

select 'Séance' as element, id,
       to_char((date at time zone 'UTC') at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as date_heure_de_paris
from training_sessions
where id in ('smum6s21g2sgwds', 'smukx8fvl43z3bh', 'smukx95io51ussq', 'smupydod05dbmh3', 'smula1tyh0s75wb')
union all
select 'Document', id, to_char((date at time zone 'UTC') at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI')
from documents
where id = 'dmtsr76bz95jz49'
order by element, date_heure_de_paris;
