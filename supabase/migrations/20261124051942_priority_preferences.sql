ALTER TABLE public.action_items ADD COLUMN priority_correction jsonb;

CREATE INDEX action_items_priority_corrections_idx
  ON public.action_items (org_id, (priority_correction->>'scopeKey'))
  WHERE priority_correction IS NOT NULL;

-- Keep agent recommendations and both kinds of correction evidence server-written.
CREATE OR REPLACE FUNCTION public.protect_action_item_owner_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.agent_notes IS NOT NULL OR NEW.owner_correction IS NOT NULL OR NEW.priority_correction IS NOT NULL THEN
        RAISE EXCEPTION 'Agent evidence is written by the server' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.agent_notes IS DISTINCT FROM OLD.agent_notes
       OR NEW.owner_correction IS DISTINCT FROM OLD.owner_correction
       OR NEW.priority_correction IS DISTINCT FROM OLD.priority_correction THEN
      RAISE EXCEPTION 'Agent evidence is written by the server' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER protect_action_item_owner_evidence
  BEFORE INSERT OR UPDATE OF agent_notes, owner_correction, priority_correction ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_action_item_owner_evidence();

CREATE TABLE public.priority_preferences (
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  scope_key text NOT NULL CHECK (scope_key ~ '^[0-9a-f]{64}$'),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  meeting_title text NOT NULL,
  item_title text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'dismissed', 'disabled')),
  evidence jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, scope_key)
);

ALTER TABLE public.priority_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.priority_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.priority_preferences TO service_role;
