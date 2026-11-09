-- Écurie Pro v2 — correctif : retirer quelqu'un de l'équipe ne bloque plus le
-- créneau, la tâche ou la participation qui lui était confié.
-- Cause : ces contrôles vérifiaient l'appartenance à l'équipe à CHAQUE
-- modification ; ils ne le font plus qu'à la création ou quand la personne
-- change. Rejouable ; à exécuter après ecurie-pro-v2-7.
create or replace function public.ride_slot_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.weekday < 1 or new.weekday > 7 then
    raise exception 'ride slot: weekday must be 1 (Monday) to 7 (Sunday)';
  end if;
  if new."riderUserId" is not null
     and (tg_op = 'INSERT' or new."riderUserId" is distinct from old."riderUserId")
     and not public.is_horse_member(new."horseId", new."riderUserId") then
    raise exception 'ride slot: rider is not part of this horse''s team';
  end if;
  return new;
end;
$$;

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
  if new."payerUserId" is not null
     and (tg_op = 'INSERT' or new."payerUserId" is distinct from old."payerUserId")
     and not public.is_horse_member(new."horseId", new."payerUserId") then
    raise exception 'participation fee: payer is not part of this horse''s team';
  end if;
  return new;
end;
$$;

create or replace function public.stable_task_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(new.title)) = 0 or length(new.title) > 120 then
    raise exception 'stable task: title must be 1 to 120 characters';
  end if;
  if exists (select 1 from unnest(new.weekdays) d where d < 1 or d > 7) then
    raise exception 'stable task: weekdays must be 1 (Monday) to 7 (Sunday)';
  end if;
  if new."assigneeUserId" is not null
     and (tg_op = 'INSERT' or new."assigneeUserId" is distinct from old."assigneeUserId")
     and not public.is_horse_member(new."horseId", new."assigneeUserId") then
    raise exception 'stable task: assignee is not part of this horse''s team';
  end if;
  return new;
end;
$$;

