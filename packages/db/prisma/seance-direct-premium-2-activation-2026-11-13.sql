-- Séance en direct Premium (1.3.0) — ÉTAPE 2 : à exécuter LE JOUR où la 1.3.0
-- est publiée (après l'étape 1). Rejouable.
-- Les comptes déjà inscrits gardent "liveRideFree" = vrai (posé par l'étape 1)
-- et donc la séance en direct gratuite. Les comptes créés à partir de
-- maintenant ont faux : leur première séance en direct est offerte, les
-- suivantes demandent Premium (règle ci-dessous, et rides/liveRideAccess.ts
-- dans l'app).

alter table public.rider_profiles alter column "liveRideFree" set default false;

-- >>> protection-entitlements
create or replace function public.protect_rider_profile_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() n'est non-null que pour une requête passée par l'API Supabase
  -- (rôle authenticated, gouverné par RLS) — jamais pour la connexion directe
  -- DATABASE_URL/Prisma du backend, seule habilitée à modifier ces champs.
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      new."subscriptionTier" := old."subscriptionTier";
      new."subscriptionStatus" := old."subscriptionStatus";
      new."trialEndsAt" := old."trialEndsAt";
      new."extraHorseSlots" := old."extraHorseSlots";
      new."revenuecatId" := old."revenuecatId";
      new."lastWebhookEventAt" := old."lastWebhookEventAt";
      new."liveRideFree" := old."liveRideFree";
    elsif tg_op = 'INSERT' then
      new."subscriptionTier" := 'FREE';
      new."subscriptionStatus" := 'EXPIRED';
      new."trialEndsAt" := null;
      new."extraHorseSlots" := 0;
      new."revenuecatId" := null;
      new."lastWebhookEventAt" := null;
      -- Nouveau compte : séance en direct Premium (la première offerte).
      new."liveRideFree" := false;
    end if;
  end if;
  return new;
end;
$$;
-- <<< protection-entitlements

-- >>> seance-direct-premium
-- Placé en fin de fichier : remplace la règle d'insertion posée dans la
-- section droits-par-role (déjà recopiée en production, à ne pas modifier).
-- Séance en direct (1.3.0, décision du 2026-11-13) : Premium pour les comptes
-- créés après la 1.3.0, la première offerte. Les comptes d'avant
-- (rider_profiles."liveRideFree") gardent tout ; une séance déjà enregistrée
-- se modifie toujours (seule la création d'un parcours est contrôlée).
create or replace function public.horse_owner_can_live_ride(_horse_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.horses h
    join public.rider_profiles rp on rp.id = h."ownerId"
    where h.id = _horse_id
      and (
        public.rider_is_active_or_trialing(h."ownerId")
        or rp."liveRideFree"
        or not exists (
          select 1 from public.training_session_rides r
          join public.horses h2 on h2.id = r."horseId"
          where h2."ownerId" = h."ownerId"
        )
      )
  );
$$;

revoke execute on function public.horse_owner_can_live_ride(text) from public, anon;
grant execute on function public.horse_owner_can_live_ride(text) to authenticated, service_role;

drop policy if exists "training_session_rides_insert_shared" on public.training_session_rides;
create policy "training_session_rides_insert_shared" on public.training_session_rides
  for insert with check (public.can_write_session_ride("sessionId") and public.horse_owner_can_live_ride("horseId"));
-- <<< seance-direct-premium
