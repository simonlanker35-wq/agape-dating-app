-- Show-up / no-show ratings after a confirmed date. Run once in the Supabase SQL editor.
create table if not exists public.date_feedback (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid references public.date_invitations(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  showed_up boolean not null,
  created_at timestamptz not null default now(),
  unique (invitation_id, from_user)
);

alter table public.date_feedback enable row level security;

-- Everyone can read ratings (they are shown on profiles); you can only rate your own dates.
create policy "date_feedback_read_all" on public.date_feedback
  for select using (true);

create policy "date_feedback_insert_own" on public.date_feedback
  for insert with check (auth.uid() = from_user);

create index if not exists date_feedback_to_user_idx on public.date_feedback (to_user);
