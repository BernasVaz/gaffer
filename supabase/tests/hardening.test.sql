-- The standing whole-app access test.
--
-- One premise, and it is the one that matters: **the anon key is public and
-- anybody can mint a session in a single request.** So "authenticated" is not a
-- trust boundary — an arbitrary stranger is authenticated. Every table is
-- checked from a token that belongs to nobody in particular.

begin;
create schema if not exists tests;
select plan(12);

insert into auth.users (id, is_anonymous) values
  ('11110000-0000-0000-0000-000000000001', true),  -- home
  ('22220000-0000-0000-0000-000000000002', true),  -- away
  ('33330000-0000-0000-0000-000000000003', true);  -- a stranger off the street

create or replace function tests.act_as(who uuid) returns void as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims to %L',
    json_build_object('sub', who::text, 'role', 'authenticated')::text);
end;
$$ language plpgsql;

grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

insert into public.profiles (id, display_name) values
  ('11110000-0000-0000-0000-000000000001', 'Home'),
  ('22220000-0000-0000-0000-000000000002', 'Away'),
  ('33330000-0000-0000-0000-000000000003', 'Stranger');

insert into public.matches (id, setup, seed, engine_edition, home_user, away_user, status, turn_owner)
values ('dddd0000-0000-0000-0000-00000000000d', '{"mode":"5v5"}'::jsonb, 1, 4,
        '11110000-0000-0000-0000-000000000001',
        '22220000-0000-0000-0000-000000000002', 'in_play',
        '11110000-0000-0000-0000-000000000001');

insert into public.feedback (author, body) values
  ('11110000-0000-0000-0000-000000000001', 'home said this'),
  ('22220000-0000-0000-0000-000000000002', 'away said this');

-- ---------------------------------------------------------------------------
-- 1 · An arbitrary token reads all rows → gets its own, or nothing
-- ---------------------------------------------------------------------------

select tests.act_as('33330000-0000-0000-0000-000000000003');

select is_empty(
  $$select id from public.feedback$$,
  'NEGATIVE: a stranger reading all feedback gets nothing'
);

select is_empty(
  $$select id from public.matches$$,
  'NEGATIVE: a stranger reading all matches gets nothing'
);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'NEGATIVE: a stranger reading all profiles gets only their own'
);

select is(
  (select display_name from public.profiles),
  'Stranger',
  'and that one is theirs'
);

-- A player, meanwhile, sees their opponent and nobody else.
select tests.act_as('11110000-0000-0000-0000-000000000001');

select set_eq(
  $$select display_name from public.profiles$$,
  $$values ('Home'), ('Away')$$,
  'a player sees their own name and their opponent''s — and no further'
);

select is_empty(
  $$select id from public.feedback$$,
  'NEGATIVE: and still cannot read feedback, not even their own'
);

-- ---------------------------------------------------------------------------
-- 2 · Input is bounded, and hostile input is just text
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.feedback (author, body) values
    ('11110000-0000-0000-0000-000000000001', %L)$$, repeat('x', 2001)),
  '23514',
  null,
  'NEGATIVE: a body past the cap is refused'
);

select throws_ok(
  format($$insert into public.feedback (author, meta) values
    ('11110000-0000-0000-0000-000000000001', %L::jsonb)$$,
    '{"userAgent":"' || repeat('y', 8000) || '"}'),
  '23514',
  null,
  'NEGATIVE: and so is an implausible user agent'
);

-- SQL in a feedback body is a string. It is parameterised on the way in, so
-- there is nothing to escape and nothing to execute — this asserts that what
-- comes back out is byte-for-byte what went in.
select lives_ok(
  $$insert into public.feedback (author, body) values
    ('11110000-0000-0000-0000-000000000001', '''); drop table feedback;--')$$,
  'a SQL payload in a note is accepted as text'
);

reset role;
select is(
  (select body from public.feedback
    where body like '%drop table%'),
  '''); drop table feedback;--',
  'and stored literally, character for character'
);

select has_table('public', 'feedback', 'the table is, as it happens, still there');

-- ---------------------------------------------------------------------------
-- 3 · Nothing sensitive is broadcast
-- ---------------------------------------------------------------------------

select is_empty(
  $$select tablename from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename in ('feedback', 'profiles')$$,
  'NEGATIVE: feedback and profiles are not on Realtime'
);

select * from finish();
rollback;
