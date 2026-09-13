-- Run this in Supabase SQL Editor
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
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'confirmed', 'declined')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE date_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view date invitations in their matches"
  ON date_invitations FOR SELECT USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = date_invitations.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

CREATE POLICY "Users can create date invitations"
  ON date_invitations FOR INSERT WITH CHECK (
    auth.uid() = from_user AND EXISTS (SELECT 1 FROM matches WHERE matches.id = date_invitations.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

CREATE POLICY "Users can update date invitations in their matches"
  ON date_invitations FOR UPDATE USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = date_invitations.match_id
      AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );
