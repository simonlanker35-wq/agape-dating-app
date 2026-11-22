-- Show each member's sign-up phone number in the profiles table (for the dashboard).
-- Run once in the Supabase SQL editor. Safe to run more than once.
-- Privacy: other members never see it. They read profiles through the profiles_public view, which
-- lists its columns by name and does not include phone; the table itself only shows your own row.

alter table public.profiles add column if not exists phone text;

-- 1. Fill it in for everyone who already has an account
update public.profiles p
set phone = '+' || u.phone
from auth.users u
where u.id = p.id and coalesce(u.phone, '') <> '' and p.phone is distinct from '+' || u.phone;

-- 2. The app can never set it: on every insert/update the number is copied from the login itself
create or replace function public.profiles_phone_from_auth()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v text;
begin
  select nullif(u.phone, '') into v from auth.users u where u.id = new.id;
  new.phone := case when v is null then null else '+' || v end;
  return new;
end;
$$;
drop trigger if exists profiles_phone_from_auth on public.profiles;
create trigger profiles_phone_from_auth before insert or update on public.profiles
  for each row execute function public.profiles_phone_from_auth();

-- 3. If someone changes the number on their login, the profile follows
create or replace function public.auth_phone_to_profile()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update public.profiles
  set phone = case when nullif(new.phone, '') is null then null else '+' || new.phone end
  where id = new.id;
  return new;
end;
$$;
drop trigger if exists auth_phone_to_profile on auth.users;
create trigger auth_phone_to_profile after update of phone on auth.users
  for each row execute function public.auth_phone_to_profile();

-- check: phone sign-ups with their number
select name, phone, email, created_at from public.profiles where phone is not null order by created_at desc;
