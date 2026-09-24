-- Media for chat photos, chat voice notes and prompt voice answers. Run once in the Supabase SQL editor.

-- 1. Public bucket. Files are stored under <user id>/<kind>/<random>.<ext>, so URLs are unguessable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'])
on conflict (id) do nothing;

-- 2. Only the owner can upload or delete inside their own folder; anyone can read.
create policy "media_upload_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media_read" on storage.objects
  for select
  using (bucket_id = 'media');

-- 3. Messages can carry a photo or a voice note.
alter table public.messages
  add column if not exists media_type text,
  add column if not exists media_url text,
  add column if not exists media_duration integer;
