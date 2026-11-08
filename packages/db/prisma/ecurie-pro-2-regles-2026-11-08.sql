-- Écurie Pro, étape 2/2 (2026-11-08) — à exécuter APRÈS l'étape 1, dans
-- l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql.
--
-- Le nombre de personnes avec qui un cheval peut être partagé dépend
-- désormais du palier de son propriétaire : 5 en Écurie Pro, 1 sinon.

create or replace function public.horse_collaborator_limit(_horse_id text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (
      select 1
      from public.horses h
      join public.rider_profiles rp on rp.id = h."ownerId"
      where h.id = _horse_id
        and rp."subscriptionTier" = 'PRO'
        and public.rider_is_active_or_trialing(rp.id)
    ) then 5
    else 1
  end;
$$;

-- Comme les autres fonctions des règles RLS (cf. durcissement du 2026-10-28) :
-- réservée aux comptes connectés et à l'API.
revoke execute on function public.horse_collaborator_limit(text) from public, anon;
grant execute on function public.horse_collaborator_limit(text) to authenticated, service_role;

create or replace function public.enforce_horse_collaborator_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('horse_collaborators_quota:' || new."horseId", 0));
  -- Une invitation PENDING expirée (jamais acceptée, jamais renvoyée) ne doit
  -- pas occuper indéfiniment une place de collaborateur — sinon le
  -- propriétaire n'a d'autre recours que de la révoquer à la main avant de
  -- pouvoir en inviter un autre. `expiresAt is null` couvre les lignes créées
  -- avant l'ajout de ce champ (traitées comme non expirantes, cf. schema.prisma).
  if (
    select count(*) from public.horse_collaborators hc2
    where hc2."horseId" = new."horseId"
      and (hc2.status = 'ACCEPTED' or hc2."expiresAt" is null or hc2."expiresAt" > now())
  ) >= public.horse_collaborator_limit(new."horseId") then
    raise exception 'horse % has reached its collaborator limit', new."horseId";
  end if;
  return new;
end;
$$;

drop policy if exists "horse_collaborators_owner_insert" on public.horse_collaborators;
create policy "horse_collaborators_owner_insert" on public.horse_collaborators
  for insert with check (
    public.owns_horse("horseId")
    and public.horse_owner_is_active_or_trialing("horseId")
    -- Même exclusion des invitations PENDING expirées que enforce_horse_collaborator_quota
    -- ci-dessus (le WITH CHECK seul ne suffit pas à fermer la race condition,
    -- d'où le trigger, mais doit rester cohérent avec lui).
    and (
      select count(*) from public.horse_collaborators hc2
      where hc2."horseId" = "horseId"
        and (hc2.status = 'ACCEPTED' or hc2."expiresAt" is null or hc2."expiresAt" > now())
    ) < public.horse_collaborator_limit("horseId")
  );

-- Voir enforce_horse_collaborator_quota ci-dessus : même fermeture de race
-- condition que enforce_horse_quota, pour la limite de collaborateurs par cheval.
drop trigger if exists enforce_horse_collaborator_quota on public.horse_collaborators;
create trigger enforce_horse_collaborator_quota
  before insert on public.horse_collaborators
  for each row execute function public.enforce_horse_collaborator_quota();

-- Vérification : 1 pour un cheval dont le propriétaire n'est pas en Pro.
-- select public.horse_collaborator_limit('<id d''un cheval>');
