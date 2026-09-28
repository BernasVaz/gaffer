-- Feedback: a tester writes their own and reads nobody's.
--
-- The read case is the one worth testing hardest. Free text about a game
-- somebody is annoyed with is not always something they would want another
-- player to find, and the protection is the *absence* of a select policy —
-- which is exactly the kind of thing that gets added back by someone being
-- helpful. A test is how that stays absent.

begin;
create schema if not exists tests;
select plan(9);

insert into auth.users (id, is_anonymous) values
  ('ffff1111-1111-1111-1111-111111111111', true),
  ('ffff2222-2222-2222-2222-222222222222', true);

create or replace function tests.act_as(who uuid) returns void as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims to %L',
    json_build_object('sub', who::text, 'role', 'authenticated')::text);
end;
$$ language plpgsql;

grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

select tests.act_as('ffff1111-1111-1111-1111-111111111111');

select lives_ok(
  $$insert into public.feedback (author, kind, body, rating, meta)
    values ('ffff1111-1111-1111-1111-111111111111', 'note', 'too many 0% options', 3,
            '{"seed":123,"mode":"11v11","build":"alpha-freeze-6"}'::jsonb)$$,
  'a tester writes their own feedback'
);

select throws_ok(
  $$insert into public.feedback (author, body)
    values ('ffff2222-2222-2222-2222-222222222222', 'not mine')$$,
  '42501',
  null,
  'NEGATIVE: and cannot write it in somebody else''s name'
);

select is_empty(
  $$select id from public.feedback$$,
  'NEGATIVE: a tester cannot read back even their own feedback'
);

select tests.act_as('ffff2222-2222-2222-2222-222222222222');

select is_empty(
  $$select id from public.feedback$$,
  'NEGATIVE: and certainly not anybody else''s'
);

-- The rows really are there; it is RLS hiding them rather than nothing landing.
reset role;
select is(
  (select count(*)::integer from public.feedback),
  1,
  'the feedback is in the table — it is row-level security hiding it, not a failed write'
);

-- Shape.
select throws_ok(
  $$insert into public.feedback (author, rating) values
    ('ffff1111-1111-1111-1111-111111111111', 9)$$,
  '23514',
  null,
  'NEGATIVE: a rating outside one to five is refused'
);

select throws_ok(
  format(
    $$insert into public.feedback (author, body) values
      ('ffff1111-1111-1111-1111-111111111111', %L)$$,
    repeat('x', 4001)
  ),
  '23514',
  null,
  'NEGATIVE: an implausibly long body is refused'
);

select lives_ok(
  $$insert into public.feedback (author) values ('ffff1111-1111-1111-1111-111111111111')$$,
  'an empty note is still feedback — flagging a moment at all is signal'
);

-- The volume cap.
-- Filled to exactly the cap, counted rather than assumed: rows already written
-- above count towards it, and an arithmetic guess here would silently test
-- nothing.
do $$
declare
  cap integer := public.feedback_per_hour();
  written integer;
begin
  loop
    select count(*) into written from public.feedback
     where author = 'ffff1111-1111-1111-1111-111111111111';
    exit when written >= cap;
    insert into public.feedback (author, body)
      values ('ffff1111-1111-1111-1111-111111111111', 'note ' || written);
  end loop;
end $$;

select throws_ok(
  $$insert into public.feedback (author, body)
    values ('ffff1111-1111-1111-1111-111111111111', 'one too many')$$,
  '23514',
  'too much feedback in the last hour',
  'NEGATIVE: and a loop is bounded'
);

select * from finish();
rollback;
