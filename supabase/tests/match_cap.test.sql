-- The per-user match cap. A script minting anonymous identities is bounded by
-- Supabase's per-IP sign-in limit; a single identity creating matches in a loop
-- is bounded here, where the client cannot talk its way past it.

begin;
create schema if not exists tests;
select plan(4);

insert into auth.users (id, is_anonymous)
  values ('aaaa1111-1111-1111-1111-111111111111', true);

create or replace function tests.act_as(who uuid) returns void as $$
begin
  execute 'set local role authenticated';
  execute format('set local request.jwt.claims to %L',
    json_build_object('sub', who::text, 'role', 'authenticated')::text);
end;
$$ language plpgsql;

grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

select tests.act_as('aaaa1111-1111-1111-1111-111111111111');

-- Right up to the hourly limit is fine.
do $$
declare limit_per_hour integer := public.matches_per_hour();
begin
  for index in 1..limit_per_hour loop
    insert into public.matches (setup, seed, engine_edition, home_user, turn_owner)
    values ('{"mode":"5v5"}'::jsonb, index, 4,
            'aaaa1111-1111-1111-1111-111111111111',
            'aaaa1111-1111-1111-1111-111111111111');
  end loop;
end $$;

select is(
  (select count(*)::integer from public.matches
    where home_user = 'aaaa1111-1111-1111-1111-111111111111'),
  public.matches_per_hour(),
  'a player may create matches right up to the hourly cap'
);

select throws_ok(
  $$insert into public.matches (setup, seed, engine_edition, home_user, turn_owner)
    values ('{"mode":"5v5"}'::jsonb, 9999, 4,
            'aaaa1111-1111-1111-1111-111111111111',
            'aaaa1111-1111-1111-1111-111111111111')$$,
  '23514',
  'too many matches started in the last hour',
  'NEGATIVE: and is stopped at it'
);

-- The cap counts only the player's own matches, so one abuser cannot lock
-- everybody else out.
reset role;
insert into auth.users (id, is_anonymous)
  values ('bbbb2222-2222-2222-2222-222222222222', true);
select tests.act_as('bbbb2222-2222-2222-2222-222222222222');

select lives_ok(
  $$insert into public.matches (setup, seed, engine_edition, home_user, turn_owner)
    values ('{"mode":"5v5"}'::jsonb, 1, 4,
            'bbbb2222-2222-2222-2222-222222222222',
            'bbbb2222-2222-2222-2222-222222222222')$$,
  'somebody else is unaffected by their neighbour hitting the cap'
);

-- Matches that finished do not count against the concurrent cap.
select tests.act_as('aaaa1111-1111-1111-1111-111111111111');
update public.matches
   set status = 'complete', log_version = log_version + 1
 where home_user = 'aaaa1111-1111-1111-1111-111111111111';

select is(
  (select count(*)::integer from public.matches
    where home_user = 'aaaa1111-1111-1111-1111-111111111111'
      and status in ('awaiting_opponent', 'in_play')),
  0,
  'finished matches stop counting against the concurrent cap'
);

select * from finish();
rollback;
