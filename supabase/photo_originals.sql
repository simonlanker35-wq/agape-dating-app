-- Full (downscaled) originals of profile photos, so a crop can be redone later. Run once in the Supabase SQL editor.
create table if not exists public.photo_originals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  originals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.photo_originals enable row level security;

create policy "photo_originals_own" on public.photo_originals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
