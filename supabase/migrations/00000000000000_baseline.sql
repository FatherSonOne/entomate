-- ============================================================================
-- Entomate — consolidated schema baseline (public)
-- Generated 2026-07-04 (S2 Track ③) from live prod (epftmicjaxrthmpyoguy) via
-- `supabase db dump --linked --schema public`, augmented with:
--   * public-schema extensions (vector, pg_trgm) — omitted by db dump
--   * public-schema extensions were the only real db-dump omission; triggers, tables,
--     policies, functions, indexes, comments all came through faithfully.
-- This file supersedes all pre-2026-07-04 migrations (archived in _archive/).
-- The remote ledger is repaired so this baseline is marked already-applied.
-- ============================================================================





SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';

-- Extensions living in the public schema (omitted by `supabase db dump --schema public`)
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";



CREATE OR REPLACE FUNCTION "public"."create_org_for_user"("p_name" "text", "p_slug" "text", "p_plan" "text" DEFAULT 'free'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
  v_display_name TEXT;
  v_ai_limit INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.tenant_organizations t ON t.id = om.org_id
    WHERE om.user_id = v_user_id
      AND t.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  DELETE FROM public.org_members
  WHERE user_id = v_user_id
    AND org_id IN (
      SELECT id FROM public.tenant_organizations
      WHERE deleted_at IS NOT NULL
    );

  CASE p_plan
    WHEN 'starter' THEN v_ai_limit := 500;
    WHEN 'pro' THEN v_ai_limit := 2000;
    WHEN 'business' THEN v_ai_limit := 10000;
    WHEN 'ecosystem' THEN v_ai_limit := 10000;
    ELSE v_ai_limit := 100;
  END CASE;

  INSERT INTO public.tenant_organizations (name, slug, plan, ai_monthly_limit, settings)
  VALUES (p_name, p_slug, p_plan, v_ai_limit, '{}')
  RETURNING id INTO v_org_id;

  SELECT
    COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', email),
    email
  INTO v_display_name, v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.org_members (org_id, user_id, role, user_name, user_email)
  VALUES (v_org_id, v_user_id, 'owner', v_display_name, v_email);

  RETURN v_org_id;
END;
$$;


ALTER FUNCTION "public"."create_org_for_user"("p_name" "text", "p_slug" "text", "p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ecosystem_alert_on_failure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fn_ecosystem_alert_on_failure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_collection_stats"("p_collection_name" "text") RETURNS TABLE("collection_name" "text", "document_count" bigint, "total_content_length" bigint, "avg_content_length" numeric, "earliest_document" timestamp with time zone, "latest_document" timestamp with time zone, "unique_sources" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.collection_name,
    COUNT(*) AS document_count,
    SUM(LENGTH(vd.content))::BIGINT AS total_content_length,
    AVG(LENGTH(vd.content)) AS avg_content_length,
    MIN(vd.created_at) AS earliest_document,
    MAX(vd.created_at) AS latest_document,
    COUNT(DISTINCT vd.source_id) AS unique_sources
  FROM vector_documents vd
  WHERE vd.collection_name = p_collection_name
  GROUP BY vd.collection_name;
END;
$$;


ALTER FUNCTION "public"."get_collection_stats"("p_collection_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_org_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_org_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vector_collections"() RETURNS TABLE("name" "text", "document_count" bigint, "last_updated" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.collection_name AS name,
    COUNT(*) AS document_count,
    MAX(vd.created_at) AS last_updated
  FROM vector_documents vd
  GROUP BY vd.collection_name
  ORDER BY document_count DESC;
END;
$$;


ALTER FUNCTION "public"."get_vector_collections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_org"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Owner-only guard
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the organization owner can permanently delete';
  END IF;

  -- Hard-delete — FK ON DELETE CASCADE handles org_members,
  -- org_invites, and org_ai_usage_monthly.
  -- User-owned data (projects, tasks, automations, agents) is NOT org-scoped
  -- and remains intact.
  DELETE FROM public.tenant_organizations
  WHERE id = p_org_id;
END;
$$;


ALTER FUNCTION "public"."hard_delete_org"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer DEFAULT 5, "vector_weight" double precision DEFAULT 0.7, "text_weight" double precision DEFAULT 0.3, "p_collection_name" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "vector_score" double precision, "text_score" double precision, "combined_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      vd.id,
      vd.content,
      vd.metadata,
      1 - (vd.embedding <=> query_embedding) AS v_score
    FROM vector_documents vd
    WHERE p_collection_name IS NULL OR vd.collection_name = p_collection_name
    ORDER BY vd.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  text_results AS (
    SELECT
      vd.id,
      ts_rank(to_tsvector('english', vd.content), websearch_to_tsquery('english', query_text)) AS t_score
    FROM vector_documents vd
    WHERE
      (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
      AND to_tsvector('english', vd.content) @@ websearch_to_tsquery('english', query_text)
    LIMIT match_count * 2
  )
  SELECT
    vr.id,
    vr.content,
    vr.metadata,
    vr.v_score AS vector_score,
    COALESCE(tr.t_score, 0) AS text_score,
    (vr.v_score * vector_weight) + (COALESCE(tr.t_score, 0) * text_weight) AS combined_score
  FROM vector_results vr
  LEFT JOIN text_results tr ON vr.id = tr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer, "vector_weight" double precision, "text_weight" double precision, "p_collection_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer, "vector_weight" double precision, "text_weight" double precision, "p_collection_name" "text") IS 'Combined vector and full-text search for improved relevance';



CREATE OR REPLACE FUNCTION "public"."increment_ai_usage"("p_org_id" "uuid", "p_month" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_month DATE;
BEGIN
  v_month := COALESCE(p_month, date_trunc('month', CURRENT_DATE)::DATE);

  INSERT INTO public.org_ai_usage_monthly (org_id, month, request_count)
  VALUES (p_org_id, v_month, 1)
  ON CONFLICT (org_id, month)
  DO UPDATE SET request_count = org_ai_usage_monthly.request_count + 1;
END;
$$;


ALTER FUNCTION "public"."increment_ai_usage"("p_org_id" "uuid", "p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_secret_expired"("p_secret_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT expires_at INTO v_expires_at FROM secrets WHERE id = p_secret_id;
  IF v_expires_at IS NULL THEN RETURN FALSE; END IF;
  RETURN v_expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."is_secret_expired"("p_secret_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_secret_create"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO secrets_audit_log (secret_id, secret_name, action, user_id, access_method)
  VALUES (NEW.id, NEW.name, 'created', NEW.user_id, 'api');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_secret_create"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_secret_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.encrypted_value IS DISTINCT FROM NEW.encrypted_value THEN
    INSERT INTO secrets_audit_log (secret_id, secret_name, action, user_id, access_method)
    VALUES (NEW.id, NEW.name, 'updated', auth.uid(), 'api');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_secret_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_org"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- Owner-only guard + 30-day window
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the organization owner can restore';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_organizations
    WHERE id = p_org_id
      AND deleted_at IS NOT NULL
      AND deleted_at > NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'Cannot restore: organization not found, not deleted, or past 30-day recovery window';
  END IF;

  UPDATE public.tenant_organizations
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = p_org_id;
END;
$$;


ALTER FUNCTION "public"."restore_org"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 20, "filter_source_types" "text"[] DEFAULT NULL::"text"[], "filter_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "filter_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("id" "uuid", "source_type" "text", "source_id" "text", "title" "text", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        sd.id,
        sd.source_type,
        sd.source_id,
        sd.title,
        sd.content,
        sd.metadata,
        1 - (sd.embedding <=> query_embedding) AS similarity
      FROM search_documents sd
      WHERE 1 - (sd.embedding <=> query_embedding) > match_threshold
        AND (filter_source_types IS NULL OR sd.source_type = ANY(filter_source_types))
        AND (filter_date_from IS NULL OR sd.indexed_at >= filter_date_from)
        AND (filter_date_to IS NULL OR sd.indexed_at <= filter_date_to)
      ORDER BY sd.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;


ALTER FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer DEFAULT 10, "similarity_threshold" double precision DEFAULT 0.5) RETURNS TABLE("id" "uuid", "content_type" "text", "source_id" "uuid", "source_type" "text", "text_content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
      BEGIN
        RETURN QUERY
        SELECT
          e.id,
          e.content_type,
          e.source_id,
          e.source_type,
          e.text_content,
          1 - (e.embedding <=> query_embedding) AS similarity
        FROM embeddings e
        WHERE 1 - (e.embedding <=> query_embedding) > similarity_threshold
        ORDER BY e.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;


ALTER FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_vectors_cosine"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5, "similarity_threshold" double precision DEFAULT 0.5, "p_collection_name" "text" DEFAULT NULL::"text", "metadata_filter" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id,
    vd.content,
    vd.metadata,
    1 - (vd.embedding <=> query_embedding) AS similarity
  FROM vector_documents vd
  WHERE
    (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
    AND (metadata_filter IS NULL OR vd.metadata @> metadata_filter)
    AND 1 - (vd.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY vd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_vectors_cosine"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_vectors_cosine"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") IS 'Search for similar documents using cosine similarity';



CREATE OR REPLACE FUNCTION "public"."search_vectors_euclidean"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5, "similarity_threshold" double precision DEFAULT 0.5, "p_collection_name" "text" DEFAULT NULL::"text", "metadata_filter" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "distance" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id,
    vd.content,
    vd.metadata,
    vd.embedding <-> query_embedding AS distance
  FROM vector_documents vd
  WHERE
    (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
    AND (metadata_filter IS NULL OR vd.metadata @> metadata_filter)
  ORDER BY vd.embedding <-> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_vectors_euclidean"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_vectors_inner_product"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5, "similarity_threshold" double precision DEFAULT 0.5, "p_collection_name" "text" DEFAULT NULL::"text", "metadata_filter" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    vd.id,
    vd.content,
    vd.metadata,
    (vd.embedding <#> query_embedding) * -1 AS score
  FROM vector_documents vd
  WHERE
    (p_collection_name IS NULL OR vd.collection_name = p_collection_name)
    AND (metadata_filter IS NULL OR vd.metadata @> metadata_filter)
  ORDER BY vd.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_vectors_inner_product"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_org"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check caller is owner or admin
  SELECT role INTO v_role
  FROM public.org_members
  WHERE org_id = p_org_id
    AND user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied: only owners and admins can archive an organization';
  END IF;

  UPDATE public.tenant_organizations
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE id = p_org_id
    AND deleted_at IS NULL;
END;
$$;


ALTER FUNCTION "public"."soft_delete_org"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ecosystem_config_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ecosystem_config_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_intelligence_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_intelligence_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_social_accounts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_social_accounts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vector_document_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_vector_document_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT org_id
  FROM public.org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."user_org_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_item_dependencies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action_item_id" "uuid" NOT NULL,
    "blocks_action_item_id" "uuid" NOT NULL,
    "detected_via" "text",
    "confidence" double precision,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "action_item_dependencies_confidence_check" CHECK ((("confidence" >= (0)::double precision) AND ("confidence" <= (1)::double precision))),
    CONSTRAINT "action_item_dependencies_detected_via_check" CHECK (("detected_via" = ANY (ARRAY['manual'::"text", 'ai_nlp'::"text", 'explicit'::"text"])))
);


ALTER TABLE "public"."action_item_dependencies" OWNER TO "postgres";


COMMENT ON TABLE "public"."action_item_dependencies" IS 'Blocking relationships between action items';



CREATE TABLE IF NOT EXISTS "public"."action_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "meeting_id" "uuid",
    "task_description" "text" NOT NULL,
    "context" "text",
    "assigned_to_email" character varying(255),
    "assigned_to_name" character varying(255),
    "assigned_to_id" "uuid",
    "due_date" "date",
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "crm_sync_status" character varying(20) DEFAULT 'pending'::character varying,
    "crm_task_id" character varying(256),
    "last_sync_attempt" timestamp with time zone,
    "last_sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "calendar_event_id" "text",
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."action_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_execution_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" "uuid",
    "agent_type" "text" NOT NULL,
    "trigger_type" "text",
    "input_context" "jsonb",
    "output_suggestion" "jsonb",
    "execution_time_ms" integer,
    "success" boolean DEFAULT true,
    "error_message" "text",
    "confidence" numeric(3,2),
    "feedback_rating" integer,
    "feedback_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_execution_logs_feedback_rating_check" CHECK ((("feedback_rating" >= 1) AND ("feedback_rating" <= 5)))
);


ALTER TABLE "public"."agent_execution_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "trigger_event" "jsonb",
    "trigger_type" character varying(100),
    "context_gathered" "jsonb" DEFAULT '{}'::"jsonb",
    "decisions" "jsonb" DEFAULT '[]'::"jsonb",
    "actions_executed" "jsonb" DEFAULT '[]'::"jsonb",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "duration_ms" integer,
    "feedback_rating" integer,
    "feedback_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_explanations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_execution_id" "uuid" NOT NULL,
    "agent_type" "text" NOT NULL,
    "recommendation" "jsonb" NOT NULL,
    "confidence" integer NOT NULL,
    "factors" "jsonb" NOT NULL,
    "alternatives" "jsonb" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_explanations_agent_type_check" CHECK (("agent_type" = ANY (ARRAY['assignment'::"text", 'priority'::"text", 'deadline'::"text", 'followup'::"text"]))),
    CONSTRAINT "agent_explanations_confidence_check" CHECK ((("confidence" >= 0) AND ("confidence" <= 100)))
);


ALTER TABLE "public"."agent_explanations" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_explanations" IS 'Stores transparent explanations for AI agent decisions including factors, scores, and alternatives';



COMMENT ON COLUMN "public"."agent_explanations"."agent_execution_id" IS 'Reference to the agent execution this explanation belongs to';



COMMENT ON COLUMN "public"."agent_explanations"."agent_type" IS 'Type of agent: assignment, priority, deadline, or followup';



COMMENT ON COLUMN "public"."agent_explanations"."recommendation" IS 'The recommended option/decision';



COMMENT ON COLUMN "public"."agent_explanations"."confidence" IS 'Confidence score from 0-100';



COMMENT ON COLUMN "public"."agent_explanations"."factors" IS 'Array of decision factors with weights, scores, and details';



COMMENT ON COLUMN "public"."agent_explanations"."alternatives" IS 'Array of alternative options that were considered';



COMMENT ON COLUMN "public"."agent_explanations"."metadata" IS 'Additional metadata about the explanation generation';



CREATE TABLE IF NOT EXISTS "public"."agent_overrides" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_type" "text" NOT NULL,
    "agent_execution_id" "uuid",
    "original_recommendation" "jsonb" NOT NULL,
    "user_choice" "jsonb" NOT NULL,
    "feedback_reason" "text",
    "feedback_text" "text",
    "context_snapshot" "jsonb" NOT NULL,
    "outcome_success" boolean,
    "outcome_metrics" "jsonb",
    "outcome_tracked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_overrides_agent_type_check" CHECK (("agent_type" = ANY (ARRAY['assignment'::"text", 'priority'::"text", 'deadline'::"text", 'followup'::"text"])))
);


ALTER TABLE "public"."agent_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_run_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_run_id" "uuid" NOT NULL,
    "step_index" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "input" "jsonb",
    "output" "jsonb",
    "error" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "agent_run_steps_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."agent_run_steps" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_run_steps" IS 'Individual steps within an agent run';



CREATE TABLE IF NOT EXISTS "public"."agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "trigger_event_id" "text",
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb",
    "error" "text",
    "attempt" integer DEFAULT 1 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "agent_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."agent_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_runs" IS 'Execution runs for agents; one row per invocation attempt';



CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "type" character varying(50) NOT NULL,
    "category" character varying(50) NOT NULL,
    "status" character varying(50) DEFAULT 'idle'::character varying,
    "description" "text",
    "last_activity" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "enabled" boolean DEFAULT true NOT NULL,
    "trigger_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "guardrails" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "text",
    CONSTRAINT "agents_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['engineering'::character varying, 'testing'::character varying, 'design'::character varying, 'pm'::character varying, 'marketing'::character varying, 'operations'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "agents_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['running'::character varying, 'idle'::character varying, 'paused'::character varying, 'error'::character varying])::"text"[]))),
    CONSTRAINT "agents_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['individual'::character varying, 'crew'::character varying, 'orchestrator'::character varying])::"text"[])))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."agents" IS 'Agent definitions consumed by the TypeScript agents framework';



CREATE TABLE IF NOT EXISTS "public"."ai_agents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" "text" DEFAULT 'default'::"text",
    "name" "text" NOT NULL,
    "description" "text",
    "agent_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "triggers" "jsonb" DEFAULT '[]'::"jsonb",
    "enabled" boolean DEFAULT true,
    "execution_count" integer DEFAULT 0,
    "success_rate" numeric(5,2) DEFAULT 0,
    "last_executed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "memory" "jsonb" DEFAULT '{}'::"jsonb",
    "icon" character varying(50) DEFAULT 'bot'::character varying,
    "trigger_type" "text",
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."ai_agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "user_id" "uuid",
    "organization_id" "uuid",
    "app_name" "text",
    "scopes" "text"[] DEFAULT '{}'::"text"[],
    "rate_limit_per_minute" integer DEFAULT 60,
    "rate_limit_per_day" integer DEFAULT 10000,
    "is_active" boolean DEFAULT true,
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "app_name" "text",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "automation_id" "uuid",
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trigger_data" "jsonb" DEFAULT '{}'::"jsonb",
    "actions_executed" "jsonb" DEFAULT '[]'::"jsonb",
    "success" boolean,
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_templates" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text",
    "icon" "text",
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "popular_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automation_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "trigger_type" character varying(100) NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "conditions" "jsonb" DEFAULT '[]'::"jsonb",
    "enabled" boolean DEFAULT true,
    "execution_count" integer DEFAULT 0,
    "last_executed_at" timestamp with time zone,
    "created_by" character varying(255) DEFAULT 'system'::character varying NOT NULL,
    "team_id" character varying(255) DEFAULT 'default'::character varying,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bot_session_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "opt_out_token_hash" "text" NOT NULL,
    "email_sent_at" timestamp with time zone,
    "email_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "email_error" "text",
    "email_provider_message_id" "text",
    "opted_out_at" timestamp with time zone,
    "opt_out_reason" "text",
    "opt_out_ip" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bot_session_attendees_email_status_check" CHECK (("email_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'bounced'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."bot_session_attendees" OWNER TO "postgres";


COMMENT ON TABLE "public"."bot_session_attendees" IS 'Per-meeting attendee records used for the pre-meeting opt-out email flow (P1.7 Slice 2).';



COMMENT ON COLUMN "public"."bot_session_attendees"."opt_out_token_hash" IS 'sha256 hex of the raw opt-out token. Raw token never persisted; lives only in the email link.';



COMMENT ON COLUMN "public"."bot_session_attendees"."email_status" IS 'pending: row created, email not yet attempted. sent: Resend accepted. failed: Resend rejected or threw. bounced: future webhook integration. skipped: RESEND_API_KEY unset (gated dev/missing-config path).';



CREATE TABLE IF NOT EXISTS "public"."bot_sessions" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "machine_id" "text",
    "meeting_url" "text",
    "failure_reason" "text",
    "callback_token_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "last_callback_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "recall_bot_id" "text",
    "recording_url" "text",
    "transcript_url" "text",
    "consent_acknowledged_at" timestamp with time zone,
    "consent_acknowledged_by" "uuid",
    "retention_deleted_at" timestamp with time zone,
    "retention_delete_error" "text",
    CONSTRAINT "bot_sessions_platform_check" CHECK (("platform" = ANY (ARRAY['meet'::"text", 'zoom'::"text", 'teams'::"text"]))),
    CONSTRAINT "bot_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'launching'::"text", 'joining'::"text", 'in_call'::"text", 'completed'::"text", 'failed'::"text", 'stopped'::"text", 'timeout'::"text"])))
);


ALTER TABLE "public"."bot_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."bot_sessions" IS 'Per-meeting bot session state. See P1.1 in docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md.';



COMMENT ON COLUMN "public"."bot_sessions"."machine_id" IS 'Legacy Fly Machine ID (pre-Recall pivot, see migration 20260425000001). Null for Recall-managed sessions.';



COMMENT ON COLUMN "public"."bot_sessions"."callback_token_hash" IS 'SHA-256 of the callback bearer token passed to the bot Machine. Raw token is never persisted.';



COMMENT ON COLUMN "public"."bot_sessions"."recall_bot_id" IS 'Recall.ai bot ID. Primary identifier for Recall-managed sessions.';



COMMENT ON COLUMN "public"."bot_sessions"."recording_url" IS 'Recall-hosted recording URL, populated on bot.recording.done webhook.';



COMMENT ON COLUMN "public"."bot_sessions"."transcript_url" IS 'Recall-hosted transcript URL, populated on bot.done webhook.';



COMMENT ON COLUMN "public"."bot_sessions"."consent_acknowledged_at" IS 'Timestamp the launching user affirmed they have consent from all participants. Required for new launches per P1.7.';



COMMENT ON COLUMN "public"."bot_sessions"."consent_acknowledged_by" IS 'auth.users.id of the user who acknowledged consent at launch (the organizer/admin who clicked the consent checkbox).';



COMMENT ON COLUMN "public"."bot_sessions"."retention_deleted_at" IS 'Timestamp the retention sweep deleted Recall-hosted media for this row. URLs are NULLed at the same time. The row itself is preserved for audit.';



COMMENT ON COLUMN "public"."bot_sessions"."retention_delete_error" IS 'Last error from a failed retention attempt. Cleared on successful sweep. Surfaces stuck rows in the cron logs.';



CREATE TABLE IF NOT EXISTS "public"."components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "component_type" character varying(50),
    "code" "text" DEFAULT ''::"text" NOT NULL,
    "props_schema" "jsonb" DEFAULT '{}'::"jsonb",
    "preview_variants" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "citations" "jsonb",
    "confidence" numeric(3,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_messages" IS 'Individual messages in Ask AI conversations';



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "last_message_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'Ask AI conversation threads';



CREATE TABLE IF NOT EXISTS "public"."cross_app_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_app" "text" NOT NULL,
    "target_app" "text",
    "event_type" "text" NOT NULL,
    "event_category" "text",
    "payload" "jsonb" NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "correlation_id" "uuid",
    "processed_by" "jsonb" DEFAULT '{}'::"jsonb",
    "retry_count" integer DEFAULT 0,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval)
);


ALTER TABLE "public"."cross_app_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "reason" "text",
    "source_ip" "inet",
    "user_agent" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fulfilled_at" timestamp with time zone,
    "fulfilled_by" "uuid",
    "fulfillment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "fulfillment_summary" "jsonb",
    "denial_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "data_deletion_requests_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['pending'::"text", 'fulfilled'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."data_deletion_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_deletion_requests" IS 'GDPR Art. 17 / right-to-delete request log. Notify-only — platform admin fulfills manually via /api/consent/data-deletion/admin/:id/fulfill.';



COMMENT ON COLUMN "public"."data_deletion_requests"."fulfillment_summary" IS 'JSONB: { attendees_deleted: int, sessions_redacted: int, recall_media_deleted: int, errors: [...] } — populated on fulfill.';



CREATE TABLE IF NOT EXISTS "public"."deal_risk_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "deal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "score" integer NOT NULL,
    "risk_level" "text" NOT NULL,
    "factors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "predictions" "jsonb" DEFAULT '{}'::"jsonb",
    "recommended_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deal_risk_scores_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "deal_risk_scores_score_check" CHECK ((("score" >= 0) AND ("score" <= 100)))
);


ALTER TABLE "public"."deal_risk_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."deal_risk_scores" IS 'Cached AI-calculated risk scores for deals';



CREATE TABLE IF NOT EXISTS "public"."ecosystem_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_row_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "source" "text" NOT NULL,
    "target_app" "text",
    "error_message" "text",
    "payload" "jsonb",
    "retry_count" integer,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ecosystem_alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."ecosystem_alerts" IS 'Auto-populated on ecosystem_events status=failed transitions. Read + acknowledged through service-role edge functions until an admin UI exists.';



CREATE TABLE IF NOT EXISTS "public"."ecosystem_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "api_url" "text" NOT NULL,
    "service_token" "text" NOT NULL,
    "inbound_token" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_heartbeat" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ecosystem_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecosystem_entity_map" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_entity_type" "text" NOT NULL,
    "local_entity_id" "uuid" NOT NULL,
    "remote_app" "text" NOT NULL,
    "remote_entity_type" "text" NOT NULL,
    "remote_entity_id" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ecosystem_entity_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecosystem_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "target_app" "text",
    "event_type" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "text",
    "direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb",
    "response_data" "jsonb",
    "error_message" "text",
    "processing_time_ms" integer,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ecosystem_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "text_content" "text",
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."embeddings" OWNER TO "postgres";


COMMENT ON TABLE "public"."embeddings" IS 'Stores vector embeddings for semantic search';



CREATE TABLE IF NOT EXISTS "public"."goal_progress_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "progress" numeric(5,2) DEFAULT 0,
    "status" character varying(20),
    "key_results_snapshot" "jsonb" DEFAULT '[]'::"jsonb",
    "note" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."goal_progress_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "goal_type" character varying(50) DEFAULT 'objective'::character varying,
    "parent_id" "uuid",
    "owner_id" "uuid",
    "team_id" character varying(255) DEFAULT 'default'::character varying,
    "status" character varying(50) DEFAULT 'on_track'::character varying,
    "progress" numeric(5,2) DEFAULT 0,
    "target_value" numeric(12,2),
    "current_value" numeric(12,2),
    "unit" character varying(50),
    "start_date" "date",
    "end_date" "date",
    "quarter" character varying(10),
    "year" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "calendar_event_id" "text",
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_type" character varying(50),
    "source_id" "uuid",
    "destination_type" character varying(50),
    "destination_id" character varying(256),
    "status" character varying(20),
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intelligence_context_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "source_app" "text" NOT NULL,
    "context_data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intelligence_context_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."intelligence_context_cache" IS 'Caches cross-app context lookups to avoid repeated API calls';



CREATE TABLE IF NOT EXISTS "public"."intelligence_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferences" "jsonb" DEFAULT '{"timeHorizon": {"risks": 7, "meetings": 24}, "showDealRisks": true, "dealRiskFilter": ["medium", "high", "critical"], "showActionItems": true, "showMeetingPrep": true, "showRelationships": true}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."intelligence_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."intelligence_preferences" IS 'User customization preferences for intelligence dashboard';



CREATE TABLE IF NOT EXISTS "public"."intelligence_profile_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "meeting_id" "uuid",
    "was_suggested" boolean DEFAULT false,
    "suggestion_confidence" real,
    "suggestion_accepted" boolean,
    "suggestion_dismissed" boolean DEFAULT false,
    "was_manually_selected" boolean DEFAULT false,
    "custom_fields_filled" integer DEFAULT 0,
    "custom_fields_total" integer DEFAULT 0,
    "additional_instructions_provided" boolean DEFAULT false,
    "context_assembled" boolean DEFAULT false,
    "context_sources_count" integer DEFAULT 0,
    "context_token_count" integer DEFAULT 0,
    "meeting_completed" boolean DEFAULT false,
    "meeting_duration_seconds" integer,
    "action_items_extracted" integer DEFAULT 0,
    "user_rating" integer,
    "user_feedback" "text",
    "output_quality_score" real,
    "suggested_at" timestamp with time zone,
    "selected_at" timestamp with time zone,
    "context_assembled_at" timestamp with time zone,
    "meeting_completed_at" timestamp with time zone,
    "feedback_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intelligence_profile_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."intelligence_profile_analytics" IS 'Tracks the full suggestion → selection → completion pipeline for each profile usage';



CREATE TABLE IF NOT EXISTS "public"."intelligence_profile_effectiveness" (
    "profile_id" "uuid" NOT NULL,
    "times_suggested" integer DEFAULT 0,
    "times_accepted" integer DEFAULT 0,
    "times_dismissed" integer DEFAULT 0,
    "times_manually_selected" integer DEFAULT 0,
    "times_completed" integer DEFAULT 0,
    "acceptance_rate" real DEFAULT 0,
    "completion_rate" real DEFAULT 0,
    "avg_user_rating" real,
    "avg_output_quality" real,
    "avg_action_items" real,
    "avg_context_sources" real,
    "avg_context_tokens" real,
    "last_used_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intelligence_profile_effectiveness" OWNER TO "postgres";


COMMENT ON TABLE "public"."intelligence_profile_effectiveness" IS 'Aggregated effectiveness metrics per profile, used by the learning feedback loop';



CREATE TABLE IF NOT EXISTS "public"."intelligence_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon" "text" DEFAULT '🤖'::"text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "system_prompt_template" "text" NOT NULL,
    "custom_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "focus_areas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tone" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "output_format" "jsonb" DEFAULT '{}'::"jsonb",
    "context_sources" "jsonb" DEFAULT '["contacts"]'::"jsonb" NOT NULL,
    "context_depth" "text" DEFAULT 'standard'::"text" NOT NULL,
    "suggest_when" "jsonb" DEFAULT '{}'::"jsonb",
    "is_builtin" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intelligence_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."intelligence_profiles" IS 'AI specialization profiles that define how Gemini processes meetings';



CREATE TABLE IF NOT EXISTS "public"."learning_patterns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_type" "text" NOT NULL,
    "pattern_type" "text" NOT NULL,
    "pattern_data" "jsonb" NOT NULL,
    "confidence" integer NOT NULL,
    "status" "text" DEFAULT 'pending_approval'::"text" NOT NULL,
    "customization" "jsonb",
    "validation_metrics" "jsonb",
    "activated_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "deactivated_at" timestamp with time zone,
    "deprecated_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "learning_patterns_agent_type_check" CHECK (("agent_type" = ANY (ARRAY['assignment'::"text", 'priority'::"text", 'deadline'::"text", 'followup'::"text"]))),
    CONSTRAINT "learning_patterns_confidence_check" CHECK ((("confidence" >= 0) AND ("confidence" <= 100))),
    CONSTRAINT "learning_patterns_pattern_type_check" CHECK (("pattern_type" = ANY (ARRAY['preference'::"text", 'constraint'::"text", 'boost'::"text", 'context'::"text"]))),
    CONSTRAINT "learning_patterns_status_check" CHECK (("status" = ANY (ARRAY['pending_approval'::"text", 'active'::"text", 'rejected'::"text", 'deactivated'::"text", 'deprecated'::"text"])))
);


ALTER TABLE "public"."learning_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_intelligence_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "custom_field_values" "jsonb" DEFAULT '{}'::"jsonb",
    "assembled_context" "jsonb" DEFAULT '{}'::"jsonb",
    "context_assembled_at" timestamp with time zone,
    "composed_prompt" "text",
    "tone_override" "text",
    "focus_override" "jsonb",
    "additional_instructions" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "suggestion_dismissed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."meeting_intelligence_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."meeting_intelligence_config" IS 'Links a specific meeting to a profile with user-provided context';



CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "transcript" "text",
    "summary" "text",
    "audio_file_url" character varying(512),
    "key_points" "jsonb" DEFAULT '[]'::"jsonb",
    "decisions" "jsonb" DEFAULT '[]'::"jsonb",
    "topics" "jsonb" DEFAULT '[]'::"jsonb",
    "sentiment_label" character varying(20),
    "sentiment_score" double precision,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "duration_minutes" integer,
    "attendees" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" character varying(255) DEFAULT 'system'::character varying NOT NULL,
    "project_id" "uuid",
    "crm_deal_id" character varying(256),
    "chat_posted" boolean DEFAULT false,
    "posted_to_channels" "jsonb" DEFAULT '[]'::"jsonb",
    "transcript_embedding" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "calendar_event_id" "text",
    "org_id" "uuid" NOT NULL
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "metric_date" "date" DEFAULT CURRENT_DATE,
    "tasks_completed" numeric DEFAULT 0,
    "tasks_total" numeric DEFAULT 0,
    "avg_execution_time_ms" numeric,
    "total_tokens_used" numeric DEFAULT 0,
    "total_cost" numeric DEFAULT 0,
    "success_rate" numeric,
    "error_count" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "metrics_success_rate_check" CHECK ((("success_rate" >= (0)::numeric) AND ("success_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "provider_user_id" "text" NOT NULL,
    "provider_email" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "scopes" "text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."oauth_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_ai_usage_monthly" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "request_count" integer DEFAULT 0,
    "tokens_input" bigint DEFAULT 0,
    "tokens_output" bigint DEFAULT 0,
    "estimated_cost" numeric(10,4) DEFAULT 0
);


ALTER TABLE "public"."org_ai_usage_monthly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "org_invites_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'member'::"text", 'viewer'::"text"]))),
    CONSTRAINT "org_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."org_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "user_name" "text",
    "user_email" "text",
    "user_avatar_url" "text",
    CONSTRAINT "org_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."org_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."org_members" IS 'Links auth.users to a tenant_organization with an RBAC role.';



CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "user_id" "uuid" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_admins" IS 'Cross-workspace privileged users. Used to gate the GDPR fulfillment endpoints (and future platform-wide ops). No UI; bootstrap by SQL insert from a service-role context.';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'planning'::character varying,
    "crm_deal_id" character varying(256),
    "deal_value" numeric(12,2),
    "start_date" "date",
    "end_date" "date",
    "owner_id" "uuid",
    "team_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "projects_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['planning'::character varying, 'active'::character varying, 'completed'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."projects" IS 'Project portfolio — links to tasks, meetings, and CRM deals';



CREATE TABLE IF NOT EXISTS "public"."queries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "task_id" "uuid",
    "query_text" "text" NOT NULL,
    "query_type" character varying(50),
    "response" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "execution_time_ms" numeric,
    "tokens_used" numeric DEFAULT 0,
    "cost" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "queries_query_type_check" CHECK ((("query_type")::"text" = ANY ((ARRAY['question'::character varying, 'command'::character varying, 'analysis'::character varying, 'debug'::character varying, 'generation'::character varying])::"text"[]))),
    CONSTRAINT "queries_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processed'::character varying, 'error'::character varying])::"text"[])))
);


ALTER TABLE "public"."queries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "confidence" double precision DEFAULT 1.0 NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_system" "text" DEFAULT 'entomate'::"text" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    CONSTRAINT "relationships_confidence_range" CHECK ((("confidence" >= (0.0)::double precision) AND ("confidence" <= (1.0)::double precision))),
    CONSTRAINT "relationships_no_self_link" CHECK ((NOT (("source_type" = "target_type") AND ("source_id" = "target_id")))),
    CONSTRAINT "relationships_non_empty_relationship_type" CHECK (("length"(TRIM(BOTH FROM "relationship_type")) > 0)),
    CONSTRAINT "relationships_non_empty_source_id" CHECK (("length"(TRIM(BOTH FROM "source_id")) > 0)),
    CONSTRAINT "relationships_non_empty_source_type" CHECK (("length"(TRIM(BOTH FROM "source_type")) > 0)),
    CONSTRAINT "relationships_non_empty_target_id" CHECK (("length"(TRIM(BOTH FROM "target_id")) > 0)),
    CONSTRAINT "relationships_non_empty_target_type" CHECK (("length"(TRIM(BOTH FROM "target_type")) > 0)),
    CONSTRAINT "relationships_source_id_has_colon" CHECK ((POSITION((':'::"text") IN ("source_id")) > 1)),
    CONSTRAINT "relationships_target_id_has_colon" CHECK ((POSITION((':'::"text") IN ("target_id")) > 1))
);


ALTER TABLE "public"."relationships" OWNER TO "postgres";


COMMENT ON TABLE "public"."relationships" IS 'Knowledge Graph edges - stores relationships between entities';



COMMENT ON COLUMN "public"."relationships"."source_type" IS 'Entity type: meeting, deal, task, project, contact, pulse_message';



COMMENT ON COLUMN "public"."relationships"."source_id" IS 'Prefixed entity ID: e.g., meeting:abc-123';



COMMENT ON COLUMN "public"."relationships"."relationship_type" IS 'Type of relationship: meeting_mentions_deal, action_item_created_task, etc.';



COMMENT ON COLUMN "public"."relationships"."confidence" IS 'Confidence score 0.0-1.0 (1.0 = explicit link, lower = inferred)';



COMMENT ON COLUMN "public"."relationships"."evidence" IS 'JSON evidence explaining why this link exists';



CREATE TABLE IF NOT EXISTS "public"."saved_searches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" character varying(255) DEFAULT 'default'::character varying,
    "name" character varying(255) NOT NULL,
    "query" "text" NOT NULL,
    "search_type" character varying(50) DEFAULT 'text'::character varying,
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_searches" OWNER TO "postgres";


COMMENT ON TABLE "public"."saved_searches" IS 'User-saved search queries for quick access';



CREATE TABLE IF NOT EXISTS "public"."search_conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" character varying(255) DEFAULT 'default'::character varying,
    "title" "text",
    "messages" "jsonb" DEFAULT '[]'::"jsonb",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."search_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "title" "text",
    "content" "text",
    "embedding" "public"."vector"(768),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "indexed_at" timestamp with time zone DEFAULT "now"(),
    "chunk_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."search_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_documents" IS 'Indexed documents for RAG vector search (Search Revisal 2026-03-31)';



CREATE TABLE IF NOT EXISTS "public"."search_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" character varying(255) DEFAULT 'default'::character varying,
    "query" "text" NOT NULL,
    "search_type" character varying(50) DEFAULT 'text'::character varying,
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "result_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."search_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_history" IS 'Tracks user search queries for analytics and suggestions';



CREATE TABLE IF NOT EXISTS "public"."secret_references" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "secret_id" "uuid" NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "node_id" character varying(100) NOT NULL,
    "reference_expression" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."secret_references" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."secrets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "scope" character varying(20) DEFAULT 'user'::character varying NOT NULL,
    "environment" character varying(20) DEFAULT 'production'::character varying NOT NULL,
    "encrypted_value" "text" NOT NULL,
    "value_type" character varying(50) DEFAULT 'string'::character varying,
    "encryption_version" integer DEFAULT 1,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "workflow_id" "uuid",
    "last_accessed_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."secrets_audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "secret_id" "uuid" NOT NULL,
    "secret_name" character varying(255) NOT NULL,
    "action" character varying(20) NOT NULL,
    "user_id" "uuid",
    "user_email" character varying(255),
    "access_method" character varying(50),
    "workflow_id" "uuid",
    "workflow_execution_id" "uuid",
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."secrets_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."secrets_vault" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "team_id" character varying(255) DEFAULT 'default'::character varying,
    "key_name" character varying(255) NOT NULL,
    "encrypted_value" "text" NOT NULL,
    "description" "text",
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_by" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."secrets_vault" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "domain" "text",
    "industry" "text",
    "size" "text",
    "website" "text",
    "linkedin_url" "text",
    "logo_url" "text",
    "address_line1" "text",
    "city" "text",
    "state" "text",
    "country" "text",
    "source_app" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "organization_id" "uuid",
    "email" "text",
    "name" "text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "mobile" "text",
    "company_name" "text",
    "job_title" "text",
    "department" "text",
    "linkedin_url" "text",
    "twitter_handle" "text",
    "website" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country" "text",
    "source_app" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "email_verified" boolean DEFAULT false,
    "full_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "locale" "text" DEFAULT 'en'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "org_id" "uuid",
    "platform" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "account_id" "text",
    "account_name" "text",
    "account_avatar" "text",
    "scopes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_accounts_platform_check" CHECK (("platform" = ANY (ARRAY['twitter'::"text", 'facebook'::"text", 'instagram'::"text", 'linkedin'::"text"])))
);


ALTER TABLE "public"."social_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stakeholder_intelligence" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stakeholder_id" "uuid" NOT NULL,
    "deal_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "role" "text",
    "influence_score" integer,
    "relationship_strength" integer,
    "sentiment_score" integer,
    "engagement_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "influences" "jsonb" DEFAULT '[]'::"jsonb",
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stakeholder_intelligence_influence_score_check" CHECK ((("influence_score" >= 0) AND ("influence_score" <= 100))),
    CONSTRAINT "stakeholder_intelligence_relationship_strength_check" CHECK ((("relationship_strength" >= 0) AND ("relationship_strength" <= 100))),
    CONSTRAINT "stakeholder_intelligence_role_check" CHECK (("role" = ANY (ARRAY['champion'::"text", 'influencer'::"text", 'blocker'::"text", 'economic_buyer'::"text", 'unknown'::"text"]))),
    CONSTRAINT "stakeholder_intelligence_sentiment_score_check" CHECK ((("sentiment_score" >= 0) AND ("sentiment_score" <= 100)))
);


