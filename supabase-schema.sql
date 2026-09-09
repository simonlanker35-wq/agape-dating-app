-- ============================================
-- Agape Dating App - Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. PROFILES TABLE
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
  last_active timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. LIKES TABLE
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

-- 3. SKIPS TABLE
create table if not exists skips (
  id uuid default gen_random_uuid() primary key,
  from_user uuid references profiles(id) on delete cascade not null,
  to_user uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(from_user, to_user)
);

-- 4. MATCHES TABLE
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  user1 uuid references profiles(id) on delete cascade not null,
  user2 uuid references profiles(id) on delete cascade not null,
  last_activity timestamptz default now(),
  created_at timestamptz default now()
);

-- 5. MESSAGES TABLE
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  sender uuid references profiles(id) on delete cascade not null,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES for performance
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
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table likes enable row level security;
alter table skips enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;

-- PROFILES: anyone can read active profiles, users can update own
create policy "Anyone can view active profiles"
  on profiles for select
  using (is_active = true);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- LIKES: users can see likes they sent or received, can insert own
create policy "Users can view own likes"
  on likes for select
  using (auth.uid() = from_user or auth.uid() = to_user);

create policy "Users can send likes"
  on likes for insert
  with check (auth.uid() = from_user);

create policy "Users can delete own likes"
  on likes for delete
  using (auth.uid() = from_user);

-- SKIPS: users can manage own skips
create policy "Users can view own skips"
  on skips for select
  using (auth.uid() = from_user);

create policy "Users can insert skips"
  on skips for insert
  with check (auth.uid() = from_user);

-- MATCHES: users can see their own matches
create policy "Users can view own matches"
  on matches for select
  using (auth.uid() = user1 or auth.uid() = user2);

create policy "Users can create matches"
  on matches for insert
  with check (auth.uid() = user1 or auth.uid() = user2);

-- MESSAGES: users can see messages in their matches
create policy "Users can view messages in own matches"
  on messages for select
  using (
    exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid())
    )
  );

create policy "Users can send messages in own matches"
  on messages for insert
  with check (
    auth.uid() = sender
    and exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid())
    )
  );

create policy "Users can mark messages as read"
  on messages for update
  using (
    exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.user1 = auth.uid() or matches.user2 = auth.uid())
    )
  );

-- ============================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
