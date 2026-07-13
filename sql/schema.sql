-- ============================================================================
-- Payroll Portal (Extra Hours) — Supabase Schema
-- Young Musicians Unite
--
-- HOW TO USE:
-- 1. Open your Supabase project → SQL Editor → New Query.
-- 2. Paste this ENTIRE file in and click "Run".
-- 3. That's it — tables, security rules, and helper functions are all created.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE where possible.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PROFILES
-- One row per person (Teacher or Regional Manager). This sits "on top of"
-- Supabase's built-in auth.users table, which stores the real login
-- credentials. We add full_name + role here.
--
-- NOTE ON LOGIN: the PRD asks users to sign up with just a Full Name +
-- Password (no email). Supabase Auth requires an email under the hood, so
-- the app quietly generates one from the person's name (e.g.
-- "janedoe@ymu.internal") and stores it in login_email. The person never
-- sees or types this — they only ever type their name.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  login_email text not null unique,
  role        text not null check (role in ('teacher', 'manager')),
  created_at  timestamptz not null default now()
);

-- Names must be unique (case-insensitive) so the login lookup is unambiguous
create unique index if not exists profiles_full_name_lower_idx
  on public.profiles (lower(full_name));

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- ----------------------------------------------------------------------------
-- 2. REQUESTS
-- One row per "Extra Hours" submission.
-- ----------------------------------------------------------------------------
create table if not exists public.requests (
  id             uuid primary key default gen_random_uuid(),
  teacher_id     uuid not null references public.profiles(id) on delete cascade,
  teacher_name   text not null,               -- snapshot, so it still shows if a name changes later
  school         text not null,
  category       text not null,               -- e.g. "Subbing" or a custom typed-in category
  hours          numeric(5,2) not null check (hours > 0),
  description    text not null default '',
  status         text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  manager_note   text,                        -- optional note added when approving
  decline_reason text,                        -- required reason when declining
  date_logged    timestamptz not null default now(),
  reviewed_at    timestamptz,
  is_cleared     boolean not null default false,  -- soft-delete: hidden from manager's tables, kept for CSV export
  notified       boolean not null default true     -- flips to false when status changes, so teacher gets a notification
);

create index if not exists requests_teacher_id_idx on public.requests (teacher_id);
create index if not exists requests_status_idx on public.requests (status);

alter table public.requests enable row level security;

-- Teachers can see + create their own requests
drop policy if exists "Teachers can view own requests" on public.requests;
create policy "Teachers can view own requests"
  on public.requests for select
  using (auth.uid() = teacher_id);

drop policy if exists "Teachers can insert own requests" on public.requests;
create policy "Teachers can insert own requests"
  on public.requests for insert
  with check (auth.uid() = teacher_id);

-- Managers can see + update EVERY request (approve / decline / clear)
drop policy if exists "Managers can view all requests" on public.requests;
create policy "Managers can view all requests"
  on public.requests for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );

drop policy if exists "Managers can update all requests" on public.requests;
create policy "Managers can update all requests"
  on public.requests for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );


-- ----------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (RPCs called from the app)
-- ----------------------------------------------------------------------------

-- Looks up the hidden login email for a given full name, so the login screen
-- can just ask for "Full Name" + "Password". Safe to expose: it only ever
-- returns an email, never a password or profile data.
create or replace function public.get_login_email(p_full_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select login_email from public.profiles where lower(full_name) = lower(p_full_name) limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;

-- Lets a teacher mark their own request as "seen" without giving them
-- general UPDATE access to the requests table.
create or replace function public.mark_request_notified(p_request_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.requests
  set notified = true
  where id = p_request_id and teacher_id = auth.uid();
$$;

grant execute on function public.mark_request_notified(uuid) to authenticated;

-- ============================================================================
-- Done! Next: Authentication → Providers → make sure Email is enabled, and
-- under Authentication → Settings, turn OFF "Confirm email" so accounts can
-- log in immediately after signing up (see the deployment guide for why).
-- ============================================================================