ALTER TABLE "public"."stakeholder_intelligence" OWNER TO "postgres";


COMMENT ON TABLE "public"."stakeholder_intelligence" IS 'AI-classified stakeholder roles and relationship intelligence';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid",
    "parent_task_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'todo'::character varying,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "assigned_to" character varying(255),
    "due_date" "date",
    "estimated_hours" numeric,
    "actual_hours" numeric,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "project_id" "uuid",
    "start_date" "date",
    "crm_task_id" character varying(256),
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "org_id" "uuid" NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::"text"[]))),
    CONSTRAINT "tasks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['todo'::character varying, 'in_progress'::character varying, 'review'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'Task items within projects — supports subtasks via parent_task_id';



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" "text" DEFAULT 'default'::"text",
    "name" "text" NOT NULL,
    "email" "text",
    "role" "text",
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text",
    "ai_monthly_limit" integer DEFAULT 50,
    "ai_custom_api_key" "text",
    "ai_custom_api_key_active" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "ecosystem_access" boolean DEFAULT false NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "tenant_organizations_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'starter'::"text", 'pro'::"text", 'business'::"text", 'ecosystem'::"text"])))
);


ALTER TABLE "public"."tenant_organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_organizations" IS 'Multi-tenant organizations for Entomate. Each org has a plan tier and usage limits.';



