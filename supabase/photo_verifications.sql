-- Verification selfies (with a church / with a Bible). Run once in the Supabase SQL editor.
-- A user uploads a selfie; it stays private and "pending" until the Agape team approves it.
-- Only approved selfies are copied onto the public profile.

-- 1. One row per user and kind. Nobody but the owner can read it.
create table if not exists public.photo_verifications (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('church', 'bible')),
  url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  primary key (user_id, kind)
);

alter table public.photo_verifications enable row level security;

drop policy if exists "photo_verifications_own" on public.photo_verifications;
create policy "photo_verifications_own" on public.photo_verifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Approved selfies shown on the public profile: { "church": "<url>", "bible": "<url>" }
alter table public.profiles
  add column if not exists verified_photos jsonb not null default '{}'::jsonb;

-- 3. Anything coming from the app is always "pending": users cannot approve themselves.
--    Changes made here in the SQL editor / Table editor (the team) are left alone.
create or replace function public.photo_verifications_force_pending()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.status := 'pending';
    new.note := null;
    new.reviewed_at := null;
    new.created_at := now();
  elsif new.status <> 'pending' and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists photo_verifications_force_pending on public.photo_verifications;
create trigger photo_verifications_force_pending
  before insert or update on public.photo_verifications
  for each row execute function public.photo_verifications_force_pending();

-- 4. Keep profiles.verified_photos in step with the approved rows.
create or replace function public.photo_verifications_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  perform set_config('agape.sync_verified', '1', true);
  update public.profiles p
  set verified_photos = coalesce(
    (select jsonb_object_agg(v.kind, v.url) from public.photo_verifications v where v.user_id = v_user and v.status = 'approved'),
    '{}'::jsonb)
  where p.id = v_user;
  perform set_config('agape.sync_verified', '0', true);
  return null;
end;
$$;

drop trigger if exists photo_verifications_sync on public.photo_verifications;
create trigger photo_verifications_sync
  after insert or update or delete on public.photo_verifications
  for each row execute function public.photo_verifications_sync();

-- 5. Users cannot write verified_photos on their own profile directly.
create or replace function public.guard_verified_photos()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and coalesce(current_setting('agape.sync_verified', true), '0') <> '1' then
    new.verified_photos := old.verified_photos;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_verified_photos on public.profiles;
create trigger guard_verified_photos
  before update on public.profiles
  for each row execute function public.guard_verified_photos();

-- ── How the team reviews ─────────────────────────────────────────────────────
-- Waiting list (open the url to look at the selfie):
--   select v.user_id, p.name, v.kind, v.url, v.created_at
--   from public.photo_verifications v join public.profiles p on p.id = v.user_id
--   where v.status = 'pending' order by v.created_at;
--
-- Approve or reject one (also possible by editing the status cell in the Table editor):
--   update public.photo_verifications set status = 'approved' where user_id = '<user id>' and kind = 'church';
--   update public.photo_verifications set status = 'rejected', note = 'Face not visible' where user_id = '<user id>' and kind = 'bible';
