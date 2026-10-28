-- Limits hold even when several requests arrive at the same instant. Run once in the Supabase SQL editor,
-- after audit_hardening.sql. Safe to run more than once.
--
-- Before: two likes sent at the same moment could both count "7 used" and both pass the limit of 8.
-- Now: each member's likes (and reveals) take a short per-member lock, so the second request waits
-- for the first, then counts it. Other members are never slowed down.

create or replace function public.enforce_like_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim record; used integer;
begin
  if auth.uid() is null then return new; end if;
  if new.from_user <> auth.uid() then raise exception 'Not allowed'; end if;
  perform pg_advisory_xact_lock(hashtext('likes:' || new.from_user::text));  -- one like at a time per member
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
  perform pg_advisory_xact_lock(hashtext('reveals:' || new.user_id::text));  -- one reveal at a time per member
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