COMMENT ON COLUMN "public"."tenant_organizations"."plan" IS 'Subscription tier: free, starter, pro, business. Per-app plan level.';



COMMENT ON COLUMN "public"."tenant_organizations"."stripe_customer_id" IS 'Stripe Customer ID (cus_xxx) — set during plan checkout';



COMMENT ON COLUMN "public"."tenant_organizations"."stripe_subscription_id" IS 'Stripe Subscription ID (sub_xxx) — set during plan checkout';



COMMENT ON COLUMN "public"."tenant_organizations"."ecosystem_access" IS 'True when org has an ecosystem bundle (LV + Entomate + Pulse). Set by Stripe webhook.';



CREATE TABLE IF NOT EXISTS "public"."user_app_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "app_name" "text" NOT NULL,
    "app_user_id" "uuid",
    "app_role" "text" DEFAULT 'user'::"text",
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone
);


ALTER TABLE "public"."user_app_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "password_hash" "text" NOT NULL,
    "password_updated_at" timestamp with time zone DEFAULT "now"(),
    "failed_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_learning_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preference_key" "text" NOT NULL,
    "preference_value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_learning_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_token" "text" NOT NULL,
    "refresh_token" "text",
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "refresh_expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "theme_mode" "text" DEFAULT 'system'::"text" NOT NULL,
    "accent_mode" "text" DEFAULT 'system'::"text" NOT NULL,
    "accent_color" "text" DEFAULT '#00A86B'::"text" NOT NULL,
    "reduce_motion" boolean DEFAULT false NOT NULL,
    "notifications_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "meetings_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "calendar_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_settings"."calendar_json" IS 'Google Calendar OAuth tokens and preferences. Keys: tokens (object), connected_at (timestamp), calendar_id (preferred calendar)';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "avatar_url" character varying(512),
    "role" character varying(50) DEFAULT 'member'::character varying,
    "team_id" "uuid",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vector_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "collection_name" character varying(255) DEFAULT 'default'::character varying NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid",
    "team_id" "uuid",
    "source_type" character varying(50) DEFAULT 'text'::character varying,
    "source_id" character varying(255),
    "source_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vector_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."vector_documents" IS 'Stores document chunks with vector embeddings for semantic search and RAG';



COMMENT ON COLUMN "public"."vector_documents"."collection_name" IS 'Logical grouping of documents for scoped searches';



COMMENT ON COLUMN "public"."vector_documents"."embedding" IS 'Vector embedding (1536 dimensions for OpenAI, 768 for Gemini)';



COMMENT ON COLUMN "public"."vector_documents"."metadata" IS 'Flexible JSON metadata for filtering and context';



CREATE OR REPLACE VIEW "public"."vector_collections_overview" AS
 SELECT "collection_name",
    "count"(*) AS "document_count",
    "sum"("length"("content")) AS "total_chars",
    "count"(DISTINCT "source_type") AS "source_types",
    "min"("created_at") AS "first_document",
    "max"("created_at") AS "last_document"
   FROM "public"."vector_documents"
  GROUP BY "collection_name"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."vector_collections_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'running'::character varying NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "execution_data" "jsonb" DEFAULT '{}'::"jsonb",
    "error_log" "jsonb" DEFAULT '{}'::"jsonb",
    "node_results" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "valid_exec_status" CHECK ((("status")::"text" = ANY ((ARRAY['idle'::character varying, 'running'::character varying, 'success'::character varying, 'failed'::character varying, 'paused'::character varying])::"text"[])))
);


ALTER TABLE "public"."workflow_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "nodes" "jsonb" NOT NULL,
    "edges" "jsonb" NOT NULL,
    "changelog" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workflow_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "nodes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "edges" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1,
    "status" character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    "execution_config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_executed_at" timestamp with time zone,
    "active" boolean DEFAULT false,
    "is_template" boolean DEFAULT false,
    "connections" "jsonb" DEFAULT '[]'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "execution_count" integer DEFAULT 0,
    "user_id" "text",
    "org_id" "uuid" NOT NULL,
    CONSTRAINT "valid_workflow_status" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::"text"[])))
);


ALTER TABLE "public"."workflows" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_item_dependencies"
    ADD CONSTRAINT "action_item_dependencies_action_item_id_blocks_action_item__key" UNIQUE ("action_item_id", "blocks_action_item_id");



ALTER TABLE ONLY "public"."action_item_dependencies"
    ADD CONSTRAINT "action_item_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_execution_logs"
    ADD CONSTRAINT "agent_execution_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_executions"
    ADD CONSTRAINT "agent_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_explanations"
    ADD CONSTRAINT "agent_explanations_agent_execution_id_key" UNIQUE ("agent_execution_id");



ALTER TABLE ONLY "public"."agent_explanations"
    ADD CONSTRAINT "agent_explanations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_overrides"
    ADD CONSTRAINT "agent_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_run_steps"
    ADD CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_agents"
    ADD CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_templates"
    ADD CONSTRAINT "automation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automations"
    ADD CONSTRAINT "automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bot_session_attendees"
    ADD CONSTRAINT "bot_session_attendees_opt_out_token_hash_key" UNIQUE ("opt_out_token_hash");



ALTER TABLE ONLY "public"."bot_session_attendees"
    ADD CONSTRAINT "bot_session_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bot_session_attendees"
    ADD CONSTRAINT "bot_session_attendees_session_id_email_key" UNIQUE ("session_id", "email");



ALTER TABLE ONLY "public"."bot_sessions"
    ADD CONSTRAINT "bot_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."components"
    ADD CONSTRAINT "components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cross_app_events"
    ADD CONSTRAINT "cross_app_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deal_risk_scores"
    ADD CONSTRAINT "deal_risk_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecosystem_alerts"
    ADD CONSTRAINT "ecosystem_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecosystem_config"
    ADD CONSTRAINT "ecosystem_config_app_name_key" UNIQUE ("app_name");



ALTER TABLE ONLY "public"."ecosystem_config"
    ADD CONSTRAINT "ecosystem_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecosystem_entity_map"
    ADD CONSTRAINT "ecosystem_entity_map_local_entity_type_local_entity_id_remo_key" UNIQUE ("local_entity_type", "local_entity_id", "remote_app");



ALTER TABLE ONLY "public"."ecosystem_entity_map"
    ADD CONSTRAINT "ecosystem_entity_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecosystem_events"
    ADD CONSTRAINT "ecosystem_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embeddings"
    ADD CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_progress_history"
    ADD CONSTRAINT "goal_progress_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intelligence_context_cache"
    ADD CONSTRAINT "intelligence_context_cache_entity_type_entity_id_source_app_key" UNIQUE ("entity_type", "entity_id", "source_app");



ALTER TABLE ONLY "public"."intelligence_context_cache"
    ADD CONSTRAINT "intelligence_context_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intelligence_preferences"
    ADD CONSTRAINT "intelligence_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intelligence_preferences"
    ADD CONSTRAINT "intelligence_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."intelligence_profile_analytics"
    ADD CONSTRAINT "intelligence_profile_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intelligence_profile_effectiveness"
    ADD CONSTRAINT "intelligence_profile_effectiveness_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."intelligence_profiles"
    ADD CONSTRAINT "intelligence_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intelligence_profiles"
    ADD CONSTRAINT "intelligence_profiles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."learning_patterns"
    ADD CONSTRAINT "learning_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_intelligence_config"
    ADD CONSTRAINT "meeting_intelligence_config_meeting_id_key" UNIQUE ("meeting_id");



ALTER TABLE ONLY "public"."meeting_intelligence_config"
    ADD CONSTRAINT "meeting_intelligence_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metrics"
    ADD CONSTRAINT "metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_connections"
    ADD CONSTRAINT "oauth_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_connections"
    ADD CONSTRAINT "oauth_connections_provider_provider_user_id_key" UNIQUE ("provider", "provider_user_id");



ALTER TABLE ONLY "public"."org_ai_usage_monthly"
    ADD CONSTRAINT "org_ai_usage_monthly_org_id_month_key" UNIQUE ("org_id", "month");



ALTER TABLE ONLY "public"."org_ai_usage_monthly"
    ADD CONSTRAINT "org_ai_usage_monthly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_org_id_email_status_key" UNIQUE ("org_id", "email", "status");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_org_id_user_id_key" UNIQUE ("org_id", "user_id");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."queries"
    ADD CONSTRAINT "queries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_unique_edge" UNIQUE ("source_type", "source_id", "target_type", "target_id", "relationship_type");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_conversations"
    ADD CONSTRAINT "search_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_documents"
    ADD CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_documents"
    ADD CONSTRAINT "search_documents_source_type_source_id_key" UNIQUE ("source_type", "source_id");



ALTER TABLE ONLY "public"."search_history"
    ADD CONSTRAINT "search_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secret_references"
    ADD CONSTRAINT "secret_references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secret_references"
    ADD CONSTRAINT "secret_references_secret_id_workflow_id_node_id_reference_e_key" UNIQUE ("secret_id", "workflow_id", "node_id", "reference_expression");



ALTER TABLE ONLY "public"."secrets_audit_log"
    ADD CONSTRAINT "secrets_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secrets"
    ADD CONSTRAINT "secrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secrets"
    ADD CONSTRAINT "secrets_user_id_name_scope_environment_key" UNIQUE ("user_id", "name", "scope", "environment");



ALTER TABLE ONLY "public"."secrets_vault"
    ADD CONSTRAINT "secrets_vault_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secrets_vault"
    ADD CONSTRAINT "secrets_vault_team_id_key_name_key" UNIQUE ("team_id", "key_name");



ALTER TABLE ONLY "public"."shared_companies"
    ADD CONSTRAINT "shared_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_companies"
    ADD CONSTRAINT "shared_companies_source_app_source_id_key" UNIQUE ("source_app", "source_id");



ALTER TABLE ONLY "public"."shared_contacts"
    ADD CONSTRAINT "shared_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_contacts"
    ADD CONSTRAINT "shared_contacts_source_app_source_id_key" UNIQUE ("source_app", "source_id");



ALTER TABLE ONLY "public"."shared_users"
    ADD CONSTRAINT "shared_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."shared_users"
    ADD CONSTRAINT "shared_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_user_id_platform_key" UNIQUE ("user_id", "platform");



ALTER TABLE ONLY "public"."stakeholder_intelligence"
    ADD CONSTRAINT "stakeholder_intelligence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_organizations"
    ADD CONSTRAINT "tenant_organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_organizations"
    ADD CONSTRAINT "tenant_organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."workflow_versions"
    ADD CONSTRAINT "unique_workflow_version" UNIQUE ("workflow_id", "version_number");



ALTER TABLE ONLY "public"."user_app_connections"
    ADD CONSTRAINT "user_app_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_app_connections"
    ADD CONSTRAINT "user_app_connections_user_id_app_name_key" UNIQUE ("user_id", "app_name");



ALTER TABLE ONLY "public"."user_credentials"
    ADD CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credentials"
    ADD CONSTRAINT "user_credentials_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_learning_preferences"
    ADD CONSTRAINT "user_learning_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_learning_preferences"
    ADD CONSTRAINT "user_learning_preferences_user_id_preference_key_key" UNIQUE ("user_id", "preference_key");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_refresh_token_key" UNIQUE ("refresh_token");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vector_documents"
    ADD CONSTRAINT "vector_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_executions"
    ADD CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_versions"
    ADD CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_action_items_assigned_to" ON "public"."action_items" USING "btree" ("assigned_to_id");



CREATE INDEX "idx_action_items_calendar_event" ON "public"."action_items" USING "btree" ("calendar_event_id") WHERE ("calendar_event_id" IS NOT NULL);



CREATE INDEX "idx_action_items_crm_sync" ON "public"."action_items" USING "btree" ("crm_sync_status");



CREATE INDEX "idx_action_items_due_date" ON "public"."action_items" USING "btree" ("due_date");



CREATE INDEX "idx_action_items_meeting" ON "public"."action_items" USING "btree" ("meeting_id");



CREATE INDEX "idx_action_items_org_id" ON "public"."action_items" USING "btree" ("org_id");



CREATE INDEX "idx_action_items_status" ON "public"."action_items" USING "btree" ("status");



CREATE INDEX "idx_agent_executions_agent_id" ON "public"."agent_executions" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_executions_created_at" ON "public"."agent_executions" USING "btree" ("created_at");



CREATE INDEX "idx_agent_explanations_confidence" ON "public"."agent_explanations" USING "btree" ("confidence");



CREATE INDEX "idx_agent_explanations_created" ON "public"."agent_explanations" USING "btree" ("created_at");



CREATE INDEX "idx_agent_explanations_execution" ON "public"."agent_explanations" USING "btree" ("agent_execution_id");



CREATE INDEX "idx_agent_explanations_factors" ON "public"."agent_explanations" USING "gin" ("factors");



CREATE INDEX "idx_agent_explanations_type" ON "public"."agent_explanations" USING "btree" ("agent_type");



CREATE INDEX "idx_agent_logs_agent" ON "public"."agent_execution_logs" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_logs_created" ON "public"."agent_execution_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agent_logs_type" ON "public"."agent_execution_logs" USING "btree" ("agent_type");



CREATE INDEX "idx_agent_overrides_created" ON "public"."agent_overrides" USING "btree" ("created_at");



CREATE INDEX "idx_agent_overrides_type" ON "public"."agent_overrides" USING "btree" ("agent_type");



CREATE INDEX "idx_agent_overrides_user" ON "public"."agent_overrides" USING "btree" ("user_id");



CREATE INDEX "idx_agent_overrides_user_type" ON "public"."agent_overrides" USING "btree" ("user_id", "agent_type");



CREATE INDEX "idx_agent_run_steps_run_id" ON "public"."agent_run_steps" USING "btree" ("agent_run_id");



CREATE INDEX "idx_agent_run_steps_run_order" ON "public"."agent_run_steps" USING "btree" ("agent_run_id", "step_index");



CREATE INDEX "idx_agent_run_steps_status" ON "public"."agent_run_steps" USING "btree" ("status");



CREATE INDEX "idx_agent_runs_agent_id" ON "public"."agent_runs" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_runs_started_at" ON "public"."agent_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_agent_runs_status" ON "public"."agent_runs" USING "btree" ("status");



CREATE INDEX "idx_agent_runs_trigger_event_id" ON "public"."agent_runs" USING "btree" ("trigger_event_id");



CREATE INDEX "idx_agents_created_by" ON "public"."agents" USING "btree" ("created_by");



CREATE INDEX "idx_agents_enabled" ON "public"."agents" USING "btree" ("enabled");



CREATE INDEX "idx_agents_trigger_type" ON "public"."agents" USING "btree" ("trigger_type");



CREATE INDEX "idx_agents_updated_at" ON "public"."agents" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_ai_agents_enabled" ON "public"."ai_agents" USING "btree" ("enabled");



CREATE INDEX "idx_ai_agents_type" ON "public"."ai_agents" USING "btree" ("agent_type");



CREATE INDEX "idx_ai_agents_user" ON "public"."ai_agents" USING "btree" ("user_id");



CREATE INDEX "idx_audit_action" ON "public"."audit_log" USING "btree" ("action", "created_at");



CREATE INDEX "idx_audit_org" ON "public"."audit_log" USING "btree" ("organization_id", "created_at");



CREATE INDEX "idx_audit_user" ON "public"."audit_log" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_automation_logs_automation" ON "public"."automation_logs" USING "btree" ("automation_id");



CREATE INDEX "idx_automation_logs_created" ON "public"."automation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_automations_enabled" ON "public"."automations" USING "btree" ("enabled");



CREATE INDEX "idx_automations_team" ON "public"."automations" USING "btree" ("team_id");



CREATE INDEX "idx_automations_trigger_type" ON "public"."automations" USING "btree" ("trigger_type");



CREATE INDEX "idx_automations_user" ON "public"."automations" USING "btree" ("user_id");



CREATE INDEX "idx_bot_sessions_active" ON "public"."bot_sessions" USING "btree" ("status") WHERE ("status" <> ALL (ARRAY['completed'::"text", 'failed'::"text", 'stopped'::"text", 'timeout'::"text"]));



CREATE INDEX "idx_bot_sessions_meeting" ON "public"."bot_sessions" USING "btree" ("meeting_id");



CREATE INDEX "idx_bot_sessions_org_created" ON "public"."bot_sessions" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_bot_sessions_recall_bot_id" ON "public"."bot_sessions" USING "btree" ("recall_bot_id") WHERE ("recall_bot_id" IS NOT NULL);



CREATE INDEX "idx_bot_sessions_retention_pending" ON "public"."bot_sessions" USING "btree" ("created_at") WHERE (("retention_deleted_at" IS NULL) AND (("recording_url" IS NOT NULL) OR ("transcript_url" IS NOT NULL)));



CREATE INDEX "idx_bsa_org_optouts" ON "public"."bot_session_attendees" USING "btree" ("org_id", "opted_out_at") WHERE ("opted_out_at" IS NOT NULL);



CREATE INDEX "idx_bsa_session" ON "public"."bot_session_attendees" USING "btree" ("session_id");



CREATE INDEX "idx_bsa_token_hash" ON "public"."bot_session_attendees" USING "btree" ("opt_out_token_hash");



CREATE INDEX "idx_components_project" ON "public"."components" USING "btree" ("project_id");



CREATE INDEX "idx_components_type" ON "public"."components" USING "btree" ("component_type");



CREATE INDEX "idx_conv_messages_conversation" ON "public"."conversation_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_conv_messages_created" ON "public"."conversation_messages" USING "btree" ("created_at");



CREATE INDEX "idx_conversations_started" ON "public"."conversations" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_conversations_user" ON "public"."conversations" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_ddr_email" ON "public"."data_deletion_requests" USING "btree" ("email");



CREATE INDEX "idx_ddr_pending" ON "public"."data_deletion_requests" USING "btree" ("requested_at") WHERE ("fulfillment_status" = 'pending'::"text");



CREATE INDEX "idx_deal_risk_scores_calculated" ON "public"."deal_risk_scores" USING "btree" ("calculated_at" DESC);



CREATE INDEX "idx_deal_risk_scores_deal" ON "public"."deal_risk_scores" USING "btree" ("deal_id");



CREATE INDEX "idx_deal_risk_scores_level" ON "public"."deal_risk_scores" USING "btree" ("risk_level");



CREATE INDEX "idx_deal_risk_scores_user" ON "public"."deal_risk_scores" USING "btree" ("user_id");



CREATE INDEX "idx_dependencies_blocked" ON "public"."action_item_dependencies" USING "btree" ("blocks_action_item_id");



CREATE INDEX "idx_dependencies_blocker" ON "public"."action_item_dependencies" USING "btree" ("action_item_id");



CREATE INDEX "idx_ecosystem_alerts_event_row" ON "public"."ecosystem_alerts" USING "btree" ("event_row_id");



CREATE INDEX "idx_ecosystem_alerts_unacked" ON "public"."ecosystem_alerts" USING "btree" ("created_at" DESC) WHERE ("acknowledged_at" IS NULL);



CREATE INDEX "idx_ecosystem_entity_map_local" ON "public"."ecosystem_entity_map" USING "btree" ("local_entity_type", "local_entity_id");



CREATE INDEX "idx_ecosystem_entity_map_remote" ON "public"."ecosystem_entity_map" USING "btree" ("remote_app", "remote_entity_id");



CREATE INDEX "idx_ecosystem_events_created_at" ON "public"."ecosystem_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ecosystem_events_direction" ON "public"."ecosystem_events" USING "btree" ("direction");



CREATE INDEX "idx_ecosystem_events_event_type" ON "public"."ecosystem_events" USING "btree" ("event_type");



CREATE INDEX "idx_ecosystem_events_retry" ON "public"."ecosystem_events" USING "btree" ("status", "next_retry_at") WHERE (("status" = 'failed'::"text") AND ("next_retry_at" IS NOT NULL));



CREATE INDEX "idx_ecosystem_events_source" ON "public"."ecosystem_events" USING "btree" ("source");



CREATE INDEX "idx_ecosystem_events_status" ON "public"."ecosystem_events" USING "btree" ("status");



CREATE INDEX "idx_embeddings_source" ON "public"."embeddings" USING "btree" ("source_id", "source_type");



CREATE INDEX "idx_events_by_type" ON "public"."cross_app_events" USING "btree" ("event_type", "created_at");



CREATE INDEX "idx_events_by_user" ON "public"."cross_app_events" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_events_correlation" ON "public"."cross_app_events" USING "btree" ("correlation_id");



