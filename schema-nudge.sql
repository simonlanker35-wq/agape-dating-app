-- Run this in Supabase SQL Editor
ALTER TABLE matches ADD COLUMN IF NOT EXISTS nudge_at timestamptz;
