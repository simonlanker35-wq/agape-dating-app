-- Community points. Run once in the SQL editor, after community.sql (and the guard fix).
-- Points are kept by the database: +1 for a post, +1 for writing a reply, +3 when someone replies to
-- your post, +2 when someone says Amen to it. Your own Amens and replies on your own post give nothing.

alter table public.profiles add column if not exists community_points integer not null default 0;

-- shown with the name in the community, so the public view carries it
drop view if exists public.profiles_public;
create view public.profiles_public as
  select
    p.id, p.name, p.age, p.height, p.gender, p.denomination, p.job, p.school, p.location_city,
    round(p.location_lat::numeric, 2)::float8 as location_lat,
    round(p.location_lng::numeric, 2)::float8 as location_lng,
    p.photos, p.prompts, p.interests, p.traits, p.who_are_you, p.looking_for, p.bio, p.filters,
    p.is_active, p.is_standout, p.compatibility_reason, p.verified_photos, p.details, p.paused,
    p.last_active, p.created_at, p.intent, p.community_points
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

-- nobody can give themselves points from the app
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
  return new;
end;
$$ language plpgsql security definer;

-- the points themselves are changed only by these functions, which run with the database's rights
create or replace function public.community_add_points(p_user uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.profiles set community_points = greatest(0, community_points + p_delta) where id = p_user;
$$;
revoke all on function public.community_add_points(uuid, integer) from public, anon, authenticated;

create or replace function public.community_points_posts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.community_add_points(new.author, 1); return new;
  else perform public.community_add_points(old.author, -1); return old; end if;
end;
$$;
drop trigger if exists community_points_posts on public.community_posts;
create trigger community_points_posts after insert or delete on public.community_posts
  for each row execute function public.community_points_posts();

create or replace function public.community_points_replies()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record := case when tg_op = 'INSERT' then new else old end;
  sign integer := case when tg_op = 'INSERT' then 1 else -1 end;
  post_author uuid;
begin
  select author into post_author from public.community_posts where id = r.post_id;
  perform public.community_add_points(r.author, sign * 1);
  if post_author is not null and post_author <> r.author then
    perform public.community_add_points(post_author, sign * 3);
  end if;
  return r;
end;
$$;
drop trigger if exists community_points_replies on public.community_replies;
create trigger community_points_replies after insert or delete on public.community_replies
  for each row execute function public.community_points_replies();

create or replace function public.community_points_amens()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record := case when tg_op = 'INSERT' then new else old end;
  sign integer := case when tg_op = 'INSERT' then 1 else -1 end;
  post_author uuid;
begin
  select author into post_author from public.community_posts where id = r.post_id;
  if post_author is not null and post_author <> r.user_id then
    perform public.community_add_points(post_author, sign * 2);
  end if;
  return r;
end;
$$;
drop trigger if exists community_points_amens on public.community_amens;
create trigger community_points_amens after insert or delete on public.community_amens
  for each row execute function public.community_points_amens();

-- give existing posts, replies and Amens their points once
update public.profiles p set community_points = s.pts from (
  select u.id,
    (select count(*) from public.community_posts where author = u.id)
    + (select count(*) from public.community_replies where author = u.id)
    + 3 * (select count(*) from public.community_replies r join public.community_posts cp on cp.id = r.post_id where cp.author = u.id and r.author <> u.id)
    + 2 * (select count(*) from public.community_amens a join public.community_posts cp on cp.id = a.post_id where cp.author = u.id and a.user_id <> u.id)
    as pts
  from public.profiles u
) s where s.id = p.id and p.community_points <> s.pts;
