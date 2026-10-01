-- Diagnostic des dates décalées — LECTURE SEULE (uniquement des SELECT :
-- rien n'est modifié). À lancer dans l'éditeur SQL Supabase (prod).
--
-- Contexte (corrigé le 2026-10-02, cf. apps/mobile/src/lib/serverDate.ts) :
-- l'app relisait les dates du serveur en heure locale au lieu de l'UTC, donc
-- avec 2 h de retard (1 h en hiver). Tant que l'élément n'était pas renvoyé,
-- le serveur gardait la bonne valeur : la nouvelle version répare seule ces
-- cas au lancement. Mais un élément modifié APRÈS ce décalage (séance cochée
-- « faite », checklist de concours cochée, résultat saisi…) a renvoyé la date
-- décalée au serveur : c'est ce que cette requête recherche.
--
-- Comment on les reconnaît : un jour choisi dans le calendrier de l'app est
-- toujours minuit (heure de Paris). Décalé, il devient la veille à 22:00 ou
-- 23:00 tout rond (20:00, 21:00… s'il a été décalé plusieurs fois). Une date
-- saisie « maintenant » a des minutes, secondes et millisecondes quelconques
-- et n'est pas concernée (décalée de 2 h, elle reste en général le même jour).
--
-- Verdicts :
--   OK (minuit)             date choisie au calendrier, intacte ;
--   OK (heure de saisie)    date « maintenant » : rien à faire ;
--   À CORRIGER              heure ronde de l'après-midi/soir : le jour voulu est
--                           le lendemain (colonne jour_probablement_choisi) ;
--   À VÉRIFIER              heure ronde du matin : cas inattendu, à regarder.
--
-- Hypothèse : téléphones réglés sur l'heure de Paris. Un utilisateur dans un
-- autre fuseau (Antilles, Réunion…) peut apparaître « À CORRIGER » à tort.
--
-- Deux requêtes : copier la 1re SEULE, la lancer ; puis la 2de si besoin.
-- Aucune n'affiche d'e-mail : les comptes sont désignés par un code anonyme.


-- ═══ 1. RÉSUMÉ ═════════════════════════════════════════════════════════════
with dates as (
  select 'Séance' as element, 'date' as champ, s.id, s."horseId" as horse_id, null::text as rider_id,
         coalesce(s."customActivityLabel", s."activityType"::text) as libelle, s.date as stockee, s."updatedAt" as modifie_le
  from training_sessions s
  union all
  select 'Rendez-vous / concours', 'date', a.id, a."horseId", null, a.title, a.date, a."updatedAt"
  from appointments a
  union all
  -- Lu via to_jsonb : fonctionne même si la colonne n'a pas encore été créée
  -- (cf. appointments-concours-2026-09-26.sql).
  select 'Rendez-vous / concours', 'dernier jour', a.id, a."horseId", null, a.title,
         (to_jsonb(a) ->> 'endDate')::timestamp, a."updatedAt"
  from appointments a
  union all
  select 'Rendez-vous / concours', 'prochaine échéance', a.id, a."horseId", null, a.title,
         (to_jsonb(a) ->> 'nextDueDate')::timestamp, a."updatedAt"
  from appointments a
  union all
  select 'Journal', 'date', j.id, j."horseId", null, left(j.notes, 40), j.date, j."updatedAt"
  from journal_entries j
  union all
  select 'Dépense', 'date', e.id, e."horseId", null, e.category::text || ' ' || e.amount::text, e.date, e."updatedAt"
  from expenses e
  union all
  select 'Pesée', 'date', w.id, w."horseId", null, w."weightKg"::text || ' kg', w.date, w."updatedAt"
  from horse_weight_measurements w
  union all
  select 'Document', 'date', d.id, d."horseId", d."riderId", d.name, d.date, d."updatedAt"
  from documents d
  union all
  select 'Objectif', 'date cible', g.id, g."horseId", g."riderId", g.title, g."targetDate", g."updatedAt"
  from goals g
  union all
  select 'Blessure', 'date', i.id, i."horseId", null, i.type, i."occurredAt", i."updatedAt"
  from horse_injuries i
),
diagnostic as (
  select d.*,
         case
           when p.heure_paris::time = time '00:00' then 'OK (minuit)'
           when date_trunc('hour', p.heure_paris) = p.heure_paris and extract(hour from p.heure_paris) >= 12 then 'À CORRIGER'
           when date_trunc('hour', p.heure_paris) = p.heure_paris then 'À VÉRIFIER'
           else 'OK (heure de saisie)'
         end as verdict
  from dates d
  cross join lateral (select (d.stockee at time zone 'UTC') at time zone 'Europe/Paris' as heure_paris) p
  where d.stockee is not null
)
select coalesce(d.element, 'TOTAL') as element,
       coalesce(d.champ, '') as champ,
       count(*) as total,
       count(*) filter (where d.verdict = 'À CORRIGER') as a_corriger,
       count(*) filter (where d.verdict = 'À VÉRIFIER') as a_verifier,
       count(*) filter (where d.verdict like 'OK%') as ok,
       count(distinct coalesce(h."ownerId", d.rider_id)) filter (where d.verdict in ('À CORRIGER', 'À VÉRIFIER')) as comptes_touches
from diagnostic d
left join horses h on h.id = d.horse_id
group by grouping sets ((d.element, d.champ), ())
order by (d.element is null), a_corriger desc, d.element, d.champ;


-- ═══ 2. DÉTAIL des éléments À CORRIGER / À VÉRIFIER ═════════════════════════
-- Sans e-mail : chaque compte est désigné par un code anonyme. Les colonnes
-- servent à départager les causes possibles d'une heure ronde :
--   dates_minuit_du_compte  beaucoup → le téléphone est à l'heure de Paris ;
--                           aucune   → probablement un autre fuseau horaire ;
--   heure_de_la_seance      égale à l'heure affichée → ancienne version qui
--                           mettait l'heure dans la date (pas le bug) ;
--   cree_le / modifie_le    modifiée après création → renvoyée par l'app.
with dates as (
  select 'Séance' as element, 'date' as champ, s.id, s."horseId" as horse_id, null::text as rider_id,
         s.date as stockee, s.time as heure_saisie, s."createdAt" as cree_le, s."updatedAt" as modifie_le
  from training_sessions s
  union all
  select 'Rendez-vous / concours', 'date', a.id, a."horseId", null, a.date, a.time, a."createdAt", a."updatedAt"
  from appointments a
  union all
  select 'Rendez-vous / concours', 'dernier jour', a.id, a."horseId", null,
         (to_jsonb(a) ->> 'endDate')::timestamp, a.time, a."createdAt", a."updatedAt"
  from appointments a
  union all
  select 'Rendez-vous / concours', 'prochaine échéance', a.id, a."horseId", null,
         (to_jsonb(a) ->> 'nextDueDate')::timestamp, a.time, a."createdAt", a."updatedAt"
  from appointments a
  union all
  select 'Journal', 'date', j.id, j."horseId", null, j.date, j.time, j."createdAt", j."updatedAt"
  from journal_entries j
  union all
  select 'Dépense', 'date', e.id, e."horseId", null, e.date, null, e."createdAt", e."updatedAt"
  from expenses e
  union all
  select 'Pesée', 'date', w.id, w."horseId", null, w.date, null, w."createdAt", w."updatedAt"
  from horse_weight_measurements w
  union all
  select 'Document', 'date', d.id, d."horseId", d."riderId", d.date, null, d."createdAt", d."updatedAt"
  from documents d
  union all
  select 'Objectif', 'date cible', g.id, g."horseId", g."riderId", g."targetDate", null, g."createdAt", g."updatedAt"
  from goals g
  union all
  select 'Blessure', 'date', i.id, i."horseId", null, i."occurredAt", null, i."createdAt", i."updatedAt"
  from horse_injuries i
),
diagnostic as (
  select d.*, p.heure_paris,
         left(md5(coalesce(h."ownerId", d.rider_id, '?')), 6) as compte,
         case
           when p.heure_paris::time = time '00:00' then 'OK (minuit)'
           when date_trunc('hour', p.heure_paris) = p.heure_paris and extract(hour from p.heure_paris) >= 12 then 'À CORRIGER'
           when date_trunc('hour', p.heure_paris) = p.heure_paris then 'À VÉRIFIER'
           else 'OK (heure de saisie)'
         end as verdict
  from dates d
  left join horses h on h.id = d.horse_id
  cross join lateral (select (d.stockee at time zone 'UTC') at time zone 'Europe/Paris' as heure_paris) p
  where d.stockee is not null
),
par_compte as (
  select d.*,
         count(*) over (partition by d.compte) as dates_du_compte,
         count(*) filter (where d.verdict = 'OK (minuit)') over (partition by d.compte) as dates_minuit_du_compte
  from diagnostic d
)
select compte,
       dates_du_compte,
       dates_minuit_du_compte,
       element,
       champ,
       verdict,
       to_char(heure_paris, 'DD/MM/YYYY HH24:MI') as affiche_actuellement,
       case when verdict = 'À CORRIGER' then to_char(heure_paris::date + 1, 'DD/MM/YYYY') end as jour_probablement_choisi,
       heure_saisie as heure_de_la_seance,
       to_char(cree_le, 'DD/MM/YYYY HH24:MI') as cree_le_utc,
       to_char(modifie_le, 'DD/MM/YYYY HH24:MI') as modifie_le_utc,
       id
from par_compte
where verdict in ('À CORRIGER', 'À VÉRIFIER')
order by compte, heure_paris, element, champ;
