-- Hardening pass over what the alpha stores about people.
--
-- Two of these close gaps found by auditing the shipped feature against the
-- threat it actually faces: **the anon key is public, so anybody can mint a
-- session.** Row-level security is not one wall among several — it is the wall.
-- A policy that is merely "signed in" is a policy that is open to the internet.

-- ---------------------------------------------------------------------------
-- 1 · A display name is not public
-- ---------------------------------------------------------------------------

-- `profiles` allowed any authenticated user to read every row. Since anybody can
-- sign in anonymously in one request, that made the whole table — every display
-- name every tester has chosen — readable by anyone who found the project URL.
--
-- Nothing needed it. The one place a name is shown is beside an opponent, so
-- the policy is "mine, or somebody I am actually playing".
drop policy if exists "profiles are readable by signed-in players" on public.profiles;

create policy "a profile is readable by its owner and their opponents"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
        from public.matches
       where (matches.home_user = (select auth.uid()) and matches.away_user = profiles.id)
          or (matches.away_user = (select auth.uid()) and matches.home_user = profiles.id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2 · A note is a sentence, not a payload
-- ---------------------------------------------------------------------------

-- 4,000 characters was a guess at "surely nobody types more than this". 2,000
-- is still far more than anyone writes in a box that says "what happened?", and
-- the point of the limit is not to ration feedback — it is that a body field
-- with no practical ceiling is a place to put a megabyte.
alter table public.feedback
  drop constraint if exists feedback_body_check;

alter table public.feedback
  add constraint feedback_body_check check (char_length(body) <= 2000);

-- And the metadata, which nobody types but everybody sends. A user agent is
-- attacker-controlled text like any other.
alter table public.feedback
  add constraint feedback_meta_size check (length(meta::text) <= 8000);

-- ---------------------------------------------------------------------------
-- 3 · Feedback is never broadcast
-- ---------------------------------------------------------------------------

-- Realtime forwards changes for tables in this publication, subject to RLS.
-- `feedback` must never be in it: there is no select policy, so nothing *would*
-- be forwarded — but relying on the absence of one policy to keep a broadcast
-- channel shut is a thin guarantee to leave implicit.
--
-- Written as a removal rather than a comment so it is true even if somebody adds
-- it by hand in the dashboard and forgets.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedback'
  ) then
    alter publication supabase_realtime drop table public.feedback;
  end if;
end $$;

-- Same for profiles: a name changing is nobody's business but the two players
-- looking at it, and they are reading it rather than subscribing to it.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime drop table public.profiles;
  end if;
end $$;
