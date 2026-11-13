-- Vérification EN LECTURE SEULE de la base de production (1.3.0). À coller dans
-- le SQL Editor de Supabase. Aucune ligne n'est modifiée. Attendu : « SANS RLS »
-- et « DEFINER sans search_path » vides ; les colonnes/tables 1.3.0 présentes.
select 'SANS RLS: ' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select 'DEFINER sans search_path: ' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'));
select 'DEFINER appelable par anon (hors déclencheurs): ' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
   and pg_get_function_result(p.oid) <> 'trigger';
select '1.3.0 présent: public_rides' where to_regclass('public.public_rides') is not null;
select '1.3.0 présent: ' || table_name || '.' || column_name from information_schema.columns
 where table_schema = 'public' and ((table_name = 'training_sessions' and column_name = 'trace') or (table_name = 'contacts' and column_name = 'address'));
select 'public_rides: RLS=' || relrowsecurity || ', policies=' || (select count(*) from pg_policy where polrelid = c.oid)
  from pg_class c where oid = to_regclass('public.public_rides');
select 'buckets: ' || id || ' public=' || public from storage.buckets;
