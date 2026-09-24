-- FILE: supabase/schema.sql — Full database schema for the PIID registration + check-in app.
-- Depends on: a fresh Supabase Postgres project (pgcrypto is pre-installed on Supabase).
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
-- Safe to re-run: every statement is IF NOT EXISTS / idempotent.
-- Spec reference: Section 5 (schema + RLS), Section 9 (duplicate prevention), Section 14A.

-- ===== SECTION: EXTENSIONS =====
create extension if not exists "pgcrypto";  -- provides gen_random_uuid()

-- ===== SECTION: TABLE — REGISTRANTS =====
create table if not exists public.registrants (
  id            uuid primary key default gen_random_uuid(),
  full_name     text        not null,
  firm_company  text        not null,
  profession    text        not null,   -- dropdown value, or the custom "Others" text
  email         text        not null,
  mobile_number text        not null,   -- stored normalised as 09XXXXXXXXX
  city_area     text        not null,
  qr_token      text        not null,   -- HMAC-signed token, NOT a raw UUID (Spec 7)
  email_status  text        not null default 'pending',  -- pending | sent | failed
  created_at    timestamptz not null default now()
);

-- One person, one ticket. This is what makes the friendly
-- "you're already registered" response reliable (Spec 9).
create unique index if not exists registrants_email_key
  on public.registrants (lower(email));

create unique index if not exists registrants_qr_token_key
  on public.registrants (qr_token);

create index if not exists registrants_created_at_idx
  on public.registrants (created_at desc);

-- ===== SECTION: TABLE — SHOWROOM LOGS =====
create table if not exists public.showroom_logs (
  id            uuid primary key default gen_random_uuid(),
  registrant_id uuid        not null references public.registrants (id) on delete cascade,
  showroom_name text        not null,
  scanned_at    timestamptz not null default now()
);

-- THE important constraint: one scan per guest per showroom, enforced by the
-- database rather than by application code, so two admins scanning the same
-- ticket at the same instant still produce exactly one row (Spec 5).
create unique index if not exists showroom_logs_guest_room_key
  on public.showroom_logs (registrant_id, showroom_name);

create index if not exists showroom_logs_room_time_idx
  on public.showroom_logs (showroom_name, scanned_at desc);

-- ===== SECTION: ROW LEVEL SECURITY =====
-- RLS ON + zero policies = no browser key can read or write these tables.
-- All access happens server-side through the service_role key, which bypasses
-- RLS by design. The anon key is used ONLY for Supabase Auth sign-in (Spec 5).
alter table public.registrants   enable row level security;
alter table public.showroom_logs enable row level security;

-- Belt and braces: explicitly revoke table rights from the browser roles.
revoke all on public.registrants   from anon, authenticated;
revoke all on public.showroom_logs from anon, authenticated;

-- ===== SECTION: OPERATIONS VIEW (organiser convenience) =====
-- Read this in the SQL editor during the event for a live floor picture.
create or replace view public.showroom_attendance as
select
  r.id,
  r.full_name,
  r.firm_company,
  r.profession,
  r.email,
  r.city_area,
  count(l.id)                                      as showrooms_visited,
  coalesce(
    string_agg(l.showroom_name, ', ' order by l.showroom_name),
    ''
  )                                                as showrooms,
  min(l.scanned_at)                                as first_scan_at,
  max(l.scanned_at)                                as last_scan_at
from public.registrants r
left join public.showroom_logs l on l.registrant_id = r.id
group by r.id
order by r.created_at desc;

revoke all on public.showroom_attendance from anon, authenticated;

-- ===== SECTION: ADMIN ACCOUNTS (Supabase Auth — Spec 8) =====
-- Create the 4 showroom admins in the dashboard: Authentication → Users → Add user.
-- Tick "Auto Confirm User". Then set each user's metadata to identify the showroom.
-- After creating them, run the 4 statements below (edit the emails to match).
--
--   update auth.users set raw_user_meta_data =
--     coalesce(raw_user_meta_data, '{}'::jsonb) || '{"showroom_name":"Showroom 1"}'::jsonb
--   where email = 'showroom1@piidsummit.com';
--
--   update auth.users set raw_user_meta_data =
--     coalesce(raw_user_meta_data, '{}'::jsonb) || '{"showroom_name":"Showroom 2"}'::jsonb
--   where email = 'showroom2@piidsummit.com';
--
--   update auth.users set raw_user_meta_data =
--     coalesce(raw_user_meta_data, '{}'::jsonb) || '{"showroom_name":"Showroom 3"}'::jsonb
--   where email = 'showroom3@piidsummit.com';
--
--   update auth.users set raw_user_meta_data =
--     coalesce(raw_user_meta_data, '{}'::jsonb) || '{"showroom_name":"Showroom 4"}'::jsonb
--   where email = 'showroom4@piidsummit.com';
--
-- Verify with:
--   select email, raw_user_meta_data->>'showroom_name' as showroom from auth.users;
--
-- /api/check-in reads the showroom from this metadata, never from the browser,
-- so an admin cannot log a scan under someone else's showroom (Spec 8).
