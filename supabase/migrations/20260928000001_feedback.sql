-- Feedback, sent rather than downloaded.
--
-- Notes lived in one browser's local storage and left it only if the tester
-- remembered to export a Markdown file and send it. Across a wave that means
-- silence is indistinguishable from "nothing to report", which is a poor thing
-- for an alpha to be unable to tell apart.
--
-- So it is written here as it is typed. The tester still types at most a
-- sentence: everything else — which match, which rules, which build, which
-- device — is captured for them, because a tester should not be asked to
-- transcribe what the page already knows.

create type public.feedback_kind as enum (
  'note',    -- flagged mid-match
  'match',   -- the end-of-match summary
  'bug'
);

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- The anonymous identity that wrote it. Not a person: a browser.
  author     uuid        not null references auth.users (id) on delete cascade,

  kind       public.feedback_kind not null default 'note',

  -- What they actually wrote. May be empty: flagging a moment at all is signal,
  -- and demanding prose is how you get less feedback rather than better.
  body       text        not null default '' check (char_length(body) <= 4000),

  -- One tap, when they give one. 1 to 5.
  rating     smallint    check (rating is null or rating between 1 and 5),

  -- Everything the tester should not have to type: seed, mode, level, side,
  -- rules edition, the online match if there is one, the score and turn it
  -- happened at, the build tag, the device, the theme.
  --
  -- `jsonb` rather than columns because this is context for a human reading a
  -- dashboard, not something queried in anger — and a shape that will change
  -- every time we learn what we forgot to capture.
  meta       jsonb       not null default '{}'::jsonb
);

create index feedback_author_created_idx on public.feedback (author, created_at desc);
create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Write your own, and only your own.
create policy "a tester writes their own feedback"
  on public.feedback for insert
  to authenticated
  with check (author = (select auth.uid()));

-- **No select policy at all**, which with RLS on means nobody reads anything
-- through the API — not even their own. That is deliberate.
--
-- Feedback is free text, and the thing people type into a free-text box about a
-- game they are annoyed with is not always something they would want another
-- player to find. There is no feature that needs a client to read it back, so
-- there is no policy that lets one. It is read in the Supabase dashboard, which
-- goes through the service role and bypasses RLS by design.
--
-- Deliberately not "you may read your own" either: that is one policy edit away
-- from "you may read", and the only thing it would buy is a history screen
-- nobody asked for.

-- No update and no delete, for the same reason a command log is append-only:
-- feedback is a record of what somebody thought at a moment, and a record that
-- can be quietly revised is not one.

-- ---------------------------------------------------------------------------
-- A bound on volume
-- ---------------------------------------------------------------------------

/** Feedback rows one tester may write in an hour. */
create or replace function public.feedback_per_hour() returns integer
  language sql immutable as $$ select 200 $$;

-- Generous on purpose: a tester flagging every other action across a long match
-- is exactly the tester we want, and a limit they can feel is a limit that
-- teaches them to stop. This exists to stop a loop, not to ration anybody.
create function public.feedback_guard_insert()
returns trigger
language plpgsql
as $$
declare
  recent integer;
begin
  select count(*) into recent
    from public.feedback
   where author = new.author
     and created_at > now() - interval '1 hour';

  if recent >= public.feedback_per_hour() then
    raise exception 'too much feedback in the last hour'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger feedback_guard_insert
  before insert on public.feedback
  for each row
  execute function public.feedback_guard_insert();