CREATE INDEX "idx_events_unprocessed" ON "public"."cross_app_events" USING "btree" ("target_app", "created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_executions_started" ON "public"."workflow_executions" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_executions_status" ON "public"."workflow_executions" USING "btree" ("status");



CREATE INDEX "idx_executions_workflow" ON "public"."workflow_executions" USING "btree" ("workflow_id");



CREATE INDEX "idx_goal_history_created" ON "public"."goal_progress_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_goal_history_goal" ON "public"."goal_progress_history" USING "btree" ("goal_id");



CREATE INDEX "idx_goals_calendar_event" ON "public"."goals" USING "btree" ("calendar_event_id") WHERE ("calendar_event_id" IS NOT NULL);



CREATE INDEX "idx_goals_org_id" ON "public"."goals" USING "btree" ("org_id");



CREATE INDEX "idx_goals_owner" ON "public"."goals" USING "btree" ("owner_id");



CREATE INDEX "idx_goals_parent" ON "public"."goals" USING "btree" ("parent_id");



CREATE INDEX "idx_goals_quarter" ON "public"."goals" USING "btree" ("quarter", "year");



CREATE INDEX "idx_goals_team" ON "public"."goals" USING "btree" ("team_id");



CREATE INDEX "idx_integration_logs_created" ON "public"."integration_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_integration_logs_source" ON "public"."integration_logs" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_integration_logs_status" ON "public"."integration_logs" USING "btree" ("status");



CREATE INDEX "idx_intelligence_context_cache_entity" ON "public"."intelligence_context_cache" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_intelligence_context_cache_expires" ON "public"."intelligence_context_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_intelligence_profiles_active" ON "public"."intelligence_profiles" USING "btree" ("is_active");



CREATE INDEX "idx_intelligence_profiles_category" ON "public"."intelligence_profiles" USING "btree" ("category");



CREATE INDEX "idx_intelligence_profiles_slug" ON "public"."intelligence_profiles" USING "btree" ("slug");



CREATE INDEX "idx_learning_patterns_status" ON "public"."learning_patterns" USING "btree" ("status");



CREATE INDEX "idx_learning_patterns_type" ON "public"."learning_patterns" USING "btree" ("agent_type");



CREATE INDEX "idx_learning_patterns_user" ON "public"."learning_patterns" USING "btree" ("user_id");



CREATE INDEX "idx_learning_patterns_user_status" ON "public"."learning_patterns" USING "btree" ("user_id", "status");



CREATE INDEX "idx_meeting_intelligence_config_meeting" ON "public"."meeting_intelligence_config" USING "btree" ("meeting_id");



CREATE INDEX "idx_meeting_intelligence_config_profile" ON "public"."meeting_intelligence_config" USING "btree" ("profile_id");



CREATE INDEX "idx_meeting_intelligence_config_status" ON "public"."meeting_intelligence_config" USING "btree" ("status");



CREATE INDEX "idx_meetings_calendar_event" ON "public"."meetings" USING "btree" ("calendar_event_id") WHERE ("calendar_event_id" IS NOT NULL);



CREATE INDEX "idx_meetings_created_at" ON "public"."meetings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_meetings_created_by" ON "public"."meetings" USING "btree" ("created_by");



CREATE INDEX "idx_meetings_crm_deal_id" ON "public"."meetings" USING "btree" ("crm_deal_id");



CREATE INDEX "idx_meetings_org_id" ON "public"."meetings" USING "btree" ("org_id");



CREATE INDEX "idx_meetings_project_id" ON "public"."meetings" USING "btree" ("project_id");



CREATE INDEX "idx_meetings_sentiment" ON "public"."meetings" USING "btree" ("sentiment_label");



CREATE INDEX "idx_meetings_summary_trgm" ON "public"."meetings" USING "gin" ("summary" "public"."gin_trgm_ops");



CREATE INDEX "idx_meetings_transcript_trgm" ON "public"."meetings" USING "gin" ("transcript" "public"."gin_trgm_ops");



CREATE INDEX "idx_org_ai_usage_org_month" ON "public"."org_ai_usage_monthly" USING "btree" ("org_id", "month" DESC);



CREATE INDEX "idx_org_invites_email" ON "public"."org_invites" USING "btree" ("email");



CREATE INDEX "idx_org_invites_org_id" ON "public"."org_invites" USING "btree" ("org_id");



CREATE INDEX "idx_org_invites_status" ON "public"."org_invites" USING "btree" ("org_id", "status");



CREATE INDEX "idx_org_invites_token" ON "public"."org_invites" USING "btree" ("token");



CREATE INDEX "idx_org_members_org" ON "public"."org_members" USING "btree" ("org_id");



CREATE INDEX "idx_org_members_org_id" ON "public"."org_members" USING "btree" ("org_id");



CREATE INDEX "idx_org_members_org_role" ON "public"."org_members" USING "btree" ("org_id", "role");



CREATE INDEX "idx_org_members_user" ON "public"."org_members" USING "btree" ("user_id");



CREATE INDEX "idx_org_members_user_id" ON "public"."org_members" USING "btree" ("user_id");



CREATE INDEX "idx_profile_analytics_created" ON "public"."intelligence_profile_analytics" USING "btree" ("created_at");



CREATE INDEX "idx_profile_analytics_meeting" ON "public"."intelligence_profile_analytics" USING "btree" ("meeting_id");



CREATE INDEX "idx_profile_analytics_profile" ON "public"."intelligence_profile_analytics" USING "btree" ("profile_id");



CREATE INDEX "idx_projects_crm_deal_id" ON "public"."projects" USING "btree" ("crm_deal_id");



CREATE INDEX "idx_projects_owner_id" ON "public"."projects" USING "btree" ("owner_id");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_relationships_created_at" ON "public"."relationships" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_relationships_org_id" ON "public"."relationships" USING "btree" ("org_id");



CREATE INDEX "idx_relationships_source" ON "public"."relationships" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_relationships_source_type_rel" ON "public"."relationships" USING "btree" ("source_type", "source_id", "relationship_type");



CREATE INDEX "idx_relationships_target" ON "public"."relationships" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_relationships_target_type_rel" ON "public"."relationships" USING "btree" ("target_type", "target_id", "relationship_type");



CREATE INDEX "idx_relationships_type" ON "public"."relationships" USING "btree" ("relationship_type");



CREATE INDEX "idx_saved_searches_created" ON "public"."saved_searches" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_saved_searches_user" ON "public"."saved_searches" USING "btree" ("user_id");



CREATE INDEX "idx_search_docs_indexed" ON "public"."search_documents" USING "btree" ("indexed_at" DESC);



CREATE INDEX "idx_search_docs_source" ON "public"."search_documents" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_search_history_created" ON "public"."search_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_search_history_user" ON "public"."search_history" USING "btree" ("user_id");



CREATE INDEX "idx_secret_refs_secret" ON "public"."secret_references" USING "btree" ("secret_id");



CREATE INDEX "idx_secret_refs_workflow" ON "public"."secret_references" USING "btree" ("workflow_id");



CREATE INDEX "idx_secrets_audit_action" ON "public"."secrets_audit_log" USING "btree" ("action");



CREATE INDEX "idx_secrets_audit_created" ON "public"."secrets_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_secrets_audit_secret" ON "public"."secrets_audit_log" USING "btree" ("secret_id");



CREATE INDEX "idx_secrets_audit_user" ON "public"."secrets_audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_secrets_name" ON "public"."secrets" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_secrets_org" ON "public"."secrets" USING "btree" ("organization_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_secrets_scope" ON "public"."secrets" USING "btree" ("scope") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_secrets_user" ON "public"."secrets" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_secrets_workflow" ON "public"."secrets" USING "btree" ("workflow_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_shared_contacts_email" ON "public"."shared_contacts" USING "btree" ("email");



CREATE INDEX "idx_shared_contacts_org" ON "public"."shared_contacts" USING "btree" ("organization_id");



CREATE INDEX "idx_shared_contacts_owner" ON "public"."shared_contacts" USING "btree" ("owner_id");



CREATE INDEX "idx_stakeholder_intel_deal" ON "public"."stakeholder_intelligence" USING "btree" ("deal_id");



CREATE INDEX "idx_stakeholder_intel_role" ON "public"."stakeholder_intelligence" USING "btree" ("role");



CREATE INDEX "idx_stakeholder_intel_stakeholder" ON "public"."stakeholder_intelligence" USING "btree" ("stakeholder_id");



CREATE INDEX "idx_stakeholder_intel_user" ON "public"."stakeholder_intelligence" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_assigned_to" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date") WHERE ("due_date" IS NOT NULL);



CREATE INDEX "idx_tasks_org_id" ON "public"."tasks" USING "btree" ("org_id");



CREATE INDEX "idx_tasks_project_id" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_team_members_active" ON "public"."team_members" USING "btree" ("active");



CREATE INDEX "idx_team_members_team" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_tenant_organizations_plan" ON "public"."tenant_organizations" USING "btree" ("plan");



CREATE INDEX "idx_tenant_organizations_slug" ON "public"."tenant_organizations" USING "btree" ("slug");



CREATE INDEX "idx_tenant_orgs_deleted_at" ON "public"."tenant_organizations" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "idx_tenant_orgs_slug" ON "public"."tenant_organizations" USING "btree" ("slug");



CREATE INDEX "idx_tenant_orgs_stripe_customer" ON "public"."tenant_organizations" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "idx_tenant_orgs_stripe_subscription" ON "public"."tenant_organizations" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_user_learning_preferences_user" ON "public"."user_learning_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_vector_documents_collection" ON "public"."vector_documents" USING "btree" ("collection_name");



CREATE INDEX "idx_vector_documents_content_fts" ON "public"."vector_documents" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "idx_vector_documents_embedding_cosine" ON "public"."vector_documents" USING "hnsw" ("embedding" "public"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_vector_documents_metadata" ON "public"."vector_documents" USING "gin" ("metadata");



CREATE INDEX "idx_vector_documents_source" ON "public"."vector_documents" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_vector_documents_team" ON "public"."vector_documents" USING "btree" ("team_id");



CREATE INDEX "idx_vector_documents_user" ON "public"."vector_documents" USING "btree" ("user_id");



CREATE INDEX "idx_workflow_versions" ON "public"."workflow_versions" USING "btree" ("workflow_id");



CREATE INDEX "idx_workflow_versions_number" ON "public"."workflow_versions" USING "btree" ("workflow_id", "version_number" DESC);



CREATE INDEX "idx_workflows_created" ON "public"."workflows" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_workflows_org_id" ON "public"."workflows" USING "btree" ("org_id");



CREATE INDEX "idx_workflows_project" ON "public"."workflows" USING "btree" ("project_id");



CREATE INDEX "idx_workflows_status" ON "public"."workflows" USING "btree" ("status");



CREATE UNIQUE INDEX "ux_agent_runs_idempotent" ON "public"."agent_runs" USING "btree" ("agent_id", "trigger_event_id") WHERE (("trigger_event_id" IS NOT NULL) AND ("status" = ANY (ARRAY['running'::"text", 'success'::"text"])));



CREATE OR REPLACE TRIGGER "goals_updated_at" BEFORE UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "secret_create_trigger" AFTER INSERT ON "public"."secrets" FOR EACH ROW EXECUTE FUNCTION "public"."log_secret_create"();



CREATE OR REPLACE TRIGGER "secret_update_trigger" BEFORE UPDATE ON "public"."secrets" FOR EACH ROW EXECUTE FUNCTION "public"."log_secret_update"();



CREATE OR REPLACE TRIGGER "social_accounts_updated_at" BEFORE UPDATE ON "public"."social_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_social_accounts_updated_at"();



CREATE OR REPLACE TRIGGER "trg_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ecosystem_alert_on_failure" AFTER INSERT OR UPDATE OF "status" ON "public"."ecosystem_events" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ecosystem_alert_on_failure"();



CREATE OR REPLACE TRIGGER "trg_ecosystem_config_updated" BEFORE UPDATE ON "public"."ecosystem_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_ecosystem_config_timestamp"();



CREATE OR REPLACE TRIGGER "trg_intelligence_profiles_updated" BEFORE UPDATE ON "public"."intelligence_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_intelligence_timestamp"();



CREATE OR REPLACE TRIGGER "trg_meeting_intelligence_config_updated" BEFORE UPDATE ON "public"."meeting_intelligence_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_intelligence_timestamp"();



CREATE OR REPLACE TRIGGER "trg_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_relationships_set_updated_at" BEFORE UPDATE ON "public"."relationships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_tenant_organizations_updated_at" BEFORE UPDATE ON "public"."tenant_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tenant_orgs_updated_at" BEFORE UPDATE ON "public"."tenant_organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_action_item_dependencies_updated_at" BEFORE UPDATE ON "public"."action_item_dependencies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_components_updated_at" BEFORE UPDATE ON "public"."components" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deal_risk_scores_updated_at" BEFORE UPDATE ON "public"."deal_risk_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_intelligence_preferences_updated_at" BEFORE UPDATE ON "public"."intelligence_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shared_contacts_updated_at" BEFORE UPDATE ON "public"."shared_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_shared_users_updated_at" BEFORE UPDATE ON "public"."shared_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_stakeholder_intelligence_updated_at" BEFORE UPDATE ON "public"."stakeholder_intelligence" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_learning_preferences_updated_at" BEFORE UPDATE ON "public"."user_learning_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workflows_updated_at" BEFORE UPDATE ON "public"."workflows" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "vector_document_update_trigger" BEFORE UPDATE ON "public"."vector_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_vector_document_timestamp"();



ALTER TABLE ONLY "public"."action_item_dependencies"
    ADD CONSTRAINT "action_item_dependencies_action_item_id_fkey" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_item_dependencies"
    ADD CONSTRAINT "action_item_dependencies_blocks_action_item_id_fkey" FOREIGN KEY ("blocks_action_item_id") REFERENCES "public"."action_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_items"
    ADD CONSTRAINT "action_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_execution_logs"
    ADD CONSTRAINT "agent_execution_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_executions"
    ADD CONSTRAINT "agent_executions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_explanations"
    ADD CONSTRAINT "agent_explanations_agent_execution_id_fkey" FOREIGN KEY ("agent_execution_id") REFERENCES "public"."agent_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_overrides"
    ADD CONSTRAINT "agent_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_run_steps"
    ADD CONSTRAINT "agent_run_steps_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id");



ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bot_session_attendees"
    ADD CONSTRAINT "bot_session_attendees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bot_session_attendees"
    ADD CONSTRAINT "bot_session_attendees_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."bot_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bot_sessions"
    ADD CONSTRAINT "bot_sessions_consent_acknowledged_by_fkey" FOREIGN KEY ("consent_acknowledged_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bot_sessions"
    ADD CONSTRAINT "bot_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_messages"
    ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cross_app_events"
    ADD CONSTRAINT "cross_app_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id");



ALTER TABLE ONLY "public"."data_deletion_requests"
    ADD CONSTRAINT "data_deletion_requests_fulfilled_by_fkey" FOREIGN KEY ("fulfilled_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ecosystem_alerts"
    ADD CONSTRAINT "ecosystem_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ecosystem_alerts"
    ADD CONSTRAINT "ecosystem_alerts_event_row_id_fkey" FOREIGN KEY ("event_row_id") REFERENCES "public"."ecosystem_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_progress_history"
    ADD CONSTRAINT "goal_progress_history_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intelligence_profile_analytics"
    ADD CONSTRAINT "intelligence_profile_analytics_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."intelligence_profiles"("id");



ALTER TABLE ONLY "public"."intelligence_profile_effectiveness"
    ADD CONSTRAINT "intelligence_profile_effectiveness_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."intelligence_profiles"("id");



ALTER TABLE ONLY "public"."learning_patterns"
    ADD CONSTRAINT "learning_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_intelligence_config"
    ADD CONSTRAINT "meeting_intelligence_config_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."intelligence_profiles"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."metrics"
    ADD CONSTRAINT "metrics_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_connections"
    ADD CONSTRAINT "oauth_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_ai_usage_monthly"
    ADD CONSTRAINT "org_ai_usage_monthly_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."org_invites"
    ADD CONSTRAINT "org_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."queries"
    ADD CONSTRAINT "queries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."relationships"
    ADD CONSTRAINT "relationships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_companies"
    ADD CONSTRAINT "shared_companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."shared_users"("id");



ALTER TABLE ONLY "public"."shared_contacts"
    ADD CONSTRAINT "shared_contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."shared_users"("id");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_organizations"
    ADD CONSTRAINT "tenant_organizations_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_app_connections"
    ADD CONSTRAINT "user_app_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credentials"
    ADD CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_learning_preferences"
    ADD CONSTRAINT "user_learning_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shared_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_executions"
    ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_versions"
    ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflows"
    ADD CONSTRAINT "workflows_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."tenant_organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Service can manage context cache" ON "public"."intelligence_context_cache" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Service can manage effectiveness" ON "public"."intelligence_profile_effectiveness" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Service role can manage all deal risk scores" ON "public"."deal_risk_scores" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all dependencies" ON "public"."action_item_dependencies" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all stakeholder intelligence" ON "public"."stakeholder_intelligence" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage ecosystem config" ON "public"."ecosystem_config" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage ecosystem events" ON "public"."ecosystem_events" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage entity mappings" ON "public"."ecosystem_entity_map" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."vector_documents" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to projects" ON "public"."projects" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to tasks" ON "public"."tasks" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can create dependencies for their action items" ON "public"."action_item_dependencies" FOR INSERT WITH CHECK (("action_item_id" IN ( SELECT "action_items"."id"
   FROM "public"."action_items"
  WHERE ("action_items"."assigned_to_id" = "auth"."uid"()))));



