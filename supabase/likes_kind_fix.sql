-- If waving at someone you once liked on the dating side fails with "duplicate key", an old
-- one-like-per-person rule is still on the likes table. This removes any such constraint or index
-- and keeps only the one-per-kind rule. Safe to run more than once.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.likes'::regclass and contype = 'u'
      and conname <> 'likes_from_to_kind_key'
  loop
    execute format('alter table public.likes drop constraint %I', r.conname);
  end loop;
  for r in
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'likes'
      and indexdef ilike '%unique%' and indexname <> 'likes_from_to_kind_key' and indexname <> 'likes_pkey'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end $$;
create unique index if not exists likes_from_to_kind_key on public.likes (from_user, to_user, kind);

-- What is left (for checking): every unique rule on likes
select conname as rule, pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid = 'public.likes'::regclass and contype in ('u', 'p')
union all
select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'likes' and indexdef ilike '%unique%';
