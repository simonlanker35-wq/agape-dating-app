-- Verification by hand. Run once in the SQL editor, after referrals.sql.
-- The selfie upload is gone from the app. Simon marks a profile verified in the dashboard:
--   update public.profiles set is_verified = true where email = '...';   (or by name)
-- The gold badge then shows on that profile everywhere.

alter table public.profiles add column if not exists is_verified boolean not null default false;

-- anyone verified the old way (approved selfie) keeps the badge
update public.profiles p set is_verified = true
where exists (
  select 1 from public.photo_verifications v where v.user_id = p.id and v.status in ('approved', 'accepted')
) and p.is_verified = false;

drop view if exists public.profiles_public;
create view public.profiles_public as
  select
    p.id, p.name, p.age, p.height, p.gender, p.denomination, p.job, p.school, p.location_city,
    round(p.location_lat::numeric, 2)::float8 as location_lat,
    round(p.location_lng::numeric, 2)::float8 as location_lng,
    p.photos, p.prompts, p.interests, p.traits, p.who_are_you, p.looking_for, p.bio, p.filters,
    p.is_active, p.is_standout, p.compatibility_reason, p.verified_photos, p.details, p.paused,
    p.last_active, p.created_at, p.intent, p.community_points, p.is_verified
  from public.profiles p
  where p.is_active = true
    and auth.uid() is not null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = p.id and b.blocked = auth.uid())
         or (b.blocker = auth.uid() and b.blocked = p.id)
    );
revoke all on public.profiles_public from anon;
grant select on public.profiles_public to authenticated;

-- only the dashboard (or a server function) can set it
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
  if new.is_verified is distinct from old.is_verified then raise exception 'Cannot modify is_verified from client'; end if;
  return new;
end;
$$ language plpgsql security definer;
