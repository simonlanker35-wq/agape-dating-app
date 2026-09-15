-- Add deadline_paused and video_call_at columns to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deadline_paused boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS video_call_at timestamptz;
