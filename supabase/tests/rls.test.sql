-- Row-level security and the append-only trigger, which together are Phase 1's
-- integrity spine (ADR 0029). The server does not run the engine here, so these
-- policies are the only thing standing between a shared match and a rewritten
-- one — and they are written in a language the rest of the codebase's type
-- checker cannot see. Hence: tested before a player ever touches them.
--
-- Run with `supabase test db`.

begin;
create schema if not exists tests;
select plan(21);

-- Two players and a stranger. Anonymous users, as Phase 1 issues (ADR 0030).
insert into auth.users (id, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true),
  ('33333333-3333-3333-3333-333333333333', true);

-- Become a given player, the way PostgREST does it.
create or replace function tests.act_as(who uuid) returns void as $$
begin
  execute format('set local role authenticated');
  execute format(
    'set local request.jwt.claims to %L',
    json_build_object('sub', who::text, 'role', 'authenticated')::text
  );
end;
$$ language plpgsql;

create or replace function tests.act_as_nobody() returns void as $$
begin
  execute 'set local role anon';
  execute 'set local request.jwt.claims to ''{"role":"anon"}''';
end;
$$ language plpgsql;

-- The helpers have to be callable *after* we have dropped into a player's role,
-- which is the whole point of them.
grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

-- ---------------------------------------------------------------------------
-- Creating a match
-- ---------------------------------------------------------------------------

select tests.act_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$insert into public.matches (id, setup, seed, engine_edition, home_user, turn_owner)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '{"mode":"5v5"}'::jsonb, 1, 4,
            '11111111-1111-1111-1111-111111111111',
            '11111111-1111-1111-1111-111111111111')$$,
  'home creates its own match'
);

select throws_ok(
  $$insert into public.matches (setup, seed, engine_edition, home_user)
    values ('{"mode":"5v5"}'::jsonb, 2, 4, '22222222-2222-2222-2222-222222222222')$$,
  '42501',
  null,
  'a player cannot create a match in somebody else''s name'
);

select throws_ok(
  $$insert into public.matches (setup, seed, engine_edition, home_user, command_log)
    values ('{"mode":"5v5"}'::jsonb, 3, 4,
            '11111111-1111-1111-1111-111111111111', '[{"type":"endTurn"}]'::jsonb)$$,
  '42501',
  null,
  'a match cannot be created with a log already in it'
);

-- ---------------------------------------------------------------------------
-- NEGATIVE: a stranger sees nothing and writes nothing
-- ---------------------------------------------------------------------------

-- Close the seat so the match is no longer open to whoever holds the link.
update public.matches
   set away_user = '22222222-2222-2222-2222-222222222222',
       status = 'in_play',
       log_version = log_version + 1
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select tests.act_as('33333333-3333-3333-3333-333333333333');

select is_empty(
  $$select id from public.matches where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'NEGATIVE: a non-player cannot read the match'
);

select lives_ok(
  $$update public.matches set log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a non-player''s update is not an error...'
);

-- Checked as a player: the stranger cannot see the row either, so asking them
-- what it says would prove nothing.
select tests.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select log_version from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'NEGATIVE: ...it simply matches no rows, so nothing moved'
);

-- ---------------------------------------------------------------------------
-- NEGATIVE: the side not to move cannot write
-- ---------------------------------------------------------------------------

select tests.act_as('22222222-2222-2222-2222-222222222222');

select is(
  (select turn_owner from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'it is home to play'
);

select lives_ok(
  $$update public.matches
       set command_log = command_log || '[{"type":"endTurn"}]'::jsonb,
           log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'away tries to move out of turn...'
);

select is(
  (select jsonb_array_length(command_log) from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'NEGATIVE: ...and the log is untouched'
);

-- ---------------------------------------------------------------------------
-- The side to move may append
-- ---------------------------------------------------------------------------

select tests.act_as('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$update public.matches
       set command_log = command_log || '[{"type":"endTurn","team":"home"}]'::jsonb,
           log_version = log_version + 1,
           turn_owner = '22222222-2222-2222-2222-222222222222',
           state_hash = 'abc123'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'
       and log_version = 1$$,
  'the side to move appends, and hands the turn over'
);

select is(
  (select jsonb_array_length(command_log) from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'the command landed'
);

select isnt(
  (select last_move_at from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'the trigger stamped last_move_at'
);

-- ---------------------------------------------------------------------------
-- NEGATIVE: a stale version writes nothing
-- ---------------------------------------------------------------------------

select tests.act_as('22222222-2222-2222-2222-222222222222');

select lives_ok(
  $$update public.matches
       set command_log = command_log || '[{"type":"endTurn","team":"away"}]'::jsonb,
           log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'
       and log_version = 1$$,
  'a client that saw version 1 tries to append...'
);

select is(
  (select log_version from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2,
  'NEGATIVE: ...matches no rows, because the row is on 2 — the double-tap is a no-op'
);

-- ---------------------------------------------------------------------------
-- NEGATIVE: history cannot be rewritten
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.matches
       set command_log = '[{"type":"shoot","playerId":"forged"}]'::jsonb,
           log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null,
  'the command log may not be rewritten',
  'NEGATIVE: the log cannot be replaced wholesale'
);

select throws_ok(
  $$update public.matches
       set command_log = '[]'::jsonb, log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null,
  'the command log may not shrink',
  'NEGATIVE: the log cannot be truncated'
);

select throws_ok(
  $$update public.matches set seed = 999, log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null,
  'a match''s identity is fixed at creation',
  'NEGATIVE: the seed cannot be changed under a running match'
);

select throws_ok(
  $$update public.matches set engine_edition = 3, log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null,
  'a match''s identity is fixed at creation',
  'NEGATIVE: a match cannot be moved to another rules edition'
);

select throws_ok(
  $$update public.matches set log_version = log_version + 5
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null,
  null,
  'NEGATIVE: log_version cannot jump'
);

-- ---------------------------------------------------------------------------
-- NEGATIVE: the away seat cannot be hijacked
-- ---------------------------------------------------------------------------

select tests.act_as('33333333-3333-3333-3333-333333333333');

select lives_ok(
  $$update public.matches
       set away_user = '33333333-3333-3333-3333-333333333333',
           log_version = log_version + 1
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a stranger tries to take a seat that is taken...'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select away_user from public.matches
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'NEGATIVE: ...and the seat is still away''s'
);

select * from finish();
rollback;
