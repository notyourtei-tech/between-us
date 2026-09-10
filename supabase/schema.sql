-- Between Us: execute once in Supabase SQL Editor.
-- Auth users are managed by Supabase Auth. These three tables only store the
-- authenticated person's private relationship space and journal entries.

create extension if not exists pgcrypto;

create table if not exists public.love_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  owner_name text not null default '我' check (char_length(owner_name) between 1 and 40),
  partner_name text not null default 'TA' check (char_length(partner_name) between 1 and 40),
  relationship_start_date date not null,
  first_meeting_date date not null,
  last_meeting_date date not null,
  next_meeting_date date not null,
  savings_target numeric(12,2) not null default 0 check (savings_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_entries (
  id uuid primary key default gen_random_uuid(),
  love_space_id uuid not null references public.love_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency_code text not null default 'CNY' check (currency_code in ('CNY', 'JPY', 'BYN')),
  contributor text not null default 'me' check (contributor in ('me', 'partner')),
  note text not null default '' check (char_length(note) <= 160),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  love_space_id uuid not null references public.love_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('meeting', 'moment', 'promise')),
  title text not null check (char_length(title) between 1 and 100),
  note text not null default '' check (char_length(note) <= 1000),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Safe migration for projects that ran an earlier version of this schema.
alter table public.savings_entries add column if not exists currency_code text not null default 'CNY'
  check (currency_code in ('CNY', 'JPY', 'BYN'));
alter table public.savings_entries add column if not exists contributor text not null default 'me'
  check (contributor in ('me', 'partner'));

alter table public.love_spaces enable row level security;
alter table public.savings_entries enable row level security;
alter table public.memory_entries enable row level security;

-- Profile dates can be edited; money and memories are append-only by design.
-- There are deliberately no UPDATE / DELETE policies for savings_entries and
-- memory_entries, so an authenticated browser cannot erase historical records.
drop policy if exists "users manage own love space" on public.love_spaces;
drop policy if exists "read own love space" on public.love_spaces;
drop policy if exists "insert own love space" on public.love_spaces;
drop policy if exists "update own love space" on public.love_spaces;
create policy "read own love space" on public.love_spaces for select using ((select auth.uid()) = user_id);
create policy "insert own love space" on public.love_spaces for insert with check ((select auth.uid()) = user_id);
create policy "update own love space" on public.love_spaces for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own savings" on public.savings_entries;
drop policy if exists "read own savings" on public.savings_entries;
drop policy if exists "append own savings" on public.savings_entries;
create policy "read own savings" on public.savings_entries for select using ((select auth.uid()) = user_id);
create policy "append own savings" on public.savings_entries for insert with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own memories" on public.memory_entries;
drop policy if exists "read own memories" on public.memory_entries;
drop policy if exists "append own memories" on public.memory_entries;
create policy "read own memories" on public.memory_entries for select using ((select auth.uid()) = user_id);
create policy "append own memories" on public.memory_entries for insert with check ((select auth.uid()) = user_id);

create index if not exists savings_entries_user_date_idx on public.savings_entries(user_id, occurred_on desc);
create index if not exists memory_entries_user_date_idx on public.memory_entries(user_id, occurred_on desc);
