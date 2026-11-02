-- Likes with picks and a comment. Run once in the Supabase SQL editor, after the app update is live.
-- Safe to run more than once.
--
-- A dating like (or Dove) now carries 3 to 5 things the sender likes about the other person
-- ("highlights": their values, goals, lifestyle, interests) and a comment of at least 3 words.
-- Accepting a Spark is a like back: it needs the picks but no comment.
-- Waves on the friends side are unchanged.

alter table public.likes add column if not exists highlights text[] not null default '{}';

create or replace function public.enforce_like_content()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  picks integer := coalesce(cardinality(new.highlights), 0);
  available integer := 0;
  words integer;
  answering boolean;
begin
  if auth.uid() is null then return new; end if;           -- admin and service scripts
  if coalesce(new.kind, 'date') <> 'date' then
    new.highlights := '{}';                                 -- waves carry no picks
    return new;
  end if;

  if picks > 5 or exists (select 1 from unnest(new.highlights) h where length(h) > 80) then
    raise exception 'LIKE_HIGHLIGHTS';
  end if;

  -- A profile with fewer than 3 things filled in only needs as many picks as it has
  select
      (case when jsonb_typeof(to_jsonb(p.traits)) = 'array' then jsonb_array_length(to_jsonb(p.traits)) else 0 end)
    + (case when jsonb_typeof(to_jsonb(p.interests)) = 'array' then jsonb_array_length(to_jsonb(p.interests)) else 0 end)
    + (case when jsonb_typeof(p.details) = 'object' then (
         select count(*) from jsonb_each_text(p.details) d
         where d.key in ('wantsChildren', 'lookingFor', 'churchAttendance', 'prayer', 'exercise', 'drinking', 'smoking', 'pets', 'education', 'relocate')
           and coalesce(d.value, '') <> ''
       ) else 0 end)
    into available
    from public.profiles p where p.id = new.to_user;
  if picks < least(3, coalesce(available, 0)) then
    raise exception 'LIKE_HIGHLIGHTS';
  end if;

  -- The comment: at least 3 words, unless this answers their like (accepting a Spark)
  select exists (
    select 1 from public.likes l
    where l.from_user = new.to_user and l.to_user = new.from_user and coalesce(l.kind, 'date') = 'date'
  ) into answering;
  words := cardinality(array_remove(regexp_split_to_array(btrim(coalesce(new.comment, '')), '\s+'), ''));
  if not answering and words < 3 then
    raise exception 'LIKE_COMMENT';
  end if;

  return new;
end;
$$;

drop trigger if exists likes_content_guard on public.likes;
create trigger likes_content_guard
  before insert on public.likes
  for each row execute function public.enforce_like_content();

-- Check: should list likes_content_guard
select tgname from pg_trigger where tgrelid = 'public.likes'::regclass and tgname = 'likes_content_guard';
