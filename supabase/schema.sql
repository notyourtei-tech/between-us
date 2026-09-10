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

-- Tables are reachable only by signed-in users. RLS above still makes every
-- row private to its owner; anonymous visitors cannot read the diary at all.
revoke all on public.love_spaces, public.savings_entries, public.memory_entries from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.love_spaces to authenticated;
grant select, insert on public.savings_entries, public.memory_entries to authenticated;

create index if not exists savings_entries_user_date_idx on public.savings_entries(user_id, occurred_on desc);
create index if not exists memory_entries_user_date_idx on public.memory_entries(user_id, occurred_on desc);

-- Shared-space upgrade: two authenticated accounts can work in one private
-- relationship space, while every other authenticated user remains locked out.
alter table public.love_spaces add column if not exists invite_code text not null
  default ('US-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
create unique index if not exists love_spaces_invite_code_idx on public.love_spaces(invite_code);

create table if not exists public.love_space_members (
  love_space_id uuid not null references public.love_spaces(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (love_space_id, user_id)
);

insert into public.love_space_members (love_space_id, user_id, role)
select id, user_id, 'owner' from public.love_spaces
on conflict (love_space_id, user_id) do nothing;

alter table public.love_space_members enable row level security;

create or replace function public.is_love_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.love_space_members
    where love_space_id = target_space_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_love_space_owner(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.love_spaces
    where id = target_space_id and user_id = auth.uid()
  );
$$;

create or replace function public.join_love_space(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_space_id uuid;
begin
  if auth.uid() is null then
    raise exception '请先登录后再加入共享空间';
  end if;
  select id into target_space_id
  from public.love_spaces
  where invite_code = upper(trim(code));
  if target_space_id is null then
    raise exception '邀请码无效';
  end if;
  if exists (select 1 from public.love_space_members where user_id = auth.uid()) then
    raise exception '这个账户已经加入了一个共享空间';
  end if;
  if (select count(*) from public.love_space_members where love_space_id = target_space_id) >= 2 then
    raise exception '这个共享空间已经有两位成员';
  end if;
  insert into public.love_space_members (love_space_id, user_id, role)
  values (target_space_id, auth.uid(), 'member');
  return target_space_id;
end;
$$;

revoke all on function public.is_love_space_member(uuid) from public;
revoke all on function public.is_love_space_owner(uuid) from public;
revoke all on function public.join_love_space(text) from public;
grant execute on function public.is_love_space_member(uuid) to authenticated;
grant execute on function public.is_love_space_owner(uuid) to authenticated;
grant execute on function public.join_love_space(text) to authenticated;

drop policy if exists "read own love space" on public.love_spaces;
drop policy if exists "insert own love space" on public.love_spaces;
drop policy if exists "update own love space" on public.love_spaces;
drop policy if exists "members read shared space" on public.love_spaces;
drop policy if exists "owner creates shared space" on public.love_spaces;
drop policy if exists "members update shared space" on public.love_spaces;
create policy "members read shared space" on public.love_spaces for select
  using (public.is_love_space_member(id));
create policy "owner creates shared space" on public.love_spaces for insert
  with check ((select auth.uid()) = user_id);
create policy "members update shared space" on public.love_spaces for update
  using (public.is_love_space_member(id)) with check (public.is_love_space_member(id));

drop policy if exists "read own membership" on public.love_space_members;
drop policy if exists "owner adds their membership" on public.love_space_members;
create policy "read own membership" on public.love_space_members for select
  using ((select auth.uid()) = user_id);
create policy "owner adds their membership" on public.love_space_members for insert
  with check (
    (select auth.uid()) = user_id
    and public.is_love_space_owner(love_space_id)
  );

drop policy if exists "read own savings" on public.savings_entries;
drop policy if exists "append own savings" on public.savings_entries;
drop policy if exists "members read shared savings" on public.savings_entries;
drop policy if exists "members append shared savings" on public.savings_entries;
create policy "members read shared savings" on public.savings_entries for select
  using (public.is_love_space_member(love_space_id));
create policy "members append shared savings" on public.savings_entries for insert
  with check (public.is_love_space_member(love_space_id) and (select auth.uid()) = user_id);

drop policy if exists "read own memories" on public.memory_entries;
drop policy if exists "append own memories" on public.memory_entries;
drop policy if exists "members read shared memories" on public.memory_entries;
drop policy if exists "members append shared memories" on public.memory_entries;
create policy "members read shared memories" on public.memory_entries for select
  using (public.is_love_space_member(love_space_id));
create policy "members append shared memories" on public.memory_entries for insert
  with check (public.is_love_space_member(love_space_id) and (select auth.uid()) = user_id);

grant select, insert on public.love_space_members to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.love_spaces, public.savings_entries, public.memory_entries;
exception when duplicate_object then null;
end $$;
