-- Profile details (wants children, church attendance, lifestyle...) as a JSON object keyed by field. Run once in the Supabase SQL editor.
alter table public.profiles add column if not exists details jsonb not null default '{}'::jsonb;
