-- ============================================================
-- AGAPE DATING APP — Complete Supabase Setup
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS)
-- Last updated: 2026-09-17
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  age int NOT NULL,
  height int,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  denomination text,
  job text,
  school text,
  location_city text,
  location_lat float,
  location_lng float,
  photos text[] DEFAULT '{}',
  prompts jsonb DEFAULT '[]',
  interests text[] DEFAULT '{}',
  traits text[] DEFAULT '{}',
  who_are_you text[] DEFAULT '{}',
  looking_for text[] DEFAULT '{}',
  bio text DEFAULT '',
  doves int DEFAULT 3,
  filters jsonb DEFAULT '{"minAge": 18, "maxAge": 50, "maxDistance": 80, "denomination": ""}',
  is_active boolean DEFAULT true,
  is_standout boolean DEFAULT false,
  compatibility_reason text,
  stripe_customer_id text,
  subscription_status text DEFAULT 'none',
  subscription_id text,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. LIKES
CREATE TABLE IF NOT EXISTS likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_type text DEFAULT 'profile' CHECK (target_type IN ('photo', 'prompt', 'profile')),
  target_index int DEFAULT 0,
  comment text,
  is_dove boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user, to_user)
);

-- 3. SKIPS
CREATE TABLE IF NOT EXISTS skips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user, to_user)
);

-- 4. MATCHES
CREATE TABLE IF NOT EXISTS matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user1 uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2 uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_activity timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS nudge_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deadline_paused boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS video_call_at timestamptz;

-- 5. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  sender uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 6. DATE INVITATIONS
CREATE TABLE IF NOT EXISTS date_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  from_user uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date_type text NOT NULL,
  location text NOT NULL,
  wardrobe text,
  proposed_times jsonb DEFAULT '[]',
  response_times jsonb DEFAULT '[]',
  confirmed_time jsonb,
  decline_reasons jsonb DEFAULT '[]',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'confirmed', 'declined')),
  created_at timestamptz DEFAULT now()
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_likes_from ON likes(from_user);
CREATE INDEX IF NOT EXISTS idx_likes_to ON likes(to_user);
CREATE INDEX IF NOT EXISTS idx_skips_from ON skips(from_user);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE date_invitations ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──

-- Drop all existing profile SELECT policies
DROP POLICY IF EXISTS "Anyone can view active profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read active profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- SECURITY FIX: Only logged-in users can browse profiles (prevents email harvesting)
CREATE POLICY "Authenticated users can read active profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Users can always read their own profile even if inactive
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ── LIKES ──

DROP POLICY IF EXISTS "Users can view own likes" ON likes;
CREATE POLICY "Users can view own likes"
  ON likes FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "Users can send likes" ON likes;
CREATE POLICY "Users can send likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = from_user);

DROP POLICY IF EXISTS "Users can delete own likes" ON likes;
CREATE POLICY "Users can delete own likes"
  ON likes FOR DELETE
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- ── SKIPS ──

DROP POLICY IF EXISTS "Users can view own skips" ON skips;
CREATE POLICY "Users can view own skips"
  ON skips FOR SELECT
  USING (auth.uid() = from_user);

DROP POLICY IF EXISTS "Users can insert skips" ON skips;
CREATE POLICY "Users can insert skips"
  ON skips FOR INSERT
  WITH CHECK (auth.uid() = from_user);

-- ── MATCHES ──

DROP POLICY IF EXISTS "Users can view own matches" ON matches;
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT
  USING (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "Users can create matches" ON matches;
CREATE POLICY "Users can create matches"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "Users can update own matches" ON matches;
CREATE POLICY "Users can update own matches"
  ON matches FOR UPDATE
  USING (auth.uid() = user1 OR auth.uid() = user2)
  WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "Users can delete own matches" ON matches;
CREATE POLICY "Users can delete own matches"
  ON matches FOR DELETE
  USING (auth.uid() = user1 OR auth.uid() = user2);

-- ── MESSAGES ──

DROP POLICY IF EXISTS "Users can view messages in own matches" ON messages;
CREATE POLICY "Users can view messages in own matches"
  ON messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can send messages in own matches" ON messages;
CREATE POLICY "Users can send messages in own matches"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender
    AND EXISTS (SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete messages in own matches" ON messages;
CREATE POLICY "Users can delete messages in own matches"
  ON messages FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM matches
      WHERE matches.id = messages.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

-- ── DATE INVITATIONS ──

DROP POLICY IF EXISTS "Users can view date invitations in their matches" ON date_invitations;
CREATE POLICY "Users can view date invitations in their matches"
  ON date_invitations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM matches
      WHERE matches.id = date_invitations.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create date invitations" ON date_invitations;
CREATE POLICY "Users can create date invitations"
  ON date_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (SELECT 1 FROM matches
      WHERE matches.id = date_invitations.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update date invitations in their matches" ON date_invitations;
CREATE POLICY "Users can update date invitations in their matches"
  ON date_invitations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM matches
      WHERE matches.id = date_invitations.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );


-- ============================================================
-- SECURITY: Protect admin-only columns from client updates
-- (subscription_status, doves, is_active can only be changed
--  by service_role, i.e. Stripe webhook / edge functions)
-- ============================================================

DROP TRIGGER IF EXISTS protect_admin_columns ON profiles;
DROP FUNCTION IF EXISTS protect_admin_columns_fn();

CREATE OR REPLACE FUNCTION protect_admin_columns_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role (edge functions, webhooks) can update anything
  IF current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Regular authenticated users cannot change these columns
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot modify subscription_status from client';
  END IF;

  IF NEW.doves IS DISTINCT FROM OLD.doves THEN
    RAISE EXCEPTION 'Cannot modify doves from client';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Cannot modify is_active from client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_admin_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_admin_columns_fn();


-- ============================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- VERIFY: Show all policies (run this part to confirm)
-- ============================================================

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'likes', 'skips', 'matches', 'messages', 'date_invitations')
ORDER BY tablename, policyname;
