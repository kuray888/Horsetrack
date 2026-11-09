-- Écurie Pro v2, étape 6 (2026-11-08) — à exécuter APRÈS les étapes 1 à 5,
-- dans l'éditeur SQL Supabase (prod). Idempotent. Recopie de rls.sql
-- (section « participation-frais ») : tests/rls/run.sh vérifie qu'elles
-- restent identiques.

create table if not exists public.participation_fees (
  id text primary key,
  "horseId" text not null references public.horses(id) on delete cascade on update cascade,
  "payerUserId" text,
  "payerName" text,
  month text not null,
  amount decimal(10, 2) not null,
  "paidAt" timestamp(3),
  notes text not null default '',
  "createdByUserId" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null
);
create index if not exists "participation_fees_horseId_month_idx" on public.participation_fees ("horseId", month);
create index if not exists "participation_fees_payerUserId_idx" on public.participation_fees ("payerUserId");
grant all on public.participation_fees to authenticated, service_role;

-- >>> participation-frais (Écurie Pro v2, 2026-11-08)
-- Participation aux frais d'une demi-pension, mois par mois : suivi
-- seulement, aucun argent ne transite par l'app. Écrite par le propriétaire
-- et le gérant d'un compte Écurie Pro ; lue par eux, et par chaque payeur
-- pour ses propres lignes.
alter table public.participation_fees enable row level security;

drop policy if exists "participation_fees_select" on public.participation_fees;
create policy "participation_fees_select" on public.participation_fees
  for select using (
    public.horse_can("horseId", 'manage_expenses')
    or ("payerUserId" = auth.uid()::text and public.can_access_horse("horseId"))
  );
drop policy if exists "participation_fees_insert" on public.participation_fees;
create policy "participation_fees_insert" on public.participation_fees
  for insert with check (public.horse_can("horseId", 'manage_expenses') and public.horse_owner_is_pro("horseId"));
drop policy if exists "participation_fees_update" on public.participation_fees;
create policy "participation_fees_update" on public.participation_fees
  for update using (public.horse_can("horseId", 'manage_expenses') and public.horse_owner_is_pro("horseId"))
  with check (public.horse_can("horseId", 'manage_expenses') and public.horse_owner_is_pro("horseId"));
drop policy if exists "participation_fees_delete" on public.participation_fees;
create policy "participation_fees_delete" on public.participation_fees
  for delete using (public.horse_can("horseId", 'manage_expenses') and public.horse_owner_is_pro("horseId"));

drop trigger if exists set_created_by on public.participation_fees;
create trigger set_created_by before insert or update on public.participation_fees
  for each row execute function public.set_created_by();

-- Payeur : quelqu'un de l'équipe ; mois au format AAAA-MM ; montant positif.
create or replace function public.participation_fee_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'participation fee: month must be YYYY-MM';
  end if;
  if new.amount < 0 then
    raise exception 'participation fee: amount must be positive';
  end if;
  if new."payerUserId" is not null and not public.is_horse_member(new."horseId", new."payerUserId") then
    raise exception 'participation fee: payer is not part of this horse''s team';
  end if;
  return new;
end;
$$;

drop trigger if exists participation_fee_rules on public.participation_fees;
create trigger participation_fee_rules
  before insert or update on public.participation_fees
  for each row execute function public.participation_fee_rules();
-- <<< participation-frais
