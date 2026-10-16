-- Friends mode. Run once in the Supabase SQL editor, after starter_reveals.sql.
-- Members say whether they are here to date, to meet Christian friends, or both. Dating and friendship
-- are kept apart: a like, a match and a chat carry a kind ('date' or 'friend'), and a wave to a friend
-- never turns into a date match.

-- ── profiles: what the person is here for ──
alter table public.profiles
  add column if not exists intent text not null default 'date';
alter table public.profiles drop constraint if exists profiles_intent_check;
alter table public.profiles add constraint profiles_intent_check check (intent in ('date', 'friends', 'both'));

-- ── likes and matches carry their kind ──
alter table public.likes add column if not exists kind text not null default 'date';
alter table public.likes drop constraint if exists likes_kind_check;
alter table public.likes add constraint likes_kind_check check (kind in ('date', 'friend'));
alter table public.matches add column if not exists kind text not null default 'date';
alter table public.matches drop constraint if exists matches_kind_check;
alter table public.matches add constraint matches_kind_check check (kind in ('date', 'friend'));

-- one like per person per kind (the old two-column unique constraint goes)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.likes'::regclass and contype = 'u' and array_length(conkey, 1) = 2
  loop
    execute format('alter table public.likes drop constraint %I', c);
  end loop;
end $$;
create unique index if not exists likes_from_to_kind_key on public.likes (from_user, to_user, kind);
create index if not exists matches_kind_idx on public.matches (kind);

-- ── the public view shows the intent so Seek can filter on it ──
drop view if exists public.profiles_public;
create view public.profiles_public as
  select
    p.id, p.name, p.age, p.height, p.gender, p.denomination, p.job, p.school, p.location_city,
    round(p.location_lat::numeric, 2)::float8 as location_lat,
    round(p.location_lng::numeric, 2)::float8 as location_lng,
    p.photos, p.prompts, p.interests, p.traits, p.who_are_you, p.looking_for, p.bio, p.filters,
    p.is_active, p.is_standout, p.compatibility_reason, p.verified_photos, p.details, p.paused,
    p.last_active, p.created_at, p.intent
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

-- ── a match of a given kind, only when both liked each other in that kind ──
create or replace function public.create_match_if_mutual(p_other uuid, p_kind text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing uuid;
  created uuid;
begin
  if me is null or p_other is null or p_other = me then raise exception 'Not allowed'; end if;
  if p_kind not in ('date', 'friend') then raise exception 'Not allowed'; end if;
  if not exists (select 1 from public.likes where from_user = me and to_user = p_other and kind = p_kind)
     or not exists (select 1 from public.likes where from_user = p_other and to_user = me and kind = p_kind) then
    return null;
  end if;
  select id into existing from public.matches
    where kind = p_kind and ((user1 = me and user2 = p_other) or (user1 = p_other and user2 = me)) limit 1;
  if existing is not null then return existing; end if;
  insert into public.matches (user1, user2, kind) values (me, p_other, p_kind) returning id into created;
  return created;
end;
$$;
revoke all on function public.create_match_if_mutual(uuid, text) from public, anon;
grant execute on function public.create_match_if_mutual(uuid, text) to authenticated;

-- the one-argument version stays for older app versions and means dating
create or replace function public.create_match_if_mutual(p_other uuid)
returns uuid language sql security definer set search_path = public as $$
  select public.create_match_if_mutual(p_other, 'date');
$$;
revoke all on function public.create_match_if_mutual(uuid) from public, anon;
grant execute on function public.create_match_if_mutual(uuid) to authenticated;

-- ── limits: dating likes and Doves as before, friend waves have their own daily allowance ──
create or replace function public.plan_limits(p_user uuid)
returns table (premium boolean, daily_likes integer, weekly_doves integer, weekly_reveals integer, daily_waves integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p.subscription_status = 'active', false),
    case when p.subscription_status = 'active' then 15 else 8 end,
    case when p.subscription_status = 'active' then 3 else 1 end,
    case when p.subscription_status = 'active' then 1000000 else 1 end,
    case when p.subscription_status = 'active' then 30 else 15 end
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.plan_limits(uuid) from public, anon;

create or replace function public.enforce_like_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim record;
  used integer;
begin
  if auth.uid() is null then return new; end if;
  if new.from_user <> auth.uid() then raise exception 'Not allowed'; end if;
  select * into lim from public.plan_limits(new.from_user);
  if lim is null then return new; end if;
  if coalesce(new.kind, 'date') = 'friend' then
    new.is_dove := false; -- Doves are a dating thing
    select count(*) into used from public.likes
      where from_user = new.from_user and kind = 'friend' and created_at >= date_trunc('day', now());
    if used >= lim.daily_waves then raise exception 'WAVE_LIMIT'; end if;
  elsif coalesce(new.is_dove, false) then
    select count(*) into used from public.likes
      where from_user = new.from_user and kind = 'date' and coalesce(is_dove, false) and created_at >= date_trunc('week', now());
    if used >= lim.weekly_doves then raise exception 'DOVE_LIMIT'; end if;
  else
    select count(*) into used from public.likes
      where from_user = new.from_user and kind = 'date' and not coalesce(is_dove, false) and created_at >= date_trunc('day', now());
    if used >= lim.daily_likes then raise exception 'LIKE_LIMIT'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.usage_limits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  lim record;
  day_start timestamptz := date_trunc('day', now());
  week_start timestamptz := date_trunc('week', now());
  likes_used integer;
  doves_used integer;
  waves_used integer;
  reveals_total integer;
  reveals_week integer;
  reveals_used integer;
  reveals_limit integer;
  starter integer := 10;
begin
  if me is null then raise exception 'Not allowed'; end if;
  select * into lim from public.plan_limits(me);
  if lim is null then raise exception 'No profile'; end if;
  select count(*) into likes_used from public.likes where from_user = me and kind = 'date' and not coalesce(is_dove, false) and created_at >= day_start;
  select count(*) into doves_used from public.likes where from_user = me and kind = 'date' and coalesce(is_dove, false) and created_at >= week_start;
  select count(*) into waves_used from public.likes where from_user = me and kind = 'friend' and created_at >= day_start;
  select count(*) into reveals_total from public.spark_reveals where user_id = me;
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
    'wavesUsed', waves_used, 'wavesLimit', lim.daily_waves,
    'revealsUsed', reveals_used, 'revealsLimit', reveals_limit,
    'starterRevealsLeft', greatest(0, starter - reveals_total),
    'likesResetAt', day_start + interval '1 day',
    'dovesResetAt', week_start + interval '7 days'
  );
end;
$$;
revoke all on function public.usage_limits() from public, anon;
grant execute on function public.usage_limits() to authenticated;
