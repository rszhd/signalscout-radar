-- US-511: Radar stops reading X, and the owner hid its posts at once
-- (2026-11-03). Taken down at one fixed time, so they can be told apart from
-- a post taken down on a complaint and shown again with
--   update requests set removed_at = null
--   where platform = 'x' and removed_at = '2026-11-03 00:00:00+00';
update requests set removed_at = '2026-11-03 00:00:00+00'
where platform = 'x' and removed_at is null;
