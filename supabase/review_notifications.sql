-- "Your photo has been reviewed" notifications. Run once in the Supabase SQL editor,
-- after photo_verifications.sql.

-- 1. Remember whether the push for a review was already sent
alter table public.photo_verifications
  add column if not exists notified_at timestamptz;

-- 2. A new upload from the app starts fresh: pending again, and not yet notified
create or replace function public.photo_verifications_force_pending()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.status := 'pending';
    new.note := null;
    new.reviewed_at := null;
    new.notified_at := null;
    new.created_at := now();
  elsif new.status <> 'pending' and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

-- 3. When the team approves or rejects, ask the review-notify function to send the push
create extension if not exists pg_net;

create or replace function public.photo_verifications_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ksscosugtbdzgekrszck.supabase.co/functions/v1/review-notify',
    body := jsonb_build_object('user_id', new.user_id, 'kind', new.kind),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return null;
exception when others then
  -- never block a review because the notification could not be queued
  return null;
end;
$$;

drop trigger if exists photo_verifications_notify on public.photo_verifications;
create trigger photo_verifications_notify
  after update of status on public.photo_verifications
  for each row
  when (old.status is distinct from new.status and new.status in ('approved', 'rejected'))
  execute function public.photo_verifications_notify();

-- 4. Let the open app hear about the review immediately
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photo_verifications'
  ) then
    alter publication supabase_realtime add table public.photo_verifications;
  end if;
end $$;