CREATE POLICY "Users can create projects" ON "public"."projects" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("owner_id")::"text"));



CREATE POLICY "Users can delete dependencies for their action items" ON "public"."action_item_dependencies" FOR DELETE USING (("action_item_id" IN ( SELECT "action_items"."id"
   FROM "public"."action_items"
  WHERE ("action_items"."assigned_to_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own projects" ON "public"."projects" FOR DELETE USING ((("auth"."uid"())::"text" = ("owner_id")::"text"));



CREATE POLICY "Users can delete their own preferences" ON "public"."intelligence_preferences" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert analytics" ON "public"."intelligence_profile_analytics" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert their own deal risk scores" ON "public"."deal_risk_scores" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own preferences" ON "public"."intelligence_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own stakeholder intelligence" ON "public"."stakeholder_intelligence" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage meeting intelligence config" ON "public"."meeting_intelligence_config" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can manage own OAuth" ON "public"."oauth_connections" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own sessions" ON "public"."user_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own overrides" ON "public"."agent_overrides" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own patterns" ON "public"."learning_patterns" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own preferences" ON "public"."user_learning_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own profiles" ON "public"."intelligence_profiles" USING ((("auth"."role"() = 'authenticated'::"text") AND (("is_builtin" = false) OR ("auth"."role"() = 'service_role'::"text"))));



CREATE POLICY "Users can update analytics" ON "public"."intelligence_profile_analytics" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can update dependencies for their action items" ON "public"."action_item_dependencies" FOR UPDATE USING (("action_item_id" IN ( SELECT "action_items"."id"
   FROM "public"."action_items"
  WHERE ("action_items"."assigned_to_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own profile" ON "public"."shared_users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own projects" ON "public"."projects" FOR UPDATE USING ((("auth"."uid"())::"text" = ("owner_id")::"text"));



CREATE POLICY "Users can update their own deal risk scores" ON "public"."deal_risk_scores" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own preferences" ON "public"."intelligence_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own stakeholder intelligence" ON "public"."stakeholder_intelligence" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view active profiles" ON "public"."intelligence_profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view analytics" ON "public"."intelligence_profile_analytics" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view dependencies for their action items" ON "public"."action_item_dependencies" FOR SELECT USING ((("action_item_id" IN ( SELECT "action_items"."id"
   FROM "public"."action_items"
  WHERE ("action_items"."assigned_to_id" = "auth"."uid"()))) OR ("blocks_action_item_id" IN ( SELECT "action_items"."id"
   FROM "public"."action_items"
  WHERE ("action_items"."assigned_to_id" = "auth"."uid"())))));



CREATE POLICY "Users can view ecosystem config" ON "public"."ecosystem_config" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view ecosystem events" ON "public"."ecosystem_events" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view effectiveness" ON "public"."intelligence_profile_effectiveness" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view entity mappings" ON "public"."ecosystem_entity_map" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view explanations for their agent executions" ON "public"."agent_explanations" FOR SELECT USING (("agent_execution_id" IN ( SELECT "ae"."id"
   FROM ("public"."agent_executions" "ae"
     JOIN "public"."ai_agents" "a" ON (("ae"."agent_id" = "a"."id")))
  WHERE ("a"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can view own app connections" ON "public"."user_app_connections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own contacts" ON "public"."shared_contacts" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."shared_users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own projects" ON "public"."projects" FOR SELECT USING (((("auth"."uid"())::"text" = ("owner_id")::"text") OR (("auth"."uid"())::"text" = ANY (("team_ids")::"text"[]))));



CREATE POLICY "Users can view relevant events" ON "public"."cross_app_events" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own deal risk scores" ON "public"."deal_risk_scores" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own preferences" ON "public"."intelligence_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own stakeholder intelligence" ON "public"."stakeholder_intelligence" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own vector documents" ON "public"."vector_documents" USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



ALTER TABLE "public"."action_item_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."action_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_items_org" ON "public"."action_items" TO "authenticated" USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))) WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



CREATE POLICY "agent_exec_logs_insert_own" ON "public"."agent_execution_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_agents" "a"
  WHERE (("a"."id" = "agent_execution_logs"."agent_id") AND (("a"."user_id" = "auth"."uid"()) OR (("a"."created_by")::"text" = ("auth"."uid"())::"text"))))));



COMMENT ON POLICY "agent_exec_logs_insert_own" ON "public"."agent_execution_logs" IS 'Owner can append execution logs for their agents';



CREATE POLICY "agent_exec_logs_select_own" ON "public"."agent_execution_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_agents" "a"
  WHERE (("a"."id" = "agent_execution_logs"."agent_id") AND (("a"."user_id" = "auth"."uid"()) OR (("a"."created_by")::"text" = ("auth"."uid"())::"text"))))));



COMMENT ON POLICY "agent_exec_logs_select_own" ON "public"."agent_execution_logs" IS 'Owner can read execution logs for their agents';



ALTER TABLE "public"."agent_execution_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_explanations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_run_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_run_steps_insert_own" ON "public"."agent_run_steps" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."agent_runs" "ar"
     JOIN "public"."agents" "ag" ON (("ag"."id" = "ar"."agent_id")))
  WHERE (("ar"."id" = "agent_run_steps"."agent_run_id") AND ("ag"."created_by" = ("auth"."uid"())::"text")))));



CREATE POLICY "agent_run_steps_select_own" ON "public"."agent_run_steps" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."agent_runs" "ar"
     JOIN "public"."agents" "ag" ON (("ag"."id" = "ar"."agent_id")))
  WHERE (("ar"."id" = "agent_run_steps"."agent_run_id") AND ("ag"."created_by" = ("auth"."uid"())::"text")))));



ALTER TABLE "public"."agent_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_runs_insert_own" ON "public"."agent_runs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."agents" "ag"
  WHERE (("ag"."id" = "agent_runs"."agent_id") AND ("ag"."created_by" = ("auth"."uid"())::"text")))));



CREATE POLICY "agent_runs_select_own" ON "public"."agent_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."agents" "ag"
  WHERE (("ag"."id" = "agent_runs"."agent_id") AND ("ag"."created_by" = ("auth"."uid"())::"text")))));



CREATE POLICY "agent_runs_update_own" ON "public"."agent_runs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."agents" "ag"
  WHERE (("ag"."id" = "agent_runs"."agent_id") AND ("ag"."created_by" = ("auth"."uid"())::"text")))));



ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agents_delete_own" ON "public"."agents" FOR DELETE TO "authenticated" USING (("created_by" = ("auth"."uid"())::"text"));



CREATE POLICY "agents_insert_own" ON "public"."agents" FOR INSERT TO "authenticated" WITH CHECK ((COALESCE("created_by", ("auth"."uid"())::"text") = ("auth"."uid"())::"text"));



CREATE POLICY "agents_select_own" ON "public"."agents" FOR SELECT TO "authenticated" USING (("created_by" = ("auth"."uid"())::"text"));



CREATE POLICY "agents_update_own" ON "public"."agents" FOR UPDATE TO "authenticated" USING (("created_by" = ("auth"."uid"())::"text")) WITH CHECK (("created_by" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."ai_agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_agents_delete_own" ON "public"."ai_agents" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text")));



COMMENT ON POLICY "ai_agents_delete_own" ON "public"."ai_agents" IS 'Owner can remove their agents';



CREATE POLICY "ai_agents_insert_own" ON "public"."ai_agents" FOR INSERT TO "authenticated" WITH CHECK (((COALESCE("user_id", "auth"."uid"()) = "auth"."uid"()) AND (COALESCE(("created_by")::"text", ("auth"."uid"())::"text") = ("auth"."uid"())::"text")));



COMMENT ON POLICY "ai_agents_insert_own" ON "public"."ai_agents" IS 'Authenticated users create agents owned by themselves';



CREATE POLICY "ai_agents_select_own" ON "public"."ai_agents" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text")));



COMMENT ON POLICY "ai_agents_select_own" ON "public"."ai_agents" IS 'Owner can read their agents';



CREATE POLICY "ai_agents_update_own" ON "public"."ai_agents" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text")));



COMMENT ON POLICY "ai_agents_update_own" ON "public"."ai_agents" IS 'Owner can modify their agents';



ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_logs_insert_own" ON "public"."automation_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."automations" "a"
  WHERE (("a"."id" = "automation_logs"."automation_id") AND (("a"."user_id" = "auth"."uid"()) OR (("a"."created_by")::"text" = ("auth"."uid"())::"text"))))));



COMMENT ON POLICY "automation_logs_insert_own" ON "public"."automation_logs" IS 'Owner can append logs for their automations';



CREATE POLICY "automation_logs_select_own" ON "public"."automation_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."automations" "a"
  WHERE (("a"."id" = "automation_logs"."automation_id") AND (("a"."user_id" = "auth"."uid"()) OR (("a"."created_by")::"text" = ("auth"."uid"())::"text"))))));



COMMENT ON POLICY "automation_logs_select_own" ON "public"."automation_logs" IS 'Owner can read logs for their automations';



ALTER TABLE "public"."automation_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automations_delete_own" ON "public"."automations" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text")));



COMMENT ON POLICY "automations_delete_own" ON "public"."automations" IS 'Owner can remove their automations';



CREATE POLICY "automations_insert_own" ON "public"."automations" FOR INSERT TO "authenticated" WITH CHECK (((COALESCE("user_id", "auth"."uid"()) = "auth"."uid"()) AND (COALESCE(("created_by")::"text", ("auth"."uid"())::"text") = ("auth"."uid"())::"text")));



COMMENT ON POLICY "automations_insert_own" ON "public"."automations" IS 'Authenticated users create automations owned by themselves';



CREATE POLICY "automations_select_own" ON "public"."automations" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text")));



COMMENT ON POLICY "automations_select_own" ON "public"."automations" IS 'Owner can read their automations';



CREATE POLICY "automations_update_own" ON "public"."automations" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("created_by")::"text" = ("auth"."uid"())::"text")));



COMMENT ON POLICY "automations_update_own" ON "public"."automations" IS 'Owner can modify their automations';



ALTER TABLE "public"."bot_session_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bot_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bot_sessions_select" ON "public"."bot_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "bot_sessions"."org_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "bsa_select" ON "public"."bot_session_attendees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "bot_session_attendees"."org_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."components" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conv_messages_insert_own" ON "public"."conversation_messages" FOR INSERT WITH CHECK (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ("conversations"."user_id" = "auth"."uid"()))));



