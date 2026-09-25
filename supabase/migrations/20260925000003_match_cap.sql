-- Bound how many matches one identity can create.
--
-- An anonymous sign-in costs nothing and takes no time — that is the property
-- that makes it good onboarding and the property an abuser wants. Supabase
-- rate-limits sign-ins per IP per hour, which blunts a naive script and does
-- nothing about a distributed one, and nothing at all about a single identity
-- creating matches in a loop.
--
-- So: a cap in the database, where the client cannot talk its way past it.
-- Deliberately loose. These numbers are meant to be invisible to a person
-- playing and obvious to a script; a tester who hits one has found a bug in
-- them, not in their own behaviour.

/** Matches one player may create in an hour. */
create or replace function public.matches_per_hour() returns integer
  language sql immutable as $$ select 30 $$;

/** Matches one player may have unfinished at once. */
create or replace function public.matches_unfinished_cap() returns integer
  language sql immutable as $$ select 50 $$;

create function public.matches_guard_insert()
returns trigger
language plpgsql
as $$
declare
  recent integer;
  open_matches integer;
begin
  select count(*) into recent
    from public.matches
   where home_user = new.home_user
     and created_at > now() - interval '1 hour';

  if recent >= public.matches_per_hour() then
    raise exception 'too many matches started in the last hour'
      using errcode = 'check_violation';
  end if;

  select count(*) into open_matches
    from public.matches
   where home_user = new.home_user
     and status in ('awaiting_opponent', 'in_play');

  if open_matches >= public.matches_unfinished_cap() then
    raise exception 'too many matches already going'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger matches_guard_insert
  before insert on public.matches
  for each row
  execute function public.matches_guard_insert();

-- The count above reads every match the player owns, so it wants an index that
-- answers "theirs, recently" without a scan.
create index matches_home_user_created_idx
  on public.matches (home_user, created_at desc);
