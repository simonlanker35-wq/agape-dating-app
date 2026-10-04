-- Replying to a specific message, photo or voice note. Run once in the Supabase SQL editor.
-- A reply remembers which message it answers. If that message is deleted, the reply stays and
-- simply loses the quote.

alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null;
