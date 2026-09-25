-- Let clients watch a match row change.
--
-- Realtime only forwards tables that are in this publication, and a table is
-- not in it by default. Without this the "your turn" notification silently
-- never arrives: no error, no failed subscription, just a player waiting for a
-- board that has already moved. It cost an end-to-end test to find.
--
-- Row-level security still applies to what is forwarded, so a player is only
-- ever told about a match they could have read anyway.
alter publication supabase_realtime add table public.matches;

-- Realtime needs the whole old row to decide who may see a change; the default
-- only carries the primary key.
alter table public.matches replica identity full;
