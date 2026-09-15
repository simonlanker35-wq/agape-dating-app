-- ============================================
-- Agape Dating App - Complete Supabase Schema
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE)
-- ============================================

-- 1. PROFILES
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text not null,
  age int not null,
  height int,
  gender text not null check (gender in ('male', 'female')),
  denomination text,
  job text,
  school text,
  location_city text,
  location_lat float,
  location_lng float,
  photos text[] default '{}',
  prompts jsonb default '[]',
  interests text[] default '{}',
  bio text default '',
  doves int default 3,
  filters jsonb default '{"minAge": 18, "maxAge": 50, "maxDistance": 80, "denomination": ""}',
  is_active boolean default true,
  is_standout boolean default false,
  compatibility_reason text,
  stripe_customer_id text,
  subscription_status text default 'none',
  subscription_id text,
  last_active timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. LIKES
create table if not exists likes (
  id uuid default gen_random_uuid() primary key,
  from_user uuid references profiles(id) on delete cascade not null,
  to_user uuid references profiles(id) on delete cascade not null,
  target_type text default 'profile' check (target_type in ('photo', 'prompt', 'profile')),
  target_index int default 0,
  comment text,
  is_dove boolean default false,
  created_at timestamptz default now(),
  unique(from_user, to_user)
);

-- 3. SKIPS
create table if not exists skips (
  id uuid default gen_random_uuid() primary key,
  from_user uuid references profiles(id) on delete cascade not null,
  to_user uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(from_user, to_user)
);

-- 4. MATCHES
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  user1 uuid references profiles(id) on delete cascade not null,
  user2 uuid references profiles(id) on delete cascade not null,
  last_activity timestamptz default now(),
  created_at timestamptz default now()
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS nudge_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deadline_paused boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS video_call_at timestamptz;

-- 5. MESSAGES
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  sender uuid references profiles(id) on delete cascade not null,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- 6. DATE INVITATIONS
create table if not exists date_invitations (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  from_user uuid references profiles(id) on delete cascade not null,
  date_type text not null,
  location text not null,
  wardrobe text,
  proposed_times jsonb default '[]',
  response_times jsonb default '[]',
  confirmed_time jsonb,
  decline_reasons jsonb default '[]',
  status text default 'pending' check (status in ('pending', 'responded', 'confirmed', 'declined')),
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_likes_from on likes(from_user);
create index if not exists idx_likes_to on likes(to_user);
create index if not exists idx_skips_from on skips(from_user);
create index if not exists idx_matches_user1 on matches(user1);
create index if not exists idx_matches_user2 on matches(user2);
create index if not exists idx_messages_match on messages(match_id);
create index if not exists idx_profiles_gender on profiles(gender);
create index if not exists idx_profiles_active on profiles(is_active);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table profiles enable row level security;
alter table likes enable row level security;
alter table skips enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table date_invitations enable row level security;

-- PROFILES
drop policy if exists "Anyone can view active profiles" on profiles;
create policy "Anyone can view active profiles"
  on profiles for select using (is_active = true);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- LIKES
drop policy if exists "Users can view own likes" on likes;
create policy "Users can view own likes"
  on likes for select using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "Users can send likes" on likes;
create policy "Users can send likes"
  on likes for insert with check (auth.uid() = from_user);

drop policy if exists "Users can delete own likes" on likes;
create policy "Users can delete own likes"
  on likes for delete using (auth.uid() = from_user or auth.uid() = to_user);

-- SKIPS
drop policy if exists "Users can view own skips" on skips;
create policy "Users can view own skips"
  on skips for select using (auth.uid() = from_user);

drop policy if exists "Users can insert skips" on skips;
create policy "Users can insert skips"
  on skips for insert with check (auth.uid() = from_user);

-- MATCHES
drop policy if exists "Users can view own matches" on matches;
create policy "Users can view own matches"
  on matches for select using (auth.uid() = user1 or auth.uid() = user2);

drop policy if exists "Users can create matches" on matches;
create policy "Users can create matches"
  on matches for insert with check (auth.uid() = user1 or auth.uid() = user2);

drop policy if exists "Users can update own matches" on matches;
create policy "Users can update own matches"
  on matches for update
  using (auth.uid() = user1 or auth.uid() = user2)
  with check (auth.uid() = user1 or auth.uid() = user2);

drop policy if exists "Users can delete own matches" on matches;
create policy "Users can delete own matches"
  on matches for delete using (auth.uid() = user1 or auth.uid() = user2);

-- MESSAGES
drop policy if exists "Users can view messages in own matches" on messages;
create policy "Users can view messages in own matches"
  on messages for select using (
    exists (select 1 from matches where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

drop policy if exists "Users can send messages in own matches" on messages;
create policy "Users can send messages in own matches"
  on messages for insert with check (
    auth.uid() = sender and exists (select 1 from matches where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

drop policy if exists "Users can mark messages as read" on messages;
create policy "Users can mark messages as read"
  on messages for update using (
    exists (select 1 from matches where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

drop policy if exists "Users can delete messages in own matches" on messages;
create policy "Users can delete messages in own matches"
  on messages for delete using (
    exists (select 1 from matches where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

-- DATE INVITATIONS
drop policy if exists "Users can view date invitations in their matches" on date_invitations;
create policy "Users can view date invitations in their matches"
  on date_invitations for select using (
    exists (select 1 from matches where matches.id = date_invitations.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

drop policy if exists "Users can create date invitations" on date_invitations;
create policy "Users can create date invitations"
  on date_invitations for insert with check (
    auth.uid() = from_user and exists (select 1 from matches where matches.id = date_invitations.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

drop policy if exists "Users can update date invitations in their matches" on date_invitations;
create policy "Users can update date invitations in their matches"
  on date_invitations for update using (
    exists (select 1 from matches where matches.id = date_invitations.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid()))
  );

-- ============================================
-- FUNCTION: Auto-update updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
