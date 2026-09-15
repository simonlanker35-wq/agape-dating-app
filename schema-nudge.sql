-- Run this in Supabase SQL Editor
ALTER TABLE matches ADD COLUMN IF NOT EXISTS nudge_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deadline_paused boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS video_call_at timestamptz;
ALTER TABLE date_invitations ADD COLUMN IF NOT EXISTS decline_reasons jsonb DEFAULT '[]';
