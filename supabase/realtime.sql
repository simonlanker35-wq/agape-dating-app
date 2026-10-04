-- Live updates for chat, matches and likes. Run once in the Supabase SQL editor.
-- Adds the tables to Supabase's realtime publication (skips any that are already in it).
-- Row level security still applies: people only receive changes to rows they are allowed to read.

do $$
declare
  t text;
begin
  foreach t in array array['messages', 'matches', 'likes', 'date_invitations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
