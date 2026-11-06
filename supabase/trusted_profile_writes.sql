-- Fix: "Cannot modify community_points from client" when posting, replying or saying Amen.
-- Run once in the Supabase SQL editor. Safe to run more than once; changes rules only, never member data.
--
-- Why it broke: the points are added by a database trigger, but that trigger runs inside the member's
-- own request, so the profile guard still sees the member's login and blocks the change. The same thing
-- blocked invite links (apply_referral writes premium_until / referred_by / referrals_count).
-- Fix: the database's own functions raise a flag for the length of their one update; the guard lets
-- that through. The app cannot raise the flag itself, so members still cannot edit these columns.

-- 1. The guard, re-stated in full, with the trusted-write exception.
create or replace function protect_admin_columns_fn()
returns trigger as $$
begin
  if current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role' then return new; end if;
  if auth.uid() is null then return new; end if;
  if coalesce(current_setting('agape.trusted_write', true), '0') = '1' then return new; end if;
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

-- 2. Community points: raise the flag only around the one points update.
create or replace function public.community_add_points(p_user uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('agape.trusted_write', '1', true);
  update public.profiles set community_points = greatest(0, community_points + p_delta) where id = p_user;
  perform set_config('agape.trusted_write', '0', true);
end;
$$;
revoke all on function public.community_add_points(uuid, integer) from public, anon, authenticated;

-- 3. Invite links: same flag around the two profile updates (all checks stay as before).
create or replace function public.apply_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_row record;
  ref_row record;
  gift interval := interval '7 days';
begin
  if me is null then raise exception 'Not allowed'; end if;
  select * into my_row from public.profiles where id = me;
  if my_row is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if my_row.referred_by is not null then return jsonb_build_object('ok', false, 'reason', 'already_used'); end if;
  if my_row.created_at < now() - interval '2 days' then return jsonb_build_object('ok', false, 'reason', 'not_new'); end if;
  select * into ref_row from public.profiles where referral_code = upper(trim(p_code));
  if ref_row is null or ref_row.id = me then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;

  perform set_config('agape.trusted_write', '1', true);
  update public.profiles set referred_by = ref_row.id, premium_until = greatest(coalesce(premium_until, now()), now()) + gift where id = me;
  update public.profiles set referrals_count = referrals_count + 1, premium_until = greatest(coalesce(premium_until, now()), now()) + gift where id = ref_row.id;
  perform set_config('agape.trusted_write', '0', true);
  return jsonb_build_object('ok', true, 'referrerName', ref_row.name, 'premiumUntil', (select premium_until from public.profiles where id = me));
end;
$$;
revoke all on function public.apply_referral(text) from public, anon;
grant execute on function public.apply_referral(text) to authenticated;

-- check: both functions should now mention trusted_write
select proname, position('trusted_write' in prosrc) > 0 as fixed
from pg_proc where proname in ('protect_admin_columns_fn', 'community_add_points', 'apply_referral');
