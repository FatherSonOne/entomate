-- Failure alerting for cross-app ecosystem traffic.
-- Populates ecosystem_alerts whenever an ecosystem_events row transitions
-- into status='failed'. Operators read + acknowledge via a future admin UI
-- (service-role only by default; tighten later when the UI lands).
--
-- Entomate variant: ecosystem_events here also has target_app + retry_count,
-- so we capture both into the alert row.

CREATE TABLE IF NOT EXISTS public.ecosystem_alerts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_row_id    uuid NOT NULL REFERENCES public.ecosystem_events(id) ON DELETE CASCADE,
    event_type      text NOT NULL,
    direction       text NOT NULL,
    source          text NOT NULL,
    target_app      text,
    error_message   text,
    payload         jsonb,
    retry_count     integer,
    acknowledged_at timestamptz,
    acknowledged_by uuid REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecosystem_alerts_unacked
    ON public.ecosystem_alerts(created_at DESC)
    WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ecosystem_alerts_event_row
    ON public.ecosystem_alerts(event_row_id);

CREATE OR REPLACE FUNCTION public.fn_ecosystem_alert_on_failure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'failed'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'failed') THEN
        INSERT INTO public.ecosystem_alerts (
            event_row_id, event_type, direction, source, target_app,
            error_message, payload, retry_count
        ) VALUES (
            NEW.id, NEW.event_type, NEW.direction, NEW.source, NEW.target_app,
            NEW.error_message, NEW.payload, NEW.retry_count
        );

        PERFORM pg_notify(
            'ecosystem_failure',
            jsonb_build_object(
                'id', NEW.id,
                'event_type', NEW.event_type,
                'direction', NEW.direction,
                'source', NEW.source,
                'target_app', NEW.target_app
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecosystem_alert_on_failure ON public.ecosystem_events;
CREATE TRIGGER trg_ecosystem_alert_on_failure
    AFTER INSERT OR UPDATE OF status ON public.ecosystem_events
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_ecosystem_alert_on_failure();

-- Backfill the last 14 days so the new admin UI has something to show.
INSERT INTO public.ecosystem_alerts (
    event_row_id, event_type, direction, source, target_app,
    error_message, payload, retry_count, created_at
)
SELECT ee.id, ee.event_type, ee.direction, ee.source, ee.target_app,
       ee.error_message, ee.payload, ee.retry_count, ee.created_at
FROM public.ecosystem_events ee
WHERE ee.status = 'failed'
  AND ee.created_at > NOW() - INTERVAL '14 days'
  AND NOT EXISTS (
      SELECT 1 FROM public.ecosystem_alerts ea WHERE ea.event_row_id = ee.id
  );

ALTER TABLE public.ecosystem_alerts ENABLE ROW LEVEL SECURITY;
-- No SELECT/UPDATE policies: locked to service_role until an admin UI ships.

COMMENT ON TABLE public.ecosystem_alerts IS
  'Auto-populated on ecosystem_events status=failed transitions. Read + acknowledged through service-role edge functions until an admin UI exists.';
