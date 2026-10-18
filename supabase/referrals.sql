-- Invite links. Run once in the SQL editor, after community_points.sql.
-- Every member has a short invite code. When a friend signs up through the link, both get 7 days of
-- Agape+ (the inviter's gift stacks with every friend). The database applies the gift; the app cannot.

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referrals_count integer not null default 0,
  add column if not exists premium_until timestamptz;

-- an 8-character code from the id, set on insert and filled in for everyone who already exists
create or replace function public.profiles_set_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substr(replace(new.id::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_set_referral_code on public.profiles;
create trigger profiles_set_referral_code before insert on public.profiles
  for each row execute function public.profiles_set_referral_code();
update public.profiles set referral_code = upper(substr(replace(id::text, '-', ''), 1, 8)) where referral_code is null;
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);

-- the app may read these but never write them
create or replace function protect_admin_columns_fn()
returns trigger as $$
begin
  if current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if new.subscription_status is distinct from old.subscription_status then raise exception 'Cannot modify subscription_status from client'; end if;
  if new.doves is distinct from old.doves then raise exception 'Cannot modify doves from client'; end if;
  if new.is_active is distinct from old.is_active then raise exception 'Cannot modify is_active from client'; end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then raise exception 'Cannot modify stripe_customer_id from client'; end if;
  if new.subscription_id is distinct from old.subscription_id then raise exception 'Cannot modify subscription_id from client'; end if;
  if new.is_standout is distinct from old.is_standout then raise exception 'Cannot modify is_standout from client'; end if;
  if new.email is distinct from old.email then raise exception 'Cannot modify email from client'; end if;
  if new.community_points is distinct from old.community_points then raise exception 'Cannot modify community_points from client'; end if;
  if new.referral_code is distinct from old.referral_code then raise exception 'Cannot modify referral_code from client'; end if;
  if new.referred_by is distinct from old.referred_by then raise exception 'Cannot modify referred_by from client'; end if;
  if new.referrals_count is distinct from old.referrals_count then raise exception 'Cannot modify referrals_count from client'; end if;
  if new.premium_until is distinct from old.premium_until then raise exception 'Cannot modify premium_until from client'; end if;
  return new;
end;
$$ language plpgsql security definer;

-- Agape+ comes from a paid subscription or from a gift that has not run out
drop function if exists public.plan_limits(uuid);
create or replace function public.plan_limits(p_user uuid)
returns table (premium boolean, daily_likes integer, weekly_doves integer, weekly_reveals integer, daily_waves integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p.subscription_status = 'active' or p.premium_until > now(), false),
    case when p.subscription_status = 'active' or p.premium_until > now() then 15 else 8 end,
    case when p.subscription_status = 'active' or p.premium_until > now() then 3 else 1 end,
    case when p.subscription_status = 'active' or p.premium_until > now() then 1000000 else 1 end,
    case when p.subscription_status = 'active' or p.premium_until > now() then 30 else 15 end
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.plan_limits(uuid) from public, anon;

-- Called once by a new account with the code from the link. Checks everything, then gives both sides 7 days.
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

  update public.profiles set referred_by = ref_row.id, premium_until = greatest(coalesce(premium_until, now()), now()) + gift where id = me;
  update public.profiles set referrals_count = referrals_count + 1, premium_until = greatest(coalesce(premium_until, now()), now()) + gift where id = ref_row.id;
  return jsonb_build_object('ok', true, 'referrerName', ref_row.name, 'premiumUntil', (select premium_until from public.profiles where id = me));
end;
$$;
revoke all on function public.apply_referral(text) from public, anon;
grant execute on function public.apply_referral(text) to authenticated;
