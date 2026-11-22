-- Records each member's consent to the processing of their religious beliefs: when, and which text.
-- Run once in the Supabase SQL editor. Safe to run more than once.
--
-- Where it is stored: two columns on public.profiles, next to the rest of the member's data.
--   faith_consent_at      the moment of consent, taken from the database clock (the app can't choose it)
--   faith_consent_version which consent text was shown, e.g. '2026-11'
-- Other members never see these columns: they read profiles through profiles_public, which lists its
-- columns by name and does not include them. Deleting the account deletes the row and the record with it.

alter table public.profiles add column if not exists faith_consent_at timestamptz;
alter table public.profiles add column if not exists faith_consent_version text;

-- The app may not write these columns itself; only record_faith_consent() below can.
create or replace function public.guard_faith_consent()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;                                   -- SQL editor / server
  if coalesce(current_setting('agape.consent_write', true), '0') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.faith_consent_at := null;
    new.faith_consent_version := null;
  else
    new.faith_consent_at := old.faith_consent_at;
    new.faith_consent_version := old.faith_consent_version;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_faith_consent on public.profiles;
create trigger guard_faith_consent before insert or update on public.profiles
  for each row execute function public.guard_faith_consent();

-- Called by the app right after the member ticks the consent box (sign-up, or the one-time prompt
-- for members who signed up before consent was recorded). Returns the stored time.
create or replace function public.record_faith_consent(p_version text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Not allowed'; end if;
  perform set_config('agape.consent_write', '1', true);
  update public.profiles
  set faith_consent_at = t, faith_consent_version = left(coalesce(p_version, ''), 20)
  where id = auth.uid();
  perform set_config('agape.consent_write', '0', true);
  return t;
end;
$$;
revoke all on function public.record_faith_consent(text) from public, anon;
grant execute on function public.record_faith_consent(text) to authenticated;

-- check: who has a recorded consent so far (everyone else is asked once when they next open the app)
select name, faith_consent_at, faith_consent_version from public.profiles order by faith_consent_at nulls first;
