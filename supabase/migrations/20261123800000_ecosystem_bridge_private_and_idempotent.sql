-- EAI-08 (bridge hardening): bridge tables private + inbound idempotency.
--
-- Measured on production 2026-11-23, signed in as the test user: SELECT on
-- ecosystem_config returned the Pulse and Logos Vision rows with their
-- 64-char inbound_token and service_token. "Users can view ..." policies let
-- every signed-in user read ecosystem_config, ecosystem_events (every org's
-- event payloads) and ecosystem_entity_map; anon/authenticated held ALL
-- privileges on the four bridge tables. Every reader is the service role
-- (backend supabaseAdmin, ecosystem-inbound); no frontend file and no SQL
-- function reads them, so the browser roles lose nothing.

drop policy if exists "Users can view ecosystem config" on public.ecosystem_config;
drop policy if exists "Users can view ecosystem events" on public.ecosystem_events;
drop policy if exists "Users can view entity mappings" on public.ecosystem_entity_map;

revoke all on public.ecosystem_config, public.ecosystem_events,
  public.ecosystem_entity_map, public.ecosystem_alerts
  from anon, authenticated;

-- A replayed inbound event id is a duplicate, never routed twice
-- (0 duplicate (source, event_id) inbound pairs on 2026-11-23).
create unique index if not exists ux_ecosystem_events_inbound_event
  on public.ecosystem_events (source, event_id)
  where direction = 'inbound';
