-- Fix: the post guard blocked the Amen and reply counters. Run once.
create or replace function public.community_posts_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.id := old.id;
    new.author := old.author;
    new.category := old.category;
    new.title := old.title;
    new.body := old.body;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
