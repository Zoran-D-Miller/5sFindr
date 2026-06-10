-- ════════════════════════════════════════════════════════════════════════
--  TEST-ONLY shim. NOT a migration.
--  Emulates the parts of the Supabase platform our migrations depend on
--  (auth schema, auth.users, auth.uid(), the anon/authenticated roles) so the
--  economy tests can run on a plain local Postgres with no Docker / no stack.
--  On real Supabase these already exist and this file is never used.
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon')           then create role anon nologin;           end if;
  if not exists (select from pg_roles where rolname = 'authenticated')  then create role authenticated nologin;  end if;
  if not exists (select from pg_roles where rolname = 'service_role')   then create role service_role nologin;   end if;
end $$;

create schema if not exists auth;

-- Minimal auth.users — only the columns our trigger/functions read, all of
-- which also exist on the real Supabase auth.users.
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                varchar(255),
  role               varchar(255),
  email              varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz default now(),
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- auth.uid() resolves the impersonated user from the request.jwt.claims GUC,
-- exactly like Supabase. Tests set this with set_config(...).
create or replace function auth.uid()
returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