CREATE POLICY "conv_messages_select_own" ON "public"."conversation_messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ("conversations"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."conversation_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_delete_own" ON "public"."conversations" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "conversations_insert_own" ON "public"."conversations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "conversations_select_own" ON "public"."conversations" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "conversations_update_own" ON "public"."conversations" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."cross_app_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_deletion_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ddr_select_platform_admin" ON "public"."data_deletion_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE ("pa"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."deal_risk_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecosystem_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecosystem_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecosystem_entity_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecosystem_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."embeddings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_history_insert" ON "public"."goal_progress_history" FOR INSERT WITH CHECK (("goal_id" IN ( SELECT "goals"."id"
   FROM "public"."goals"
  WHERE (("goals"."owner_id" = "auth"."uid"()) OR (("goals"."team_id")::"text" IN ( SELECT ("users"."team_id")::"text" AS "team_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



CREATE POLICY "goal_history_select" ON "public"."goal_progress_history" FOR SELECT USING (("goal_id" IN ( SELECT "goals"."id"
   FROM "public"."goals"
  WHERE ((("goals"."goal_type")::"text" = 'company'::"text") OR ("goals"."owner_id" = "auth"."uid"()) OR (("goals"."team_id")::"text" IN ( SELECT ("users"."team_id")::"text" AS "team_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



ALTER TABLE "public"."goal_progress_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals_org" ON "public"."goals" TO "authenticated" USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))) WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."integration_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intelligence_context_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intelligence_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intelligence_profile_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intelligence_profile_effectiveness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intelligence_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_intelligence_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meetings_org" ON "public"."meetings" TO "authenticated" USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))) WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_ai_usage_monthly" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_ai_usage_select" ON "public"."org_ai_usage_monthly" FOR SELECT USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."org_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_invites_delete" ON "public"."org_invites" FOR DELETE USING ((("org_id" = "public"."user_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "org_invites"."org_id") AND ("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "org_invites_insert" ON "public"."org_invites" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



CREATE POLICY "org_invites_select" ON "public"."org_invites" FOR SELECT USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) OR ("email" = ( SELECT ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "org_invites_update" ON "public"."org_invites" FOR UPDATE USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."org_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_members_delete" ON "public"."org_members" FOR DELETE USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



CREATE POLICY "org_members_insert" ON "public"."org_members" FOR INSERT WITH CHECK ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND (EXISTS ( SELECT 1
   FROM "public"."org_members" "org_members_1"
  WHERE (("org_members_1"."org_id" = "org_members_1"."org_id") AND ("org_members_1"."user_id" = "auth"."uid"()) AND ("org_members_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "org_members_select" ON "public"."org_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))));



CREATE POLICY "org_members_update" ON "public"."org_members" FOR UPDATE USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



CREATE POLICY "pa_select_self" ON "public"."platform_admins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "inner_pa"
  WHERE ("inner_pa"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."queries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "relationships_org" ON "public"."relationships" TO "authenticated" USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))) WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."saved_searches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_searches_delete_own" ON "public"."saved_searches" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "saved_searches_insert_own" ON "public"."saved_searches" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "saved_searches_select_own" ON "public"."saved_searches" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "saved_searches_update_own" ON "public"."saved_searches" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."search_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "search_conversations_self" ON "public"."search_conversations" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."search_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "search_history_delete_own" ON "public"."search_history" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "search_history_insert_own" ON "public"."search_history" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "search_history_select_own" ON "public"."search_history" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."secret_references" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secrets_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secrets_vault" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_audit" ON "public"."secrets_audit_log" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_refs" ON "public"."secret_references" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_secrets" ON "public"."secrets" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."shared_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "social_accounts_delete_own" ON "public"."social_accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "social_accounts_insert_own" ON "public"."social_accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "social_accounts_select_own" ON "public"."social_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "social_accounts_update_own" ON "public"."social_accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."stakeholder_intelligence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_org" ON "public"."tasks" TO "authenticated" USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))) WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_delete_own" ON "public"."team_members" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "team_members_delete_own" ON "public"."team_members" IS 'Users can remove themselves from a team';



CREATE POLICY "team_members_insert_own" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "team_members_insert_own" ON "public"."team_members" IS 'Users can add themselves to a team';



CREATE POLICY "team_members_select_same_team" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("team_id" IN ( SELECT "tm"."team_id"
   FROM "public"."team_members" "tm"
  WHERE ("tm"."user_id" = "auth"."uid"()))));



COMMENT ON POLICY "team_members_select_same_team" ON "public"."team_members" IS 'Users can see members in their own team(s)';



CREATE POLICY "team_members_update_own" ON "public"."team_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "team_members_update_own" ON "public"."team_members" IS 'Users can update their own team membership';



CREATE POLICY "tenant_org_select" ON "public"."tenant_organizations" FOR SELECT USING ((("deleted_at" IS NULL) AND ("id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))));



CREATE POLICY "tenant_org_select_deleted" ON "public"."tenant_organizations" FOR SELECT USING ((("deleted_at" IS NOT NULL) AND ("id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))));



CREATE POLICY "tenant_org_update" ON "public"."tenant_organizations" FOR UPDATE USING (("id" = "public"."user_org_id"())) WITH CHECK ((("id" = "public"."user_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "tenant_organizations"."id") AND ("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."tenant_organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_orgs_insert" ON "public"."tenant_organizations" FOR INSERT WITH CHECK (true);



CREATE POLICY "tenant_orgs_update" ON "public"."tenant_organizations" FOR UPDATE USING (("id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."user_app_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_learning_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_settings_self" ON "public"."user_settings" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_manage_refs" ON "public"."secret_references" USING (("secret_id" IN ( SELECT "secrets"."id"
   FROM "public"."secrets"
  WHERE ("secrets"."user_id" = "auth"."uid"()))));



CREATE POLICY "users_own_secrets" ON "public"."secrets" USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "users_self" ON "public"."users" TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "users_view_audit" ON "public"."secrets_audit_log" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vector_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflows_org" ON "public"."workflows" TO "authenticated" USING (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids"))) WITH CHECK (("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_org_for_user"("p_name" "text", "p_slug" "text", "p_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_org_for_user"("p_name" "text", "p_slug" "text", "p_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ecosystem_alert_on_failure"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ecosystem_alert_on_failure"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ecosystem_alert_on_failure"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_collection_stats"("p_collection_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_collection_stats"("p_collection_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_collection_stats"("p_collection_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vector_collections"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_vector_collections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vector_collections"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hard_delete_org"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_org"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer, "vector_weight" double precision, "text_weight" double precision, "p_collection_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer, "vector_weight" double precision, "text_weight" double precision, "p_collection_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "match_count" integer, "vector_weight" double precision, "text_weight" double precision, "p_collection_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ai_usage"("p_org_id" "uuid", "p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ai_usage"("p_org_id" "uuid", "p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ai_usage"("p_org_id" "uuid", "p_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_secret_expired"("p_secret_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_secret_expired"("p_secret_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_secret_expired"("p_secret_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_secret_create"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_secret_create"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_secret_create"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_secret_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_secret_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_secret_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_org"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_org"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_documents_by_embedding"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_source_types" "text"[], "filter_date_from" timestamp with time zone, "filter_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_embeddings"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_vectors_cosine"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."search_vectors_cosine"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_vectors_cosine"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_vectors_euclidean"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."search_vectors_euclidean"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_vectors_euclidean"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_vectors_inner_product"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."search_vectors_inner_product"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_vectors_inner_product"("query_embedding" "public"."vector", "match_count" integer, "similarity_threshold" double precision, "p_collection_name" "text", "metadata_filter" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_org"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_org"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ecosystem_config_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ecosystem_config_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ecosystem_config_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_intelligence_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_intelligence_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_intelligence_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_social_accounts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_social_accounts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_social_accounts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vector_document_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_vector_document_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vector_document_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_org_id"() TO "service_role";



GRANT ALL ON TABLE "public"."action_item_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."action_item_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."action_item_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."action_items" TO "anon";
GRANT ALL ON TABLE "public"."action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."action_items" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."agent_execution_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_execution_logs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_executions" TO "anon";
GRANT ALL ON TABLE "public"."agent_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_executions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_explanations" TO "anon";
GRANT ALL ON TABLE "public"."agent_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_explanations" TO "service_role";



GRANT ALL ON TABLE "public"."agent_overrides" TO "anon";
GRANT ALL ON TABLE "public"."agent_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."agent_run_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_run_steps" TO "service_role";



GRANT ALL ON TABLE "public"."agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."ai_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_agents" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."automation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."automation_templates" TO "anon";
GRANT ALL ON TABLE "public"."automation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."automations" TO "authenticated";
GRANT ALL ON TABLE "public"."automations" TO "service_role";



GRANT ALL ON TABLE "public"."bot_session_attendees" TO "anon";
GRANT ALL ON TABLE "public"."bot_session_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."bot_session_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."bot_sessions" TO "anon";
GRANT ALL ON TABLE "public"."bot_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."bot_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."components" TO "anon";
GRANT ALL ON TABLE "public"."components" TO "authenticated";
GRANT ALL ON TABLE "public"."components" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_messages" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."cross_app_events" TO "anon";
GRANT ALL ON TABLE "public"."cross_app_events" TO "authenticated";
GRANT ALL ON TABLE "public"."cross_app_events" TO "service_role";



GRANT ALL ON TABLE "public"."data_deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."deal_risk_scores" TO "anon";
GRANT ALL ON TABLE "public"."deal_risk_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."deal_risk_scores" TO "service_role";



GRANT ALL ON TABLE "public"."ecosystem_alerts" TO "anon";
GRANT ALL ON TABLE "public"."ecosystem_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."ecosystem_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."ecosystem_config" TO "anon";
GRANT ALL ON TABLE "public"."ecosystem_config" TO "authenticated";
GRANT ALL ON TABLE "public"."ecosystem_config" TO "service_role";



GRANT ALL ON TABLE "public"."ecosystem_entity_map" TO "anon";
GRANT ALL ON TABLE "public"."ecosystem_entity_map" TO "authenticated";
GRANT ALL ON TABLE "public"."ecosystem_entity_map" TO "service_role";



GRANT ALL ON TABLE "public"."ecosystem_events" TO "anon";
GRANT ALL ON TABLE "public"."ecosystem_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ecosystem_events" TO "service_role";



GRANT ALL ON TABLE "public"."embeddings" TO "anon";
GRANT ALL ON TABLE "public"."embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."embeddings" TO "service_role";



GRANT ALL ON TABLE "public"."goal_progress_history" TO "anon";
GRANT ALL ON TABLE "public"."goal_progress_history" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_progress_history" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."integration_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_logs" TO "service_role";



GRANT ALL ON TABLE "public"."intelligence_context_cache" TO "anon";
GRANT ALL ON TABLE "public"."intelligence_context_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."intelligence_context_cache" TO "service_role";



GRANT ALL ON TABLE "public"."intelligence_preferences" TO "anon";
GRANT ALL ON TABLE "public"."intelligence_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."intelligence_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."intelligence_profile_analytics" TO "anon";
GRANT ALL ON TABLE "public"."intelligence_profile_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."intelligence_profile_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."intelligence_profile_effectiveness" TO "anon";
GRANT ALL ON TABLE "public"."intelligence_profile_effectiveness" TO "authenticated";
GRANT ALL ON TABLE "public"."intelligence_profile_effectiveness" TO "service_role";



GRANT ALL ON TABLE "public"."intelligence_profiles" TO "anon";
GRANT ALL ON TABLE "public"."intelligence_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."intelligence_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."learning_patterns" TO "anon";
GRANT ALL ON TABLE "public"."learning_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_intelligence_config" TO "anon";
GRANT ALL ON TABLE "public"."meeting_intelligence_config" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_intelligence_config" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."metrics" TO "anon";
GRANT ALL ON TABLE "public"."metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."metrics" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_connections" TO "anon";
GRANT ALL ON TABLE "public"."oauth_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_connections" TO "service_role";



GRANT ALL ON TABLE "public"."org_ai_usage_monthly" TO "anon";
GRANT ALL ON TABLE "public"."org_ai_usage_monthly" TO "authenticated";
GRANT ALL ON TABLE "public"."org_ai_usage_monthly" TO "service_role";



GRANT ALL ON TABLE "public"."org_invites" TO "anon";
GRANT ALL ON TABLE "public"."org_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invites" TO "service_role";



GRANT ALL ON TABLE "public"."org_members" TO "anon";
GRANT ALL ON TABLE "public"."org_members" TO "authenticated";
GRANT ALL ON TABLE "public"."org_members" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."queries" TO "anon";
GRANT ALL ON TABLE "public"."queries" TO "authenticated";
GRANT ALL ON TABLE "public"."queries" TO "service_role";



GRANT ALL ON TABLE "public"."relationships" TO "anon";
GRANT ALL ON TABLE "public"."relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."relationships" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."search_conversations" TO "anon";
GRANT ALL ON TABLE "public"."search_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."search_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."search_documents" TO "anon";
GRANT ALL ON TABLE "public"."search_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."search_documents" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."search_history" TO "anon";
GRANT ALL ON TABLE "public"."search_history" TO "authenticated";
GRANT ALL ON TABLE "public"."search_history" TO "service_role";



GRANT ALL ON TABLE "public"."secret_references" TO "anon";
GRANT ALL ON TABLE "public"."secret_references" TO "authenticated";
GRANT ALL ON TABLE "public"."secret_references" TO "service_role";



GRANT ALL ON TABLE "public"."secrets" TO "anon";
GRANT ALL ON TABLE "public"."secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."secrets" TO "service_role";



GRANT ALL ON TABLE "public"."secrets_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."secrets_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."secrets_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."secrets_vault" TO "anon";
GRANT ALL ON TABLE "public"."secrets_vault" TO "authenticated";
GRANT ALL ON TABLE "public"."secrets_vault" TO "service_role";



GRANT ALL ON TABLE "public"."shared_companies" TO "anon";
GRANT ALL ON TABLE "public"."shared_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_companies" TO "service_role";



GRANT ALL ON TABLE "public"."shared_contacts" TO "anon";
GRANT ALL ON TABLE "public"."shared_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."shared_users" TO "anon";
GRANT ALL ON TABLE "public"."shared_users" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_users" TO "service_role";



GRANT ALL ON TABLE "public"."social_accounts" TO "anon";
GRANT ALL ON TABLE "public"."social_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."stakeholder_intelligence" TO "anon";
GRANT ALL ON TABLE "public"."stakeholder_intelligence" TO "authenticated";
GRANT ALL ON TABLE "public"."stakeholder_intelligence" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_organizations" TO "anon";
GRANT ALL ON TABLE "public"."tenant_organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_organizations" TO "service_role";



GRANT ALL ON TABLE "public"."user_app_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_app_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_app_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_credentials" TO "anon";
GRANT ALL ON TABLE "public"."user_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."user_learning_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_learning_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_learning_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vector_documents" TO "anon";
GRANT ALL ON TABLE "public"."vector_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."vector_documents" TO "service_role";



GRANT ALL ON TABLE "public"."vector_collections_overview" TO "anon";
GRANT ALL ON TABLE "public"."vector_collections_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."vector_collections_overview" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_executions" TO "anon";
GRANT ALL ON TABLE "public"."workflow_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_executions" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_versions" TO "anon";
GRANT ALL ON TABLE "public"."workflow_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_versions" TO "service_role";



GRANT ALL ON TABLE "public"."workflows" TO "anon";
GRANT ALL ON TABLE "public"."workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."workflows" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
