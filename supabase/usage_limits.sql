-- Like, Dove and reveal limits enforced by the database. Run once in the Supabase SQL editor,
-- after security_hardening.sql.
-- Free: 8 likes a day, 1 Dove a week, 1 Sparks reveal a week. Agape+: 15 likes a day, 3 Doves a week,
-- unlimited reveals. Days and weeks are counted in UTC; a week starts on Monday.

-- ── Who has been revealed in Sparks ─────────────────────────────────────────
create table if not exists public.spark_reveals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  like_id uuid not null references public.likes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, like_id)
);
alter table public.spark_reveals enable row level security;

drop policy if exists "spark_reveals_select_own" on public.spark_reveals;
create policy "spark_reveals_select_own" on public.spark_reveals
  for select using (auth.uid() = user_id);

-- You can only reveal a like that was sent to you
drop policy if exists "spark_reveals_insert_own" on public.spark_reveals;
create policy "spark_reveals_insert_own" on public.spark_reveals
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.likes l where l.id = like_id and l.to_user = auth.uid())
  );

create index if not exists spark_reveals_user_idx on public.spark_reveals (user_id, created_at);
create index if not exists likes_from_user_created_idx on public.likes (from_user, created_at);

-- ── The limits per plan ──────────────────────────────────────────────────────
create or replace function public.plan_limits(p_user uuid)
returns table (premium boolean, daily_likes integer, weekly_doves integer, weekly_reveals integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(p.subscription_status = 'active', false),
    case when p.subscription_status = 'active' then 15 else 8 end,
    case when p.subscription_status = 'active' then 3 else 1 end,
    case when p.subscription_status = 'active' then 1000000 else 1 end
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.plan_limits(uuid) from public, anon;

-- ── What the app shows: used and allowed, plus when the counters reset ───────
create or replace function public.usage_limits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  lim record;
  day_start timestamptz := date_trunc('day', now());
  week_start timestamptz := date_trunc('week', now());
  likes_used integer;
  doves_used integer;
  reveals_used integer;
begin
  if me is null then raise exception 'Not allowed'; end if;
  select * into lim from public.plan_limits(me);
  if lim is null then raise exception 'No profile'; end if;
  select count(*) into likes_used from public.likes where from_user = me and not coalesce(is_dove, false) and created_at >= day_start;
  select count(*) into doves_used from public.likes where from_user = me and coalesce(is_dove, false) and created_at >= week_start;
  select count(*) into reveals_used from public.spark_reveals where user_id = me and created_at >= week_start;
  return jsonb_build_object(
    'premium', lim.premium,
    'likesUsed', likes_used, 'likesLimit', lim.daily_likes,
    'dovesUsed', doves_used, 'dovesLimit', lim.weekly_doves,
    'revealsUsed', reveals_used, 'revealsLimit', lim.weekly_reveals,
    'likesResetAt', day_start + interval '1 day',
    'dovesResetAt', week_start + interval '7 days'
  );
end;
$$;
revoke all on function public.usage_limits() from public, anon;
grant execute on function public.usage_limits() to authenticated;

-- ── Likes and Doves: the database refuses the one too many ──────────────────
create or replace function public.enforce_like_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim record;
  used integer;
begin
  if auth.uid() is null then return new; end if; -- server functions and the SQL editor
  if new.from_user <> auth.uid() then raise exception 'Not allowed'; end if;
  select * into lim from public.plan_limits(new.from_user);
  if lim is null then return new; end if;
  if coalesce(new.is_dove, false) then
    select count(*) into used from public.likes
      where from_user = new.from_user and coalesce(is_dove, false) and created_at >= date_trunc('week', now());
    if used >= lim.weekly_doves then raise exception 'DOVE_LIMIT'; end if;
  else
    select count(*) into used from public.likes
      where from_user = new.from_user and not coalesce(is_dove, false) and created_at >= date_trunc('day', now());
    if used >= lim.daily_likes then raise exception 'LIKE_LIMIT'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_like_limits on public.likes;
create trigger enforce_like_limits before insert on public.likes
  for each row execute function public.enforce_like_limits();

-- ── Sparks reveals: free members get one a week ─────────────────────────────
create or replace function public.enforce_reveal_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim record;
  used integer;
begin
  if auth.uid() is null then return new; end if;
  select * into lim from public.plan_limits(new.user_id);
  if lim is null then return new; end if;
  select count(*) into used from public.spark_reveals
    where user_id = new.user_id and created_at >= date_trunc('week', now());
  if used >= lim.weekly_reveals then raise exception 'REVEAL_LIMIT'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_reveal_limit on public.spark_reveals;
create trigger enforce_reveal_limit before insert on public.spark_reveals
  for each row execute function public.enforce_reveal_limit();

-- ── Tidy-up from security_hardening.sql: these are for signed-in members only ─
revoke all on function public.create_match_if_mutual(uuid) from public, anon;
revoke all on function public.reliability_for(uuid[]) from public, anon;
