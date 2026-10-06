-- Security hardening. Run once in the Supabase SQL editor, after settings_safety.sql.
-- Closes: forced matches, editable messages, readable emails/coordinates/Stripe IDs,
-- client-writable billing columns, fake and world-readable ratings.

-- ── 1. Matches ───────────────────────────────────────────────────────────────
-- A match is created only by this function, and only when both people have liked each other.
drop policy if exists "Users can create matches" on public.matches;

create or replace function public.create_match_if_mutual(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing uuid;
  created uuid;
begin
  if me is null or p_other is null or p_other = me then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.likes where from_user = me and to_user = p_other)
     or not exists (select 1 from public.likes where from_user = p_other and to_user = me) then
    return null;
  end if;
  select id into existing from public.matches
    where (user1 = me and user2 = p_other) or (user1 = p_other and user2 = me) limit 1;
  if existing is not null then return existing; end if;
  insert into public.matches (user1, user2) values (me, p_other) returning id into created;
  return created;
end;
$$;
grant execute on function public.create_match_if_mutual(uuid) to authenticated;

-- Participants may update a match (rose, video call, pause) but never who is in it.
create or replace function public.matches_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.id := old.id;
    new.user1 := old.user1;
    new.user2 := old.user2;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists matches_guard on public.matches;
create trigger matches_guard before update on public.matches
  for each row execute function public.matches_guard();

-- ── 2. Messages ──────────────────────────────────────────────────────────────
-- Only the read flag and reactions can change after sending; the content and the sender are fixed.
create or replace function public.messages_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.id := old.id;
    new.match_id := old.match_id;
    new.sender := old.sender;
    new.text := old.text;
    new.created_at := old.created_at;
    new.media_type := old.media_type;
    new.media_url := old.media_url;
    new.media_duration := old.media_duration;
    new.reply_to := old.reply_to;
  end if;
  return new;
end;
$$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before update on public.messages
  for each row execute function public.messages_guard();

-- Only your own messages can be deleted. Unmatching deletes the match, and its messages go with it.
drop policy if exists "Users can delete messages in own matches" on public.messages;
drop policy if exists "Users can delete own messages" on public.messages;
create policy "Users can delete own messages" on public.messages
  for delete using (auth.uid() = sender);

-- ── 3. Profiles: what other members may see ───────────────────────────────────
-- Other people's profiles are read through this view. It leaves out email, phone, billing fields,
-- notification settings and the dove count, and rounds the location to about 1 km.
drop view if exists public.profiles_public;
create view public.profiles_public as
  select
    p.id, p.name, p.age, p.height, p.gender, p.denomination, p.job, p.school, p.location_city,
    round(p.location_lat::numeric, 2)::float8 as location_lat,
    round(p.location_lng::numeric, 2)::float8 as location_lng,
    p.photos, p.prompts, p.interests, p.traits, p.who_are_you, p.looking_for, p.bio, p.filters,
    p.is_active, p.is_standout, p.compatibility_reason, p.verified_photos, p.details, p.paused,
    p.last_active, p.created_at
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

-- The table itself is now readable only for your own row.
drop policy if exists "Authenticated users can read active profiles" on public.profiles;

-- Billing and identity columns cannot be written from the app.
create or replace function protect_admin_columns_fn()
returns trigger as $$
begin
  if current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role' then
    return new;
  end if;
  if auth.uid() is null then
    return new; -- SQL editor / dashboard
  end if;
  if new.subscription_status is distinct from old.subscription_status then raise exception 'Cannot modify subscription_status from client'; end if;
  if new.doves is distinct from old.doves then raise exception 'Cannot modify doves from client'; end if;
  if new.is_active is distinct from old.is_active then raise exception 'Cannot modify is_active from client'; end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then raise exception 'Cannot modify stripe_customer_id from client'; end if;
  if new.subscription_id is distinct from old.subscription_id then raise exception 'Cannot modify subscription_id from client'; end if;
  if new.is_standout is distinct from old.is_standout then raise exception 'Cannot modify is_standout from client'; end if;
  if new.email is distinct from old.email then raise exception 'Cannot modify email from client'; end if;
  return new;
end;
$$ language plpgsql security definer;

-- ── 4. Ratings ───────────────────────────────────────────────────────────────
-- You can only rate the other person of a confirmed date in your own match, and you read only your own ratings.
drop policy if exists "date_feedback_read_all" on public.date_feedback;
drop policy if exists "date_feedback_read_own" on public.date_feedback;
create policy "date_feedback_read_own" on public.date_feedback
  for select using (auth.uid() = from_user);

drop policy if exists "date_feedback_insert_own" on public.date_feedback;
drop policy if exists "date_feedback_insert_participant" on public.date_feedback;
create policy "date_feedback_insert_participant" on public.date_feedback
  for insert with check (
    auth.uid() = from_user
    and from_user <> to_user
    and exists (
      select 1 from public.date_invitations i
      join public.matches m on m.id = i.match_id
      where i.id = date_feedback.invitation_id
        and m.id = date_feedback.match_id
        and i.status = 'confirmed'
        and ((m.user1 = auth.uid() and m.user2 = date_feedback.to_user)
          or (m.user2 = auth.uid() and m.user1 = date_feedback.to_user))
    )
  );

-- Show-up counts shown on profiles come from this function, not from the raw rows.
create or replace function public.reliability_for(p_ids uuid[])
returns table (user_id uuid, dates integer, no_shows integer)
language sql security definer set search_path = public as $$
  select to_user, count(*)::integer, (count(*) filter (where not showed_up))::integer
  from public.date_feedback
  where to_user = any(p_ids)
  group by to_user;
$$;
grant execute on function public.reliability_for(uuid[]) to authenticated;
