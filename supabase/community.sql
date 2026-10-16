-- Community: forum-style posts and replies on the friends side. Run once in the SQL editor, after friends_mode.sql.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'general' check (category in ('prayer', 'faith', 'meetups', 'life', 'church', 'general')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  reply_count integer not null default 0,
  amen_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.community_amens (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists community_posts_activity_idx on public.community_posts (last_activity desc);
create index if not exists community_posts_category_idx on public.community_posts (category, last_activity desc);
create index if not exists community_replies_post_idx on public.community_replies (post_id, created_at);

alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_amens enable row level security;

-- Every signed-in member can read; you write as yourself and can only remove your own
drop policy if exists "community_posts_read" on public.community_posts;
create policy "community_posts_read" on public.community_posts for select using (auth.uid() is not null);
drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts for insert with check (auth.uid() = author);
drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own" on public.community_posts for delete using (auth.uid() = author);

drop policy if exists "community_replies_read" on public.community_replies;
create policy "community_replies_read" on public.community_replies for select using (auth.uid() is not null);
drop policy if exists "community_replies_insert_own" on public.community_replies;
create policy "community_replies_insert_own" on public.community_replies for insert with check (auth.uid() = author);
drop policy if exists "community_replies_delete_own" on public.community_replies;
create policy "community_replies_delete_own" on public.community_replies for delete using (auth.uid() = author);

drop policy if exists "community_amens_read" on public.community_amens;
create policy "community_amens_read" on public.community_amens for select using (auth.uid() is not null);
drop policy if exists "community_amens_insert_own" on public.community_amens;
create policy "community_amens_insert_own" on public.community_amens for insert with check (auth.uid() = user_id);
drop policy if exists "community_amens_delete_own" on public.community_amens;
create policy "community_amens_delete_own" on public.community_amens for delete using (auth.uid() = user_id);

-- Counters and the last-activity time are kept by the database, never by the app
create or replace function public.community_reply_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set reply_count = reply_count + 1, last_activity = now() where id = new.post_id;
    return new;
  else
    update public.community_posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;
drop trigger if exists community_reply_counter on public.community_replies;
create trigger community_reply_counter after insert or delete on public.community_replies
  for each row execute function public.community_reply_counter();

create or replace function public.community_amen_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set amen_count = amen_count + 1 where id = new.post_id;
    return new;
  else
    update public.community_posts set amen_count = greatest(0, amen_count - 1) where id = old.post_id;
    return old;
  end if;
end;
$$;
drop trigger if exists community_amen_counter on public.community_amens;
create trigger community_amen_counter after insert or delete on public.community_amens
  for each row execute function public.community_amen_counter();

-- Posts cannot be rewritten once published; only the counters and the activity time may change
-- (the counter triggers run inside a member's request, so they must pass this guard)
create or replace function public.community_posts_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.id := old.id;
    new.author := old.author;
    new.category := old.category;
    new.title := old.title;
    new.body := old.body;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard before update on public.community_posts
  for each row execute function public.community_posts_guard();

-- Live updates for the community (ignore the error if the tables are already in the publication)
do $$
begin
  alter publication supabase_realtime add table public.community_posts;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.community_replies;
exception when duplicate_object then null;
end $$;
