-- Sparks reveals: every member starts with 10 free reveals; after those, free members get 1 a week
-- and Agape+ members are unlimited. Run once in the SQL editor, after usage_limits.sql.

create or replace function public.usage_limits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  lim record;
  day_start timestamptz := date_trunc('day', now());
  week_start timestamptz := date_trunc('week', now());
  likes_used integer;
  doves_used integer;
  reveals_total integer;
  reveals_week integer;
  reveals_used integer;
  reveals_limit integer;
  starter integer := 10;
begin
  if me is null then raise exception 'Not allowed'; end if;
  select * into lim from public.plan_limits(me);
  if lim is null then raise exception 'No profile'; end if;
  select count(*) into likes_used from public.likes where from_user = me and not coalesce(is_dove, false) and created_at >= day_start;
  select count(*) into doves_used from public.likes where from_user = me and coalesce(is_dove, false) and created_at >= week_start;
  select count(*) into reveals_total from public.spark_reveals where user_id = me;
  -- reveals this week that came after the starter ten
  select count(*) into reveals_week from (
    select created_at, row_number() over (order by created_at) as rn from public.spark_reveals where user_id = me
  ) t where t.rn > starter and t.created_at >= week_start;
  if lim.premium then
    reveals_used := 0; reveals_limit := 1000000;
  elsif reveals_total < starter then
    reveals_used := reveals_total; reveals_limit := starter;
  else
    reveals_used := reveals_week; reveals_limit := lim.weekly_reveals;
  end if;
  return jsonb_build_object(
    'premium', lim.premium,
    'likesUsed', likes_used, 'likesLimit', lim.daily_likes,
    'dovesUsed', doves_used, 'dovesLimit', lim.weekly_doves,
    'revealsUsed', reveals_used, 'revealsLimit', reveals_limit,
    'starterRevealsLeft', greatest(0, starter - reveals_total),
    'likesResetAt', day_start + interval '1 day',
    'dovesResetAt', week_start + interval '7 days'
  );
end;
$$;
revoke all on function public.usage_limits() from public, anon;
grant execute on function public.usage_limits() to authenticated;

create or replace function public.enforce_reveal_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim record;
  total integer;
  used integer;
  starter integer := 10;
begin
  if auth.uid() is null then return new; end if;
  select * into lim from public.plan_limits(new.user_id);
  if lim is null or lim.premium then return new; end if;
  select count(*) into total from public.spark_reveals where user_id = new.user_id;
  if total < starter then return new; end if; -- still inside the free starter reveals
  select count(*) into used from (
    select created_at, row_number() over (order by created_at) as rn from public.spark_reveals where user_id = new.user_id
  ) t where t.rn > starter and t.created_at >= date_trunc('week', now());
  if used >= lim.weekly_reveals then raise exception 'REVEAL_LIMIT'; end if;
  return new;
end;
$$;
