-- Hardening from the October 2026 audit. Run once in the Supabase SQL editor.
-- Every statement is safe to run more than once. It changes rules only, never member data.

-- ── 1. Stored files can no longer be listed by strangers ──────────────────────
-- Profile photos keep loading: a public bucket still serves its files through their public URL.
-- This only removes the ability to LIST folders and read files through the authenticated API.
drop policy if exists "media_read" on storage.objects;

-- ── 2. A new profile cannot grant itself premium, the badge, or extra doves ───
-- The old guard only ran on UPDATE, so delete-then-insert slipped past it. This resets the
-- sensitive columns to their safe defaults whenever the app inserts a profile.
create or replace function public.profiles_insert_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then                 -- app request, not the SQL editor / service role
    new.subscription_status := 'none';
    new.subscription_id := null;
    new.stripe_customer_id := null;
    new.premium_until := null;
    new.doves := 3;
    new.is_active := true;
    new.is_standout := false;
    new.is_verified := false;
    new.community_points := 0;
    new.referred_by := null;
    new.referrals_count := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_insert_defaults on public.profiles;
create trigger profiles_insert_defaults before insert on public.profiles
  for each row execute function public.profiles_insert_defaults();

-- The update guard, re-stated in full so every protected column is covered for certain.
create or replace function protect_admin_columns_fn()
returns trigger as $$
begin
  if current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role' then return new; end if;
  if auth.uid() is null then return new; end if;
  if new.subscription_status is distinct from old.subscription_status then raise exception 'Cannot modify subscription_status from client'; end if;
  if new.subscription_id   is distinct from old.subscription_id   then raise exception 'Cannot modify subscription_id from client'; end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then raise exception 'Cannot modify stripe_customer_id from client'; end if;
  if new.doves             is distinct from old.doves             then raise exception 'Cannot modify doves from client'; end if;
  if new.premium_until     is distinct from old.premium_until     then raise exception 'Cannot modify premium_until from client'; end if;
  if new.is_active         is distinct from old.is_active         then raise exception 'Cannot modify is_active from client'; end if;
  if new.is_standout       is distinct from old.is_standout       then raise exception 'Cannot modify is_standout from client'; end if;
  if new.is_verified       is distinct from old.is_verified       then raise exception 'Cannot modify is_verified from client'; end if;
  if new.email             is distinct from old.email             then raise exception 'Cannot modify email from client'; end if;
  if new.community_points  is distinct from old.community_points  then raise exception 'Cannot modify community_points from client'; end if;
  if new.referral_code     is distinct from old.referral_code     then raise exception 'Cannot modify referral_code from client'; end if;
  if new.referred_by       is distinct from old.referred_by       then raise exception 'Cannot modify referred_by from client'; end if;
  if new.referrals_count   is distinct from old.referrals_count   then raise exception 'Cannot modify referrals_count from client'; end if;
  return new;
end;
$$ language plpgsql security definer;

-- Name and age stay fixed after sign-up (this trigger was missing on the live database).
create or replace function public.lock_profile_identity()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.name := old.name;
    new.age := old.age;
  end if;
  return new;
end;
$$;
drop trigger if exists lock_profile_identity on public.profiles;
create trigger lock_profile_identity before update on public.profiles
  for each row execute function public.lock_profile_identity();

-- ── 3. Likes and reveals are always stamped by the database, so limits can't be backdated ──
create or replace function public.enforce_like_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim record; used integer;
begin
  if auth.uid() is null then return new; end if;
  if new.from_user <> auth.uid() then raise exception 'Not allowed'; end if;
  new.created_at := now();                         -- client cannot choose the timestamp
  select * into lim from public.plan_limits(new.from_user);
  if lim is null then return new; end if;
  if coalesce(new.kind, 'date') = 'friend' then
    new.is_dove := false;
    select count(*) into used from public.likes where from_user = new.from_user and kind = 'friend' and created_at >= date_trunc('day', now());
    if used >= lim.daily_waves then raise exception 'WAVE_LIMIT'; end if;
  elsif coalesce(new.is_dove, false) then
    select count(*) into used from public.likes where from_user = new.from_user and kind = 'date' and coalesce(is_dove, false) and created_at >= date_trunc('week', now());
    if used >= lim.weekly_doves then raise exception 'DOVE_LIMIT'; end if;
  else
    select count(*) into used from public.likes where from_user = new.from_user and kind = 'date' and not coalesce(is_dove, false) and created_at >= date_trunc('day', now());
    if used >= lim.daily_likes then raise exception 'LIKE_LIMIT'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_reveal_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim record; total integer; used integer; starter integer := 10;
begin
  if auth.uid() is null then return new; end if;
  new.created_at := now();                         -- client cannot choose the timestamp
  select * into lim from public.plan_limits(new.user_id);
  if lim is null or lim.premium then return new; end if;
  select count(*) into total from public.spark_reveals where user_id = new.user_id;
  if total < starter then return new; end if;
  select count(*) into used from (
    select created_at, row_number() over (order by created_at) as rn from public.spark_reveals where user_id = new.user_id
  ) t where t.rn > starter and t.created_at >= date_trunc('week', now());
  if used >= lim.weekly_reveals then raise exception 'REVEAL_LIMIT'; end if;
  return new;
end;
$$;

-- ── 4. The public profile view is read-only for members ───────────────────────
revoke insert, update, delete, truncate, references, trigger on public.profiles_public from authenticated;

-- ── 5. Blocking someone ends the match and the chat ───────────────────────────
create or replace function public.block_ends_match()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.matches
  where (user1 = new.blocker and user2 = new.blocked)
     or (user1 = new.blocked and user2 = new.blocker);   -- messages and date plans cascade with the match
  return new;
end;
$$;
drop trigger if exists block_ends_match on public.blocks;
create trigger block_ends_match after insert on public.blocks
  for each row execute function public.block_ends_match();

-- ── 6. Reaction function is for signed-in members only ───────────────────────
-- Revoke from PUBLIC, not just anon: Postgres grants execute to PUBLIC by default and anon
-- inherits it, so revoking from anon alone leaves it callable. authenticated keeps its own grant.
revoke execute on function public.react_to_message(uuid, text) from public;

-- ── done. Re-run the read-only export afterwards to confirm media_read is gone
--    and profiles_public shows only SELECT for authenticated.
