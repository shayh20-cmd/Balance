-- Test-only stand-in for the parts of Supabase's auth schema the migrations use.
-- Never deployed: it lives outside supabase/migrations.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt()->>'sub', '')::uuid
$$;
grant usage on schema public, auth to authenticated, anon;
grant execute on all functions in schema auth to authenticated, anon;
-- Like Supabase: both API roles get table and function privileges by default; RLS decides the rows.
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant execute on functions to authenticated, anon;
