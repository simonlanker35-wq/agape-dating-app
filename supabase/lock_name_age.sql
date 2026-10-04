-- Name and age cannot be changed after sign-up. Run once in the Supabase SQL editor.
-- The app no longer offers these edits; this makes the database refuse them too, so nobody can
-- change them by calling the API directly. Corrections made here in the SQL editor still work.

create or replace function public.lock_profile_identity()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() is set for requests coming from the app; it is null in the SQL editor / service role
  if auth.uid() is not null then
    new.name := old.name;
    new.age := old.age;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_profile_identity on public.profiles;
create trigger lock_profile_identity
  before update on public.profiles
  for each row execute function public.lock_profile_identity();
