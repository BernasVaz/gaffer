-- Asynchronous multiplayer, Phase 1 — the trust-based rung.
--
-- One row per match, holding the command log as jsonb with an optimistic
-- `log_version`. See docs/plans/async-multiplayer.md and ADR 0029.
--
-- The server does not run the engine here. It enforces *who* may append and
-- *when*, and the shape of an append; it cannot tell a legal command from an
-- illegal one. That is Phase 2's job. What makes Phase 1 defensible is that it
-- can detect its own failure — see `state_hash`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Deliberately minimal: a name to show on a scoreboard, and nothing else. An
-- alpha needs "who am I playing", not an identity system.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null check (char_length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Readable by anyone signed in: you have to be able to see who you are playing.
create policy "profiles are readable by signed-in players"
  on public.profiles for select
  to authenticated
  using (true);

create policy "a player writes only their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "a player updates only their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------

create type public.match_status as enum (
  'awaiting_opponent',  -- created, second seat unclaimed
  'in_play',
  'complete',           -- the engine decided it
  'sealed'              -- an engine edition moved under it; read-only forever
);

create table public.matches (
  id             uuid primary key default gen_random_uuid(),

  -- The two things a match reduces to. `setup` is the MatchSetup the client
  -- already speaks; `seed` is duplicated out of it only so a human can read it
  -- in the dashboard, and the client takes its value from `setup` so there is
  -- one source of truth (ADR 0029).
  setup          jsonb       not null,
  seed           bigint      not null,
  command_log    jsonb       not null default '[]'::jsonb,

  -- Optimistic lock. Every write to this row bumps it by exactly one, which is
  -- what makes a double-tap or a second tab a no-op rather than a double move.
  log_version    integer     not null default 0,

  -- The rules this match is being played under. Pinned at creation, never
  -- changed: a command log does not survive a rules change (ADR 0022), so a
  -- match whose edition has moved is sealed rather than migrated.
  engine_edition integer     not null,

  -- The appending client's view of the board it just produced. The opponent
  -- recomputes and compares; a mismatch is a desync, and naming the command it
  -- happened at is the whole point of Phase 1 being honest about its own limits.
  state_hash     text,

  home_user      uuid        not null references auth.users (id) on delete cascade,
  away_user      uuid        references auth.users (id) on delete set null,

  status         public.match_status not null default 'awaiting_opponent',
  turn_owner     uuid,

  -- Derived from the log by replay, stored so a lobby can list matches without
  -- replaying every one. A CACHE, never read back into gameplay: the log is the
  -- truth, and `state_hash` is what catches these drifting from it.
  turn_number    integer     not null default 1,
  result         jsonb,
  winner         text        check (winner in ('home', 'away')),

  created_at     timestamptz not null default now(),
  last_move_at   timestamptz,

  constraint sides_differ check (away_user is null or away_user <> home_user),
  constraint turn_owner_is_a_player check (
    turn_owner is null or turn_owner in (home_user, away_user)
  )
);

create index matches_home_user_idx on public.matches (home_user);
create index matches_away_user_idx on public.matches (away_user);
create index matches_open_seat_idx on public.matches (status) where away_user is null;

alter table public.matches enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — the Phase 1 guardrail
-- ---------------------------------------------------------------------------

-- Read: the two players, and nobody else. A match id is shared as an invite
-- link, so an unclaimed match must also be readable by whoever holds the link —
-- otherwise they cannot see what they are joining.
create policy "a match is readable by its players"
  on public.matches for select
  to authenticated
  using (
    home_user = (select auth.uid())
    or away_user = (select auth.uid())
    or (status = 'awaiting_opponent' and away_user is null)
  );

create policy "a player creates their own match"
  on public.matches for insert
  to authenticated
  with check (
    home_user = (select auth.uid())
    and away_user is null
    and status = 'awaiting_opponent'
    and log_version = 0
    and command_log = '[]'::jsonb
  );

-- Write: either you are claiming the empty seat, or it is your turn.
--
-- `expected_log_version` is not expressed here — it is the client's
-- `where log_version = $expected` predicate, which makes the update affect zero
-- rows when somebody moved first. What this policy decides is *who* may write
-- at all; the trigger below decides what a write may change.
create policy "the side to move, or somebody taking the empty seat"
  on public.matches for update
  to authenticated
  using (
    status in ('awaiting_opponent', 'in_play')
    and (
      turn_owner = (select auth.uid())
      or (status = 'awaiting_opponent' and away_user is null)
    )
  )
  with check (
    home_user = (select auth.uid())
    or away_user = (select auth.uid())
  );

-- No delete policy at all: a match is never removed. An abandoned one is a
-- product question (docs/plans/async-multiplayer.md), not a row to drop.

-- ---------------------------------------------------------------------------
-- What an update may change
-- ---------------------------------------------------------------------------

-- RLS says who may write. This says what a write may do — which RLS cannot,
-- because a policy sees the new row but cannot compare it against the old one.
--
-- Without this, a player whose turn it legitimately is could rewrite history:
-- replace the whole log, change the seed, or move the match to a different
-- rules edition. None of those are "an illegal command" — they are a different
-- match wearing the same id, and no amount of Phase 2 validation would catch
-- them, because Phase 2 validates commands rather than rows.
create function public.matches_guard_update()
returns trigger
language plpgsql
as $$
begin
  -- Immutable for the life of the match.
  if new.id <> old.id
     or new.seed <> old.seed
     or new.setup is distinct from old.setup
     or new.engine_edition <> old.engine_edition
     or new.home_user <> old.home_user
     or new.created_at <> old.created_at then
    raise exception 'a match''s identity is fixed at creation';
  end if;

  -- A seat is claimed once and never traded.
  if old.away_user is not null and new.away_user is distinct from old.away_user then
    raise exception 'the away seat is already taken';
  end if;

  -- A finished or sealed match is read-only.
  if old.status in ('complete', 'sealed') then
    raise exception 'this match is over';
  end if;

  -- Exactly one step, every time. This is the optimistic lock's other half:
  -- the client says which version it saw, and this says the next one is the
  -- only one it may write.
  if new.log_version <> old.log_version + 1 then
    raise exception 'log_version must advance by exactly one (% -> %)',
      old.log_version, new.log_version;
  end if;

  -- Append-only. The log may grow; what is already in it is history.
  if jsonb_array_length(new.command_log) < jsonb_array_length(old.command_log) then
    raise exception 'the command log may not shrink';
  end if;

  if old.command_log <> '[]'::jsonb
     and new.command_log -> 0 is distinct from old.command_log -> 0 then
    raise exception 'the command log may not be rewritten';
  end if;

  if jsonb_path_query_array(
       new.command_log,
       ('$[0 to ' || greatest(jsonb_array_length(old.command_log) - 1, 0) || ']')::jsonpath
     ) is distinct from old.command_log
     and jsonb_array_length(old.command_log) > 0 then
    raise exception 'the command log may not be rewritten';
  end if;

  new.last_move_at := now();
  return new;
end;
$$;

create trigger matches_guard_update
  before update on public.matches
  for each row
  execute function public.matches_guard_update();
