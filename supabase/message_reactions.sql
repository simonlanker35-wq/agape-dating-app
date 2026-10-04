-- Reactions on chat photos and voice notes. Run once in the Supabase SQL editor.

-- Who reacted with what, stored on the message as { "<user id>": "<emoji>" }
alter table public.messages
  add column if not exists reactions jsonb not null default '{}'::jsonb;

-- Sets or clears the caller's reaction in one atomic step, so two people reacting at the same
-- moment cannot overwrite each other. Runs with the caller's own rights: the existing message
-- policies decide who may touch a message (only the two people in that match).
create or replace function public.react_to_message(p_message_id uuid, p_emoji text)
returns jsonb
language sql
as $$
  update public.messages
  set reactions = case
    when coalesce(p_emoji, '') = '' then coalesce(reactions, '{}'::jsonb) - auth.uid()::text
    else coalesce(reactions, '{}'::jsonb) || jsonb_build_object(auth.uid()::text, left(p_emoji, 8))
  end
  where id = p_message_id
  returning reactions;
$$;

grant execute on function public.react_to_message(uuid, text) to authenticated;
