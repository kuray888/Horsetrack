-- Codes promo v2 du 2026-10-26 — à exécuter UNE fois dans l'éditeur SQL
-- Supabase (prod), après relecture, AVANT de déployer l'API qui lit ces
-- colonnes. Idempotent (if not exists / duplicate_object ignoré). Purement
-- additif : aucune ligne existante n'est modifiée, chaque nouvelle colonne a
-- une valeur par défaut qui reproduit le comportement d'origine (code
-- « jours de Premium », ouvert à tous). Équivalent de schema.prisma.
--
-- RLS : inchangée — promo_codes / promo_code_redemptions restent sans aucune
-- policy (cf. rls.sql), donc inaccessibles depuis l'app ; seuls l'API
-- (/api/promo/redeem, webhook RevenueCat) et l'admin (/admin) y accèdent, via
-- la connexion Prisma directe.

do $$ begin
  create type public.promo_kind as enum ('PREMIUM_DAYS', 'STORE_OFFER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.promo_discount_type as enum ('PERCENT', 'AMOUNT', 'FREE_PERIOD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.promo_eligibility as enum ('ANYONE', 'NEVER_SUBSCRIBED', 'LAPSED_SUBSCRIBERS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.promo_redemption_status as enum ('APPLIED', 'ALREADY_PREMIUM', 'STORE_REDIRECTED', 'CONVERTED');
exception when duplicate_object then null; end $$;

alter table public.promo_codes
  add column if not exists "kind" public.promo_kind not null default 'PREMIUM_DAYS',
  add column if not exists "storeOfferCode" text,
  add column if not exists "discountType" public.promo_discount_type,
  add column if not exists "discountValue" integer,
  add column if not exists "startsAt" timestamp(3),
  add column if not exists "eligibility" public.promo_eligibility not null default 'ANYONE',
  add column if not exists "maxAccountAgeDays" integer,
  add column if not exists "campaign" text;

alter table public.promo_codes alter column "premiumDays" set default 0;

alter table public.promo_code_redemptions
  add column if not exists "status" public.promo_redemption_status not null default 'APPLIED',
  add column if not exists "convertedAt" timestamp(3);

-- Webhook RevenueCat : retrouve un code à partir de l'offer_code Apple.
create index if not exists promo_codes_store_offer_code_idx on public.promo_codes (upper("storeOfferCode"));
