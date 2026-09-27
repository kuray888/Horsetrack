-- Comptes testeurs marqués CANCELLED par l'ancien webhook RevenueCat (avant le
-- correctif : une résiliation retirait Premium tout de suite). À exécuter dans
-- l'éditeur SQL Supabase (prod), étape par étape, après relecture.

-- 1. Voir les comptes concernés ------------------------------------------------
select u.email, rp."subscriptionTier", rp."subscriptionStatus", rp."trialEndsAt",
       rp."billingPeriod", rp."updatedAt"
from public.rider_profiles rp
join public.users u on u.id = rp."userId"
where rp."subscriptionStatus" = 'CANCELLED'
order by rp."updatedAt" desc;

-- 2. Les repasser en TRIALING (essai en cours) ou ACTIVE (abonnement payé) -----
-- Vérifie d'abord dans RevenueCat que leur accès n'est pas réellement terminé.
-- Pour ne traiter que certains comptes, décommente le filtre sur les emails.
update public.rider_profiles rp
set "subscriptionStatus" = case
      when rp."trialEndsAt" is not null and rp."trialEndsAt" > now() then 'TRIALING'::public.subscription_status
      else 'ACTIVE'::public.subscription_status
    end,
    "updatedAt" = now()
where rp."subscriptionStatus" = 'CANCELLED'
  and rp."subscriptionTier" <> 'FREE'
  -- and rp."userId" in (select id from public.users where email in ('testeur1@exemple.com', 'testeur2@exemple.com'))
returning rp."userId", rp."subscriptionStatus", rp."trialEndsAt";
