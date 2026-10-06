-- Settings that really work, and server-side blocks and reports. Run once in the Supabase SQL editor.

-- 1. Notification preferences and "pause my profile" live on the profile
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb,
  add column if not exists paused boolean not null default false;

-- 2. Blocks. A snapshot of name and photo is kept, because once blocked, the other profile can no longer be read.
create table if not exists public.blocks (
  blocker uuid not null references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  blocked_name text,
  blocked_photo text,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_involved" on public.blocks;
create policy "blocks_select_involved" on public.blocks
  for select using (auth.uid() = blocker or auth.uid() = blocked);

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert with check (auth.uid() = blocker);

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks
  for delete using (auth.uid() = blocker);

-- 3. Blocked people cannot see each other's profiles at all (Seek, Chosen, Sparks, chat).
drop policy if exists "Authenticated users can read active profiles" on public.profiles;
create policy "Authenticated users can read active profiles" on public.profiles
  for select using (
    auth.uid() is not null
    and is_active = true
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = profiles.id and b.blocked = auth.uid())
         or (b.blocker = auth.uid() and b.blocked = profiles.id)
    )
  );

-- 4. Reports. Users see their own; the team reviews them in the Table editor (status: open → reviewed / dismissed).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.profiles(id) on delete set null,
  reported uuid references public.profiles(id) on delete set null,
  reported_name text,
  reported_photo text,
  reason text not null,
  details text,
  source text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists reports_status_idx on public.reports (status, created_at);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter);

-- ── How the team reviews reports ─────────────────────────────────────────────
--   select r.created_at, r.reason, r.details, r.source, r.reported_name, r.reported, p.name as reporter_name
--   from public.reports r left join public.profiles p on p.id = r.reporter
--   where r.status = 'open' order by r.created_at;
--
--   update public.reports set status = 'reviewed', reviewed_at = now() where id = '<report id>';
