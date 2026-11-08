-- Outils des tests RLS : se mettre dans la peau d'un compte, vérifier qu'une
-- requête passe ou qu'elle est refusée.

create schema if not exists t;
grant usage on schema t to authenticated;

-- Crée un compte (auth.users → trigger handle_new_user) et son profil.
create or replace function t.add_user(_id uuid, _email text, _tier text default 'FREE', _status text default 'EXPIRED')
returns text language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data) values (_id, _email, '{}');
  insert into public.rider_profiles (id, "userId", "subscriptionTier", "subscriptionStatus", "updatedAt")
    values ('rp_' || _id, _id::text, _tier::public.subscription_tier, _status::public.subscription_status, now())
    on conflict ("userId") do update set "subscriptionTier" = excluded."subscriptionTier",
      "subscriptionStatus" = excluded."subscriptionStatus";
  return 'rp_' || _id;
end $$;

-- Passe la session courante sous l'identité d'un compte connecté.
create or replace function t.login(_id uuid, _email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _id, 'email', _email, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function t.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

create table if not exists t.results (n serial, ok boolean, label text, detail text);
grant all on t.results to authenticated;
grant usage on sequence t.results_n_seq to authenticated;

-- La requête doit réussir ET toucher au moins une ligne (les refus RLS sur
-- update/delete ne lèvent pas d'erreur : ils ne touchent rien).
create or replace function t.allowed(_label text, _sql text) returns void language plpgsql as $$
declare n integer;
begin
  execute _sql;
  get diagnostics n = row_count;
  insert into t.results (ok, label, detail) values (n > 0, _label, case when n > 0 then null else '0 ligne touchée' end);
exception when others then
  insert into t.results (ok, label, detail) values (false, _label, sqlerrm);
end $$;

-- La requête doit échouer OU ne toucher aucune ligne.
create or replace function t.denied(_label text, _sql text) returns void language plpgsql as $$
declare n integer;
begin
  execute _sql;
  get diagnostics n = row_count;
  insert into t.results (ok, label, detail) values (n = 0, _label, case when n = 0 then null else n || ' ligne(s) touchée(s)' end);
exception when others then
  insert into t.results (ok, label, detail) values (true, _label, null);
end $$;

-- Nombre de lignes visibles.
create or replace function t.sees(_label text, _sql text, _expected integer) returns void language plpgsql as $$
declare n integer;
begin
  execute 'select count(*) from (' || _sql || ') q' into n;
  insert into t.results (ok, label, detail) values (n = _expected, _label, case when n = _expected then null else 'vu ' || n || ', attendu ' || _expected end);
exception when others then
  insert into t.results (ok, label, detail) values (false, _label, sqlerrm);
end $$;

grant execute on all functions in schema t to authenticated;
