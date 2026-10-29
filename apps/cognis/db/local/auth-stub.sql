-- Somente para desenvolvimento/testes SEM Supabase.
-- Reproduz o mínimo do ambiente Supabase (schema auth, auth.uid(), papéis)
-- para que a mesma migração e as mesmas políticas RLS rodem em Postgres puro.
-- NUNCA execute este arquivo em um projeto Supabase.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Mesma semântica do auth.uid() do Supabase.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
-- O Supabase concede privilégios amplos por padrão e confia no RLS; reproduzimos isso.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Credenciais e sessões do modo de autenticação local.
create schema if not exists local_auth;
revoke all on schema local_auth from public, anon, authenticated;

create table if not exists local_auth.credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists local_auth.sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on local_auth.sessions (user_id);
