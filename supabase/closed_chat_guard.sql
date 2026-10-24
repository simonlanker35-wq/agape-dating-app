-- Enforce the closed-chat deadline in the database. Run once in the Supabase SQL editor.
-- The app already hides the message box once a dating chat has closed; this stops a message
-- being inserted directly through the API after it closes.
--
-- Deliberately FAILS OPEN: it blocks a message only in the clearly-closed case, and allows the
-- message on any doubt (a pause, a video call, an open or confirmed plan, a recently declined
-- plan, a rose). So it can never wrongly lock a chat that is still alive; at worst a late message
-- slips through, which is exactly today's behaviour. Friend chats never close.

create or replace function public.messages_deadline_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m record;
  first_ts timestamptz;
  deadline timestamptz;
begin
  if auth.uid() is null then return new; end if;                 -- SQL editor / service role
  select * into m from public.matches where id = new.match_id;
  if m is null then return new; end if;
  if coalesce(m.kind, 'date') <> 'date' then return new; end if;  -- friend chats have no deadline

  -- Anything that pauses or restarts the clock → allow the message.
  if coalesce(m.deadline_paused, false) then return new; end if;
  if m.video_call_at is not null and now() < m.video_call_at + interval '2 hours' then return new; end if;
  if exists (
    select 1 from public.date_invitations i
    where i.match_id = m.id and i.status in ('pending', 'responded', 'confirmed')
  ) then return new; end if;
  if exists (
    select 1 from public.date_invitations i
    where i.match_id = m.id and i.status = 'declined' and i.created_at > now() - interval '7 days'
  ) then return new; end if;                                      -- a recent cancel/decline buys fresh time

  select min(created_at) into first_ts from public.messages where match_id = m.id;
  if first_ts is null then return new; end if;                    -- this is the opening message

  deadline := first_ts + interval '5 days';
  if m.nudge_at is not null then deadline := deadline + interval '36 hours'; end if;  -- a rose adds time

  if now() > deadline then
    raise exception 'CHAT_CLOSED';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_deadline_guard on public.messages;
create trigger messages_deadline_guard before insert on public.messages
  for each row execute function public.messages_deadline_guard();
