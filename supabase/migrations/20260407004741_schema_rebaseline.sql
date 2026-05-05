-- Live-schema baseline generated from linked Supabase project on 2026-04-07.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";


--
-- Name: embedding_similarity("extensions"."vector", "extensions"."vector"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."embedding_similarity"("embedding_a" "extensions"."vector", "embedding_b" "extensions"."vector") RETURNS double precision
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select 1 - (embedding_a <=> embedding_b);
$$;


ALTER FUNCTION "public"."embedding_similarity"("embedding_a" "extensions"."vector", "embedding_b" "extensions"."vector") OWNER TO "postgres";

--
-- Name: match_embeddings("extensions"."vector", "text", integer, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."match_embeddings"("query_embedding" "extensions"."vector", "match_entity_type" "text", "match_limit" integer DEFAULT 10, "min_similarity" double precision DEFAULT 0.5) RETURNS TABLE("entity_type" "text", "entity_id" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select e.entity_type, e.entity_id,
    1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  where e.entity_type = match_entity_type
    and 1 - (e.embedding <=> query_embedding) > min_similarity
  order by e.embedding <=> query_embedding
  limit match_limit;
end;
$$;


ALTER FUNCTION "public"."match_embeddings"("query_embedding" "extensions"."vector", "match_entity_type" "text", "match_limit" integer, "min_similarity" double precision) OWNER TO "postgres";

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."admin_audit_log" (
    "id" bigint NOT NULL,
    "wallet_address" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target" "text",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";

--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."admin_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: agent_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."agent_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "context_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_conversations" OWNER TO "postgres";

--
-- Name: ai_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."ai_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "stake_address" "text",
    "skill_name" "text" NOT NULL,
    "proposal_tx_hash" "text",
    "proposal_index" integer,
    "draft_id" "uuid",
    "model_used" "text" DEFAULT ''::"text" NOT NULL,
    "tokens_used" integer,
    "key_source" "text" DEFAULT 'platform'::"text" NOT NULL,
    "edit_distance" real,
    "input_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_activity_log_key_source_check" CHECK (("key_source" = ANY (ARRAY['platform'::"text", 'byok'::"text"])))
);


ALTER TABLE "public"."ai_activity_log" OWNER TO "postgres";

--
-- Name: ai_health_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."ai_health_metrics" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "use_case" "text" NOT NULL,
    "model" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "status" "text" NOT NULL,
    "latency_ms" integer,
    "input_valid" boolean,
    "input_rejection_reason" "text",
    "output_valid" boolean,
    "output_rejection_reason" "text",
    "divergence" real,
    "divergence_flag" boolean DEFAULT false,
    "tokens_used" integer,
    "error_message" "text"
);


ALTER TABLE "public"."ai_health_metrics" OWNER TO "postgres";

--
-- Name: ai_health_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."ai_health_metrics_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_health_metrics_id_seq" OWNER TO "postgres";

--
-- Name: ai_health_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."ai_health_metrics_id_seq" OWNED BY "public"."ai_health_metrics"."id";


--
-- Name: alignment_drift_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."alignment_drift_records" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "drep_id" "text" NOT NULL,
    "drift_score" numeric(5,2) NOT NULL,
    "drift_classification" "text" NOT NULL,
    "dimension_drifts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "alternative_dreps" "jsonb" DEFAULT '[]'::"jsonb",
    "epoch_no" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "alignment_drift_records_drift_classification_check" CHECK (("drift_classification" = ANY (ARRAY['low'::"text", 'moderate'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."alignment_drift_records" OWNER TO "postgres";

--
-- Name: alignment_drift_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."alignment_drift_records" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."alignment_drift_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: alignment_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."alignment_snapshots" (
    "drep_id" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "alignment_treasury_conservative" integer,
    "alignment_treasury_growth" integer,
    "alignment_decentralization" integer,
    "alignment_security" integer,
    "alignment_innovation" integer,
    "alignment_transparency" integer,
    "pca_coordinates" real[],
    "snapshot_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alignment_snapshots" OWNER TO "postgres";

--
-- Name: amendment_genealogy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."amendment_genealogy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "change_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "action_by" "text",
    "action_reason" "text",
    "source_type" "text",
    "parent_change_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "amendment_genealogy_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'accepted'::"text", 'rejected'::"text", 'modified'::"text", 'merged'::"text"]))),
    CONSTRAINT "amendment_genealogy_source_type_check" CHECK (("source_type" = ANY (ARRAY['author'::"text", 'reviewer'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."amendment_genealogy" OWNER TO "postgres";

--
-- Name: amendment_section_sentiment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."amendment_section_sentiment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "section_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sentiment" "text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "amendment_section_sentiment_sentiment_check" CHECK (("sentiment" = ANY (ARRAY['support'::"text", 'oppose'::"text", 'neutral'::"text"])))
);


ALTER TABLE "public"."amendment_section_sentiment" OWNER TO "postgres";

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "name" "text" NOT NULL,
    "tier" "text" DEFAULT 'public'::"text" NOT NULL,
    "owner_wallet" "text",
    "rate_limit" integer DEFAULT 100 NOT NULL,
    "rate_window" "text" DEFAULT 'hour'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "api_keys_rate_window_check" CHECK (("rate_window" = ANY (ARRAY['hour'::"text", 'day'::"text"]))),
    CONSTRAINT "api_keys_tier_check" CHECK (("tier" = ANY (ARRAY['public'::"text", 'pro'::"text", 'business'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";

--
-- Name: api_usage_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."api_usage_log" (
    "id" bigint NOT NULL,
    "key_id" "uuid",
    "key_prefix" "text",
    "tier" "text" DEFAULT 'anonymous'::"text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "method" "text" DEFAULT 'GET'::"text" NOT NULL,
    "status_code" integer NOT NULL,
    "response_ms" integer,
    "data_age_s" integer,
    "ip_hash" "text",
    "user_agent" "text",
    "error_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."api_usage_log" OWNER TO "postgres";

--
-- Name: api_usage_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."api_usage_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."api_usage_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: catalyst_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."catalyst_campaigns" (
    "id" "text" NOT NULL,
    "fund_id" "text",
    "title" "text" NOT NULL,
    "slug" "text",
    "excerpt" "text",
    "amount" bigint,
    "launched_at" timestamp with time zone,
    "awarded_at" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalyst_campaigns" OWNER TO "postgres";

--
-- Name: TABLE "catalyst_campaigns"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."catalyst_campaigns" IS 'Challenge categories within each Catalyst fund round.';


--
-- Name: catalyst_funds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."catalyst_funds" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text",
    "status" "text",
    "currency" "text" DEFAULT 'ADA'::"text",
    "currency_symbol" "text" DEFAULT 'â‚³'::"text",
    "amount" bigint,
    "launched_at" timestamp with time zone,
    "awarded_at" timestamp with time zone,
    "hero_img_url" "text",
    "banner_img_url" "text",
    "proposals_count" integer DEFAULT 0,
    "funded_count" integer DEFAULT 0,
    "completed_count" integer DEFAULT 0,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalyst_funds" OWNER TO "postgres";

--
-- Name: TABLE "catalyst_funds"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."catalyst_funds" IS 'Project Catalyst funding rounds (Fund 2-15).';


--
-- Name: catalyst_proposal_team; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."catalyst_proposal_team" (
    "proposal_id" "text" NOT NULL,
    "team_member_id" "text" NOT NULL
);


ALTER TABLE "public"."catalyst_proposal_team" OWNER TO "postgres";

--
-- Name: TABLE "catalyst_proposal_team"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."catalyst_proposal_team" IS 'Junction table linking proposals to their team members.';


--
-- Name: catalyst_proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."catalyst_proposals" (
    "id" "text" NOT NULL,
    "fund_id" "text",
    "campaign_id" "text",
    "title" "text" NOT NULL,
    "slug" "text",
    "status" "text",
    "funding_status" "text",
    "yes_votes_count" bigint,
    "no_votes_count" bigint,
    "abstain_votes_count" bigint,
    "unique_wallets" integer,
    "yes_wallets" integer,
    "no_wallets" integer,
    "amount_requested" bigint,
    "amount_received" bigint,
    "currency" "text" DEFAULT 'USD'::"text",
    "problem" "text",
    "solution" "text",
    "experience" "text",
    "project_details" "jsonb",
    "alignment_score" real,
    "feasibility_score" real,
    "auditability_score" real,
    "website" "text",
    "opensource" boolean DEFAULT false,
    "project_length" "text",
    "funded_at" timestamp with time zone,
    "link" "text",
    "chain_proposal_id" "text",
    "chain_proposal_index" integer,
    "ideascale_id" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalyst_proposals" OWNER TO "postgres";

--
-- Name: TABLE "catalyst_proposals"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."catalyst_proposals" IS 'All Project Catalyst proposals across all fund rounds.';


--
-- Name: catalyst_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."catalyst_team_members" (
    "id" "text" NOT NULL,
    "username" "text",
    "name" "text",
    "bio" "text",
    "twitter" "text",
    "linkedin" "text",
    "discord" "text",
    "ideascale" "text",
    "telegram" "text",
    "hero_img_url" "text",
    "submitted_proposals" integer DEFAULT 0,
    "funded_proposals" integer DEFAULT 0,
    "completed_proposals" integer DEFAULT 0,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalyst_team_members" OWNER TO "postgres";

--
-- Name: TABLE "catalyst_team_members"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."catalyst_team_members" IS 'Catalyst proposers and team members.';


--
-- Name: cc_agreement_matrix; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_agreement_matrix" (
    "member_a" "text" NOT NULL,
    "member_b" "text" NOT NULL,
    "agreement_pct" numeric(5,2),
    "total_shared_proposals" integer,
    "agreed_count" integer,
    "disagreed_count" integer,
    "last_disagreement_proposal" "text",
    "last_disagreement_index" integer,
    "computed_at" timestamp with time zone DEFAULT "now"(),
    "reasoning_similarity_pct" numeric(5,2),
    "shared_articles_count" integer,
    "total_articles_union" integer
);


ALTER TABLE "public"."cc_agreement_matrix" OWNER TO "postgres";

--
-- Name: COLUMN "cc_agreement_matrix"."reasoning_similarity_pct"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_agreement_matrix"."reasoning_similarity_pct" IS 'Jaccard similarity of constitutional article citation sets between two members (0-100). Primary heatmap metric since vote agreement is near-uniform.';


--
-- Name: COLUMN "cc_agreement_matrix"."shared_articles_count"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_agreement_matrix"."shared_articles_count" IS 'Number of constitutional articles both members have cited.';


--
-- Name: COLUMN "cc_agreement_matrix"."total_articles_union"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_agreement_matrix"."total_articles_union" IS 'Total unique articles cited by either member (union set size).';


--
-- Name: cc_bloc_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_bloc_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bloc_label" "text" NOT NULL,
    "cc_hot_id" "text" NOT NULL,
    "internal_agreement_pct" numeric(5,2),
    "member_count" integer,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_bloc_assignments" OWNER TO "postgres";

--
-- Name: cc_fidelity_proposal_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_fidelity_proposal_snapshots" (
    "cc_hot_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer DEFAULT 0 NOT NULL,
    "fidelity_score" integer,
    "participation_score" real,
    "constitutional_grounding_score" real,
    "rationale_quality_score" real,
    "votes_cast" integer DEFAULT 0,
    "eligible_proposals" integer DEFAULT 0,
    "proposal_epoch" integer,
    "snapshot_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_fidelity_proposal_snapshots" OWNER TO "postgres";

--
-- Name: cc_fidelity_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_fidelity_snapshots" (
    "cc_hot_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "fidelity_score" integer,
    "participation_score" real,
    "rationale_quality_score" real,
    "constitutional_grounding_score" real,
    "votes_cast" integer DEFAULT 0,
    "eligible_proposals" integer DEFAULT 0,
    "snapshot_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_fidelity_snapshots" OWNER TO "postgres";

--
-- Name: cc_intelligence_briefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_intelligence_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_type" "text" NOT NULL,
    "reference_id" "text" NOT NULL,
    "persona_variant" "text" DEFAULT 'default'::"text",
    "headline" "text",
    "executive_summary" "text",
    "key_findings" "jsonb",
    "what_changed" "text",
    "full_narrative" "text",
    "citations" "jsonb",
    "input_hash" "text",
    "model_version" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."cc_intelligence_briefs" OWNER TO "postgres";

--
-- Name: cc_interpretation_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_interpretation_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cc_hot_id" "text" NOT NULL,
    "article" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "epoch" integer,
    "interpretation_stance" "text",
    "interpretation_summary" "text",
    "consistent_with_prior" boolean,
    "drift_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_interpretation_history" OWNER TO "postgres";

--
-- Name: cc_member_archetypes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_member_archetypes" (
    "cc_hot_id" "text" NOT NULL,
    "archetype_label" "text" NOT NULL,
    "archetype_description" "text",
    "strictness_score" numeric(5,2),
    "specialization" "jsonb",
    "independence_profile" "text",
    "most_aligned_member" "text",
    "most_aligned_pct" numeric(5,2),
    "most_divergent_member" "text",
    "most_divergent_pct" numeric(5,2),
    "sole_dissenter_count" integer DEFAULT 0,
    "sole_dissenter_proposals" "jsonb",
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_member_archetypes" OWNER TO "postgres";

--
-- Name: cc_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_members" (
    "cc_hot_id" "text" NOT NULL,
    "cc_cold_id" "text",
    "author_name" "text",
    "status" "text",
    "expiration_epoch" integer,
    "has_script" boolean DEFAULT false,
    "fidelity_score" integer,
    "rationale_provision_rate" real,
    "avg_article_coverage" real,
    "avg_reasoning_quality" real,
    "consistency_score" real,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "participation_score" real,
    "rationale_quality_score" real,
    "constitutional_grounding_score" real,
    "fidelity_grade" "text",
    "votes_cast" integer DEFAULT 0,
    "eligible_proposals" integer DEFAULT 0,
    "authorization_epoch" integer,
    "alignment_treasury_conservative" numeric,
    "alignment_treasury_growth" numeric,
    "alignment_decentralization" numeric,
    "alignment_security" numeric,
    "alignment_innovation" numeric,
    "alignment_transparency" numeric
);


ALTER TABLE "public"."cc_members" OWNER TO "postgres";

--
-- Name: COLUMN "cc_members"."alignment_treasury_conservative"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_members"."alignment_treasury_conservative" IS 'Alignment score (0-100) derived from voting correlation with DRep landscape';


--
-- Name: COLUMN "cc_members"."alignment_treasury_growth"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_members"."alignment_treasury_growth" IS 'Alignment score (0-100) derived from voting correlation with DRep landscape';


--
-- Name: COLUMN "cc_members"."alignment_decentralization"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_members"."alignment_decentralization" IS 'Alignment score (0-100) derived from voting correlation with DRep landscape';


--
-- Name: COLUMN "cc_members"."alignment_security"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_members"."alignment_security" IS 'Alignment score (0-100) derived from voting correlation with DRep landscape';


--
-- Name: COLUMN "cc_members"."alignment_innovation"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_members"."alignment_innovation" IS 'Alignment score (0-100) derived from voting correlation with DRep landscape';


--
-- Name: COLUMN "cc_members"."alignment_transparency"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."cc_members"."alignment_transparency" IS 'Alignment score (0-100) derived from voting correlation with DRep landscape';


--
-- Name: cc_precedent_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_precedent_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_tx_hash" "text" NOT NULL,
    "source_index" integer NOT NULL,
    "target_tx_hash" "text" NOT NULL,
    "target_index" integer NOT NULL,
    "relationship" "text" NOT NULL,
    "shared_articles" "jsonb",
    "explanation" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_precedent_links" OWNER TO "postgres";

--
-- Name: cc_predictive_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_predictive_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "predicted_outcome" "text",
    "predicted_split" "jsonb",
    "confidence" smallint,
    "reasoning" "text",
    "key_article" "text",
    "tension_flag" boolean DEFAULT false,
    "actual_outcome" "text",
    "prediction_accurate" boolean,
    "model_version" "text" NOT NULL,
    "predicted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cc_predictive_signals" OWNER TO "postgres";

--
-- Name: cc_rationale_analysis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_rationale_analysis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cc_hot_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "interpretation_stance" "text",
    "key_arguments" "jsonb",
    "logical_structure" "text",
    "rationality_score" smallint,
    "reciprocity_score" smallint,
    "clarity_score" smallint,
    "deliberation_quality" smallint,
    "articles_analyzed" "jsonb",
    "novel_interpretation" boolean DEFAULT false,
    "contradicts_own_precedent" boolean DEFAULT false,
    "notable_finding" "text",
    "finding_severity" "text",
    "model_version" "text" NOT NULL,
    "analyzed_at" timestamp with time zone DEFAULT "now"(),
    "boilerplate_score" integer,
    "confidence" integer
);


ALTER TABLE "public"."cc_rationale_analysis" OWNER TO "postgres";

--
-- Name: cc_rationales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_rationales" (
    "cc_hot_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "meta_url" "text" NOT NULL,
    "meta_hash" "text",
    "author_name" "text",
    "summary" "text",
    "rationale_statement" "text",
    "precedent_discussion" "text",
    "counterargument_discussion" "text",
    "conclusion" "text",
    "internal_vote" "jsonb",
    "cited_articles" "jsonb",
    "raw_json" "jsonb",
    "fidelity_score" integer,
    "article_coverage_score" integer,
    "reasoning_quality_score" integer,
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "scored_at" timestamp with time zone
);


ALTER TABLE "public"."cc_rationales" OWNER TO "postgres";

--
-- Name: cc_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cc_votes" (
    "cc_hot_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "vote" "text" NOT NULL,
    "block_time" integer NOT NULL,
    "tx_hash" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "meta_url" "text",
    "meta_hash" "text",
    "cc_cold_id" "text",
    CONSTRAINT "cc_votes_vote_check" CHECK (("vote" = ANY (ARRAY['Yes'::"text", 'No'::"text", 'Abstain'::"text"])))
);


ALTER TABLE "public"."cc_votes" OWNER TO "postgres";

--
-- Name: cip108_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."cip108_documents" (
    "content_hash" "text" NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "owner_stake_address" "text" NOT NULL,
    "document" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cip108_documents" OWNER TO "postgres";

--
-- Name: citizen_assemblies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_assemblies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "question" "text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "epoch" integer NOT NULL,
    "opens_at" timestamp with time zone NOT NULL,
    "closes_at" timestamp with time zone NOT NULL,
    "results" "jsonb",
    "total_votes" integer DEFAULT 0,
    "ai_context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "quorum_threshold" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "citizen_assemblies_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'ai_generated'::"text"]))),
    CONSTRAINT "citizen_assemblies_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."citizen_assemblies" OWNER TO "postgres";

--
-- Name: COLUMN "citizen_assemblies"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."citizen_assemblies"."status" IS 'draft | active | closed | cancelled | quorum_not_met';


--
-- Name: COLUMN "citizen_assemblies"."quorum_threshold"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."citizen_assemblies"."quorum_threshold" IS 'Minimum votes required for assembly results to be valid. 0 = no quorum.';


--
-- Name: citizen_assembly_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_assembly_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assembly_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "selected_option" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."citizen_assembly_responses" OWNER TO "postgres";

--
-- Name: citizen_concern_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_concern_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "flag_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "citizen_concern_flags_flag_type_check" CHECK (("flag_type" = ANY (ARRAY['too_expensive'::"text", 'team_unproven'::"text", 'duplicates_existing'::"text", 'constitutional_concern'::"text", 'insufficient_detail'::"text", 'unrealistic_timeline'::"text", 'conflict_of_interest'::"text", 'scope_too_broad'::"text"])))
);


ALTER TABLE "public"."citizen_concern_flags" OWNER TO "postgres";

--
-- Name: citizen_endorsements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_endorsements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "endorsement_type" "text" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "citizen_endorsements_endorsement_type_check" CHECK (("endorsement_type" = ANY (ARRAY['general'::"text", 'treasury_oversight'::"text", 'technical_expertise'::"text", 'communication'::"text", 'community_leadership'::"text"]))),
    CONSTRAINT "citizen_endorsements_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['drep'::"text", 'spo'::"text"])))
);


ALTER TABLE "public"."citizen_endorsements" OWNER TO "postgres";

--
-- Name: citizen_epoch_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_epoch_summaries" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "delegated_drep_id" "text",
    "delegated_pool_id" "text",
    "drep_votes_cast" integer DEFAULT 0,
    "drep_score_at_epoch" integer,
    "drep_tier_at_epoch" "text",
    "spo_votes_cast" integer DEFAULT 0,
    "spo_score_at_epoch" integer,
    "proposals_voted_on" integer DEFAULT 0,
    "treasury_allocated_lovelace" bigint DEFAULT 0,
    "alignment_drift_score" numeric(5,2),
    "summary_json" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."citizen_epoch_summaries" OWNER TO "postgres";

--
-- Name: citizen_epoch_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_epoch_summaries" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."citizen_epoch_summaries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: citizen_impact_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_impact_scores" (
    "user_id" "uuid" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "delegation_tenure_score" numeric DEFAULT 0 NOT NULL,
    "rep_activity_score" numeric DEFAULT 0 NOT NULL,
    "engagement_depth_score" numeric DEFAULT 0 NOT NULL,
    "coverage_score" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "citizen_impact_scores_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (100)::numeric)))
);


ALTER TABLE "public"."citizen_impact_scores" OWNER TO "postgres";

--
-- Name: TABLE "citizen_impact_scores"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."citizen_impact_scores" IS 'Composite governance impact score (0-100) with 4-pillar breakdown for each citizen.';


--
-- Name: citizen_impact_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_impact_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "awareness" "text" NOT NULL,
    "rating" "text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "citizen_impact_tags_awareness_check" CHECK (("awareness" = ANY (ARRAY['i_use_this'::"text", 'i_tried_it'::"text", 'didnt_know_about_it'::"text"]))),
    CONSTRAINT "citizen_impact_tags_rating_check" CHECK (("rating" = ANY (ARRAY['essential'::"text", 'useful'::"text", 'okay'::"text", 'disappointing'::"text"])))
);


ALTER TABLE "public"."citizen_impact_tags" OWNER TO "postgres";

--
-- Name: citizen_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "milestone_key" "text" NOT NULL,
    "milestone_label" "text",
    "epoch" integer,
    "achieved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."citizen_milestones" OWNER TO "postgres";

--
-- Name: citizen_priority_rankings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_priority_rankings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "epoch" integer NOT NULL,
    "rankings" "jsonb" NOT NULL,
    "total_voters" integer DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."citizen_priority_rankings" OWNER TO "postgres";

--
-- Name: citizen_priority_signals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_priority_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "ranked_priorities" "text"[] NOT NULL,
    "epoch" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "citizen_priority_signals_ranked_priorities_check" CHECK ((("array_length"("ranked_priorities", 1) >= 1) AND ("array_length"("ranked_priorities", 1) <= 5)))
);


ALTER TABLE "public"."citizen_priority_signals" OWNER TO "postgres";

--
-- Name: citizen_proposal_followups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_proposal_followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "sentiment" "text" NOT NULL,
    "outcome" "text",
    "notified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."citizen_proposal_followups" OWNER TO "postgres";

--
-- Name: citizen_ring_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_ring_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "epoch" integer NOT NULL,
    "delegation_ring" numeric(4,3) NOT NULL,
    "coverage_ring" numeric(4,3) NOT NULL,
    "engagement_ring" numeric(4,3) NOT NULL,
    "pulse" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."citizen_ring_snapshots" OWNER TO "postgres";

--
-- Name: citizen_sentiment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."citizen_sentiment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "delegated_drep_id" "text",
    "sentiment" "text" NOT NULL,
    "initial_sentiment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "citizen_sentiment_initial_sentiment_check" CHECK (("initial_sentiment" = ANY (ARRAY['support'::"text", 'oppose'::"text", 'unsure'::"text"]))),
    CONSTRAINT "citizen_sentiment_sentiment_check" CHECK (("sentiment" = ANY (ARRAY['support'::"text", 'oppose'::"text", 'unsure'::"text"])))
);


ALTER TABLE "public"."citizen_sentiment" OWNER TO "postgres";

--
-- Name: classification_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."classification_history" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "classified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dim_treasury_conservative" real NOT NULL,
    "dim_treasury_growth" real NOT NULL,
    "dim_decentralization" real NOT NULL,
    "dim_security" real NOT NULL,
    "dim_innovation" real NOT NULL,
    "dim_transparency" real NOT NULL,
    "classifier_version" "text" DEFAULT 'v1'::"text" NOT NULL,
    CONSTRAINT "classification_history_dim_decentralization_check" CHECK ((("dim_decentralization" >= (0)::double precision) AND ("dim_decentralization" <= (1)::double precision))),
    CONSTRAINT "classification_history_dim_innovation_check" CHECK ((("dim_innovation" >= (0)::double precision) AND ("dim_innovation" <= (1)::double precision))),
    CONSTRAINT "classification_history_dim_security_check" CHECK ((("dim_security" >= (0)::double precision) AND ("dim_security" <= (1)::double precision))),
    CONSTRAINT "classification_history_dim_transparency_check" CHECK ((("dim_transparency" >= (0)::double precision) AND ("dim_transparency" <= (1)::double precision))),
    CONSTRAINT "classification_history_dim_treasury_conservative_check" CHECK ((("dim_treasury_conservative" >= (0)::double precision) AND ("dim_treasury_conservative" <= (1)::double precision))),
    CONSTRAINT "classification_history_dim_treasury_growth_check" CHECK ((("dim_treasury_growth" >= (0)::double precision) AND ("dim_treasury_growth" <= (1)::double precision)))
);


ALTER TABLE "public"."classification_history" OWNER TO "postgres";

--
-- Name: committee_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."committee_members" (
    "cc_hot_id" "text" NOT NULL,
    "cc_cold_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_epoch" integer,
    "expiration_epoch" integer,
    "anchor_url" "text",
    "anchor_hash" "text",
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."committee_members" OWNER TO "postgres";

--
-- Name: TABLE "committee_members"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."committee_members" IS 'Constitutional Committee membership and terms.';


--
-- Name: community_intelligence_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."community_intelligence_snapshots" (
    "id" integer NOT NULL,
    "snapshot_type" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_intelligence_snapshots" OWNER TO "postgres";

--
-- Name: community_intelligence_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."community_intelligence_snapshots_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."community_intelligence_snapshots_id_seq" OWNER TO "postgres";

--
-- Name: community_intelligence_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."community_intelligence_snapshots_id_seq" OWNED BY "public"."community_intelligence_snapshots"."id";


--
-- Name: decentralization_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."decentralization_snapshots" (
    "epoch_no" integer NOT NULL,
    "composite_score" integer NOT NULL,
    "nakamoto_coefficient" integer NOT NULL,
    "gini" real NOT NULL,
    "shannon_entropy" real NOT NULL,
    "hhi" integer NOT NULL,
    "theil_index" real NOT NULL,
    "concentration_ratio" real NOT NULL,
    "tau_decentralization" integer NOT NULL,
    "total_delegated_ada" bigint,
    "active_drep_count" integer,
    "snapshot_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."decentralization_snapshots" OWNER TO "postgres";

--
-- Name: decision_journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."decision_journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "position" "text" DEFAULT 'undecided'::"text" NOT NULL,
    "confidence" smallint DEFAULT 50 NOT NULL,
    "steelman_text" "text" DEFAULT ''::"text" NOT NULL,
    "key_assumptions" "text" DEFAULT ''::"text" NOT NULL,
    "what_would_change_mind" "text" DEFAULT ''::"text" NOT NULL,
    "position_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "decision_journal_entries_confidence_check" CHECK ((("confidence" >= 0) AND ("confidence" <= 100))),
    CONSTRAINT "decision_journal_entries_position_check" CHECK (("position" = ANY (ARRAY['undecided'::"text", 'lean_yes'::"text", 'lean_no'::"text", 'lean_abstain'::"text", 'yes'::"text", 'no'::"text", 'abstain'::"text"])))
);


ALTER TABLE "public"."decision_journal_entries" OWNER TO "postgres";

--
-- Name: delegation_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."delegation_snapshots" (
    "epoch" integer NOT NULL,
    "drep_id" "text" NOT NULL,
    "delegator_count" integer NOT NULL,
    "total_power_lovelace" bigint NOT NULL,
    "top_10_delegator_pct" real,
    "new_delegators" integer,
    "lost_delegators" integer,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "delegation_snapshots_delegator_count_check" CHECK (("delegator_count" >= 0)),
    CONSTRAINT "delegation_snapshots_lost_delegators_check" CHECK (("lost_delegators" >= 0)),
    CONSTRAINT "delegation_snapshots_new_delegators_check" CHECK (("new_delegators" >= 0)),
    CONSTRAINT "delegation_snapshots_top_10_delegator_pct_check" CHECK ((("top_10_delegator_pct" >= (0)::double precision) AND ("top_10_delegator_pct" <= (100)::double precision))),
    CONSTRAINT "delegation_snapshots_total_power_lovelace_check" CHECK (("total_power_lovelace" >= 0))
);


ALTER TABLE "public"."delegation_snapshots" OWNER TO "postgres";

--
-- Name: draft_review_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."draft_review_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "response_type" "text" NOT NULL,
    "response_text" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "draft_review_responses_response_type_check" CHECK (("response_type" = ANY (ARRAY['accept'::"text", 'decline'::"text", 'modify'::"text"])))
);


ALTER TABLE "public"."draft_review_responses" OWNER TO "postgres";

--
-- Name: draft_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."draft_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "reviewer_stake_address" "text" NOT NULL,
    "reviewer_user_id" "uuid",
    "impact_score" smallint,
    "feasibility_score" smallint,
    "constitutional_score" smallint,
    "value_score" smallint,
    "feedback_text" "text" DEFAULT ''::"text" NOT NULL,
    "feedback_themes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at_version" integer,
    CONSTRAINT "draft_reviews_constitutional_score_check" CHECK ((("constitutional_score" >= 1) AND ("constitutional_score" <= 5))),
    CONSTRAINT "draft_reviews_feasibility_score_check" CHECK ((("feasibility_score" >= 1) AND ("feasibility_score" <= 5))),
    CONSTRAINT "draft_reviews_impact_score_check" CHECK ((("impact_score" >= 1) AND ("impact_score" <= 5))),
    CONSTRAINT "draft_reviews_value_score_check" CHECK ((("value_score" >= 1) AND ("value_score" <= 5)))
);


ALTER TABLE "public"."draft_reviews" OWNER TO "postgres";

--
-- Name: COLUMN "draft_reviews"."reviewed_at_version"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."draft_reviews"."reviewed_at_version" IS 'The draft version number at the time this review was submitted. Used for stale review detection.';


--
-- Name: drep_characters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_characters" (
    "drep_id" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "character_title" "text" NOT NULL,
    "character_summary" "text" NOT NULL,
    "attribute_pills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "input_hash" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drep_characters" OWNER TO "postgres";

--
-- Name: drep_delegator_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_delegator_snapshots" (
    "id" bigint NOT NULL,
    "drep_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "stake_address" "text" NOT NULL,
    "amount_lovelace" bigint DEFAULT 0 NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drep_delegator_snapshots" OWNER TO "postgres";

--
-- Name: TABLE "drep_delegator_snapshots"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."drep_delegator_snapshots" IS 'Per-epoch snapshot of individual delegators per DRep. Enables delegation concentration, migration tracking, and network graph analysis.';


--
-- Name: drep_delegator_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_delegator_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."drep_delegator_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: drep_epoch_updates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_epoch_updates" (
    "drep_id" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "update_text" "text" NOT NULL,
    "vote_count" integer DEFAULT 0 NOT NULL,
    "rationale_count" integer DEFAULT 0 NOT NULL,
    "proposals_voted" "jsonb" DEFAULT '[]'::"jsonb",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drep_epoch_updates" OWNER TO "postgres";

--
-- Name: TABLE "drep_epoch_updates"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."drep_epoch_updates" IS 'AI-generated per-DRep epoch voting summaries for delegator communication';


--
-- Name: drep_lifecycle_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_lifecycle_events" (
    "id" bigint NOT NULL,
    "drep_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "tx_hash" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "block_time" integer,
    "deposit" "text",
    "anchor_url" "text",
    "anchor_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "drep_lifecycle_events_action_check" CHECK (("action" = ANY (ARRAY['registration'::"text", 'update'::"text", 'deregistration'::"text"])))
);


ALTER TABLE "public"."drep_lifecycle_events" OWNER TO "postgres";

--
-- Name: TABLE "drep_lifecycle_events"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."drep_lifecycle_events" IS 'Full DRep lifecycle: registrations, metadata updates, retirements.';


--
-- Name: drep_lifecycle_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_lifecycle_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."drep_lifecycle_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: drep_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_milestones" (
    "drep_id" "text" NOT NULL,
    "milestone_key" "text" NOT NULL,
    "achieved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drep_milestones" OWNER TO "postgres";

--
-- Name: drep_pca_coordinates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_pca_coordinates" (
    "drep_id" "text" NOT NULL,
    "run_id" "uuid" NOT NULL,
    "coordinates" real[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drep_pca_coordinates" OWNER TO "postgres";

--
-- Name: drep_power_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_power_snapshots" (
    "drep_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "amount_lovelace" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "delegator_count" integer,
    CONSTRAINT "ck_dps_power" CHECK (("amount_lovelace" >= 0))
);


ALTER TABLE "public"."drep_power_snapshots" OWNER TO "postgres";

--
-- Name: drep_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drep_id" "text" NOT NULL,
    "asker_wallet" "text" NOT NULL,
    "question_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'open'::"text",
    "proposal_tx_hash" "text",
    "proposal_index" integer,
    "user_id" "uuid",
    CONSTRAINT "drep_questions_question_text_check" CHECK (("char_length"("question_text") <= 500)),
    CONSTRAINT "drep_questions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'answered'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."drep_questions" OWNER TO "postgres";

--
-- Name: drep_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid",
    "drep_id" "text" NOT NULL,
    "response_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "drep_responses_response_text_check" CHECK (("char_length"("response_text") <= 2000))
);


ALTER TABLE "public"."drep_responses" OWNER TO "postgres";

--
-- Name: drep_score_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_score_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drep_id" "text" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "effective_participation" integer DEFAULT 0 NOT NULL,
    "rationale_rate" integer DEFAULT 0 NOT NULL,
    "reliability_score" integer DEFAULT 0 NOT NULL,
    "profile_completeness" integer DEFAULT 0 NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "engagement_quality" integer,
    "effective_participation_v3" integer,
    "reliability_v3" integer,
    "governance_identity" integer,
    "epoch_no" integer,
    "score_momentum" numeric(6,3),
    "engagement_quality_raw" integer,
    "effective_participation_v3_raw" integer,
    "reliability_v3_raw" integer,
    "governance_identity_raw" integer,
    "score_version" "text" DEFAULT '3.1'::"text"
);


ALTER TABLE "public"."drep_score_history" OWNER TO "postgres";

--
-- Name: drep_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."drep_votes" (
    "vote_tx_hash" "text" NOT NULL,
    "drep_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "vote" "text" NOT NULL,
    "epoch_no" integer,
    "block_time" integer NOT NULL,
    "meta_url" "text",
    "meta_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "voting_power_lovelace" bigint,
    "power_source" "text",
    "rationale_quality" real,
    "embedding_proposal_relevance" double precision,
    "embedding_originality" double precision,
    "rationale_specificity" smallint,
    "rationale_reasoning_depth" smallint,
    "rationale_proposal_awareness" smallint,
    "rationale_ai_summary" "text",
    "has_rationale" boolean DEFAULT false NOT NULL,
    CONSTRAINT "drep_votes_power_source_check" CHECK (("power_source" = ANY (ARRAY['exact'::"text", 'nearest'::"text"]))),
    CONSTRAINT "drep_votes_vote_check" CHECK (("vote" = ANY (ARRAY['Yes'::"text", 'No'::"text", 'Abstain'::"text"])))
);


ALTER TABLE "public"."drep_votes" OWNER TO "postgres";

--
-- Name: COLUMN "drep_votes"."rationale_specificity"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."drep_votes"."rationale_specificity" IS 'AI sub-score: specificity (0-100)';


--
-- Name: COLUMN "drep_votes"."rationale_reasoning_depth"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."drep_votes"."rationale_reasoning_depth" IS 'AI sub-score: reasoning depth (0-100)';


--
-- Name: COLUMN "drep_votes"."rationale_proposal_awareness"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."drep_votes"."rationale_proposal_awareness" IS 'AI sub-score: proposal awareness (0-100)';


--
-- Name: dreps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."dreps" (
    "id" "text" NOT NULL,
    "metadata" "jsonb",
    "info" "jsonb",
    "votes" "jsonb"[],
    "score" numeric,
    "participation_rate" numeric,
    "rationale_rate" numeric,
    "size_tier" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reliability_score" integer DEFAULT 0,
    "deliberation_modifier" double precision DEFAULT 1.0,
    "effective_participation" integer DEFAULT 0,
    "alignment_treasury_conservative" integer,
    "alignment_treasury_growth" integer,
    "alignment_decentralization" integer,
    "alignment_security" integer,
    "alignment_innovation" integer,
    "alignment_transparency" integer,
    "last_vote_time" integer,
    "profile_completeness" integer DEFAULT 0,
    "reliability_streak" integer DEFAULT 0,
    "reliability_recency" integer DEFAULT 0,
    "reliability_longest_gap" integer DEFAULT 0,
    "reliability_tenure" integer DEFAULT 0,
    "metadata_hash_verified" boolean,
    "anchor_url" "text",
    "anchor_hash" "text",
    "alignment_treasury_conservative_raw" real,
    "alignment_treasury_growth_raw" real,
    "alignment_decentralization_raw" real,
    "alignment_security_raw" real,
    "alignment_innovation_raw" real,
    "alignment_transparency_raw" real,
    "engagement_quality" integer,
    "engagement_quality_raw" integer,
    "effective_participation_v3" integer,
    "effective_participation_v3_raw" integer,
    "reliability_v3" integer,
    "reliability_v3_raw" integer,
    "governance_identity" integer,
    "governance_identity_raw" integer,
    "score_momentum" real,
    "current_tier" "text",
    "last_personality_label" "text",
    "confidence" integer,
    "embedding_philosophy_coherence" double precision,
    "spotlight_narrative" "text",
    "spotlight_narrative_generated_at" timestamp with time zone,
    "score_version" "text" DEFAULT '3.1'::"text",
    "profile_metadata_hash" "text",
    "profile_last_changed_at" timestamp with time zone
);


ALTER TABLE "public"."dreps" OWNER TO "postgres";

--
-- Name: COLUMN "dreps"."profile_metadata_hash"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."dreps"."profile_metadata_hash" IS 'CIP-119 metadata hash â€” changes only when profile content changes';


--
-- Name: COLUMN "dreps"."profile_last_changed_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."dreps"."profile_last_changed_at" IS 'Timestamp when profile_metadata_hash last changed â€” used for staleness decay';


--
-- Name: embeddings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."embeddings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "embedding" "extensions"."vector"(1536) NOT NULL,
    "content_hash" "text" NOT NULL,
    "model_used" "text" DEFAULT 'text-embedding-3-large'::"text" NOT NULL,
    "input_token_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."embeddings" OWNER TO "postgres";

--
-- Name: encrypted_api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."encrypted_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'anthropic'::"text" NOT NULL,
    "encrypted_key" "text" NOT NULL,
    "key_prefix" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."encrypted_api_keys" OWNER TO "postgres";

--
-- Name: engagement_signal_aggregations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."engagement_signal_aggregations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "signal_type" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "epoch" integer,
    "computed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "engagement_signal_aggregations_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['proposal'::"text", 'drep'::"text", 'epoch'::"text", 'global'::"text"]))),
    CONSTRAINT "engagement_signal_aggregations_signal_type_check" CHECK (("signal_type" = ANY (ARRAY['sentiment'::"text", 'concern_flags'::"text", 'impact_tags'::"text", 'priority_signals'::"text", 'assembly'::"text", 'questions'::"text", 'combined'::"text"])))
);


ALTER TABLE "public"."engagement_signal_aggregations" OWNER TO "postgres";

--
-- Name: epoch_governance_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."epoch_governance_summaries" (
    "epoch_no" integer NOT NULL,
    "total_dreps" integer,
    "active_dreps" integer,
    "total_voting_power_lovelace" bigint,
    "total_proposals" integer,
    "total_votes" integer,
    "block_count" integer,
    "tx_count" integer,
    "fees_lovelace" bigint,
    "active_stake_lovelace" bigint,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."epoch_governance_summaries" OWNER TO "postgres";

--
-- Name: TABLE "epoch_governance_summaries"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."epoch_governance_summaries" IS 'Per-epoch aggregate governance stats.';


--
-- Name: epoch_recaps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."epoch_recaps" (
    "epoch" integer NOT NULL,
    "proposals_submitted" integer DEFAULT 0,
    "proposals_ratified" integer DEFAULT 0,
    "proposals_expired" integer DEFAULT 0,
    "proposals_dropped" integer DEFAULT 0,
    "drep_participation_pct" real,
    "treasury_withdrawn_ada" bigint DEFAULT 0,
    "ai_narrative" "text",
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."epoch_recaps" OWNER TO "postgres";

--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."feature_flags" (
    "key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "description" "text",
    "targeting" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'Uncategorized'::"text"
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";

--
-- Name: ghi_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."ghi_snapshots" (
    "epoch_no" integer NOT NULL,
    "score" numeric NOT NULL,
    "band" "text" NOT NULL,
    "components" "jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"(),
    "narrative" "text"
);


ALTER TABLE "public"."ghi_snapshots" OWNER TO "postgres";

--
-- Name: governance_benchmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chain" "text" NOT NULL,
    "period_label" "text" NOT NULL,
    "participation_rate" numeric,
    "delegate_count" integer,
    "proposal_count" integer,
    "proposal_throughput" numeric,
    "avg_rationale_rate" numeric,
    "governance_score" numeric,
    "grade" "text",
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "ai_insight" "text",
    CONSTRAINT "governance_benchmarks_chain_check" CHECK (("chain" = ANY (ARRAY['cardano'::"text", 'ethereum'::"text", 'polkadot'::"text"])))
);


ALTER TABLE "public"."governance_benchmarks" OWNER TO "postgres";

--
-- Name: governance_briefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_address" "text" NOT NULL,
    "brief_type" "text" NOT NULL,
    "content_json" "jsonb" NOT NULL,
    "rendered_html" "text",
    "epoch" integer,
    "delivered_channels" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "governance_briefs_brief_type_check" CHECK (("brief_type" = ANY (ARRAY['drep'::"text", 'holder'::"text"])))
);


ALTER TABLE "public"."governance_briefs" OWNER TO "postgres";

--
-- Name: governance_epoch_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_epoch_stats" (
    "epoch_no" integer NOT NULL,
    "total_dreps" integer,
    "active_dreps" integer,
    "total_delegated_ada_lovelace" "text",
    "total_proposals" integer,
    "proposals_submitted" integer DEFAULT 0,
    "proposals_ratified" integer DEFAULT 0,
    "proposals_expired" integer DEFAULT 0,
    "proposals_dropped" integer DEFAULT 0,
    "participation_rate" numeric(5,2),
    "rationale_rate" numeric(5,2),
    "avg_drep_score" numeric(5,2),
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_epoch_stats" OWNER TO "postgres";

--
-- Name: governance_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_events" (
    "id" bigint NOT NULL,
    "wallet_address" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "related_drep_id" "text",
    "related_proposal_tx_hash" "text",
    "related_proposal_index" integer,
    "epoch" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."governance_events" OWNER TO "postgres";

--
-- Name: governance_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."governance_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."governance_events_id_seq" OWNER TO "postgres";

--
-- Name: governance_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."governance_events_id_seq" OWNED BY "public"."governance_events"."id";


--
-- Name: governance_participation_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_participation_snapshots" (
    "epoch" integer NOT NULL,
    "active_drep_count" integer NOT NULL,
    "total_drep_count" integer NOT NULL,
    "participation_rate" real NOT NULL,
    "avg_vote_delay_epochs" real,
    "rationale_rate" real,
    "avg_rationale_length" integer,
    "total_voting_power_lovelace" bigint,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "governance_participation_snap_total_voting_power_lovelace_check" CHECK (("total_voting_power_lovelace" >= 0)),
    CONSTRAINT "governance_participation_snapshots_active_drep_count_check" CHECK (("active_drep_count" >= 0)),
    CONSTRAINT "governance_participation_snapshots_avg_rationale_length_check" CHECK (("avg_rationale_length" >= 0)),
    CONSTRAINT "governance_participation_snapshots_avg_vote_delay_epochs_check" CHECK (("avg_vote_delay_epochs" >= (0)::double precision)),
    CONSTRAINT "governance_participation_snapshots_participation_rate_check" CHECK ((("participation_rate" >= (0)::double precision) AND ("participation_rate" <= (100)::double precision))),
    CONSTRAINT "governance_participation_snapshots_rationale_rate_check" CHECK ((("rationale_rate" >= (0)::double precision) AND ("rationale_rate" <= (100)::double precision))),
    CONSTRAINT "governance_participation_snapshots_total_drep_count_check" CHECK (("total_drep_count" >= 0))
);


ALTER TABLE "public"."governance_participation_snapshots" OWNER TO "postgres";

--
-- Name: governance_passport; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_passport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stake_address" "text" NOT NULL,
    "match_results" "jsonb",
    "match_archetype" "text",
    "civic_level" "text" DEFAULT 'explorer'::"text",
    "ceremony_completed" boolean DEFAULT false,
    "ring_participation" real DEFAULT 0,
    "ring_deliberation" real DEFAULT 0,
    "ring_impact" real DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_passport" OWNER TO "postgres";

--
-- Name: governance_philosophy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_philosophy" (
    "drep_id" "text" NOT NULL,
    "philosophy_text" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "anchor_hash" "text"
);


ALTER TABLE "public"."governance_philosophy" OWNER TO "postgres";

--
-- Name: governance_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_reports" (
    "epoch" integer NOT NULL,
    "report_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "narrative" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."governance_reports" OWNER TO "postgres";

--
-- Name: governance_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_stats" (
    "id" integer DEFAULT 1 NOT NULL,
    "treasury_balance_lovelace" bigint,
    "treasury_balance_updated_at" timestamp with time zone,
    "current_epoch" integer,
    "epoch_end_time" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "circulating_supply_lovelace" bigint,
    CONSTRAINT "governance_stats_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."governance_stats" OWNER TO "postgres";

--
-- Name: governance_wrapped; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."governance_wrapped" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "period_type" "text" NOT NULL,
    "period_id" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "governance_wrapped_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['citizen'::"text", 'drep'::"text", 'spo'::"text"]))),
    CONSTRAINT "governance_wrapped_period_type_check" CHECK (("period_type" = ANY (ARRAY['epoch'::"text", 'annual'::"text"])))
);


ALTER TABLE "public"."governance_wrapped" OWNER TO "postgres";

--
-- Name: integrity_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."integrity_snapshots" (
    "id" integer NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "vote_power_coverage_pct" numeric(5,2),
    "canonical_summary_pct" numeric(5,2),
    "ai_proposal_pct" numeric(5,2),
    "ai_rationale_pct" numeric(5,2),
    "hash_mismatch_rate_pct" numeric(5,2),
    "total_dreps" integer,
    "total_votes" integer,
    "total_proposals" integer,
    "total_rationales" integer,
    "metrics_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ck_is_ai_proposal" CHECK ((("ai_proposal_pct" >= (0)::numeric) AND ("ai_proposal_pct" <= (100)::numeric))),
    CONSTRAINT "ck_is_ai_rationale" CHECK ((("ai_rationale_pct" >= (0)::numeric) AND ("ai_rationale_pct" <= (100)::numeric))),
    CONSTRAINT "ck_is_canonical" CHECK ((("canonical_summary_pct" >= (0)::numeric) AND ("canonical_summary_pct" <= (100)::numeric))),
    CONSTRAINT "ck_is_hash_mismatch" CHECK ((("hash_mismatch_rate_pct" >= (0)::numeric) AND ("hash_mismatch_rate_pct" <= (100)::numeric))),
    CONSTRAINT "ck_is_vote_power" CHECK ((("vote_power_coverage_pct" >= (0)::numeric) AND ("vote_power_coverage_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."integrity_snapshots" OWNER TO "postgres";

--
-- Name: integrity_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."integrity_snapshots_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."integrity_snapshots_id_seq" OWNER TO "postgres";

--
-- Name: integrity_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."integrity_snapshots_id_seq" OWNED BY "public"."integrity_snapshots"."id";


--
-- Name: inter_body_alignment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."inter_body_alignment" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "drep_yes_pct" real,
    "drep_no_pct" real,
    "spo_yes_pct" real,
    "spo_no_pct" real,
    "cc_yes_pct" real,
    "cc_no_pct" real,
    "alignment_score" real,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inter_body_alignment" OWNER TO "postgres";

--
-- Name: inter_body_alignment_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."inter_body_alignment_snapshots" (
    "epoch" integer NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "drep_yes_pct" real NOT NULL,
    "drep_no_pct" real NOT NULL,
    "drep_total" integer NOT NULL,
    "spo_yes_pct" real NOT NULL,
    "spo_no_pct" real NOT NULL,
    "spo_total" integer NOT NULL,
    "cc_yes_pct" real NOT NULL,
    "cc_no_pct" real NOT NULL,
    "cc_total" integer NOT NULL,
    "alignment_score" real NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inter_body_alignment_snapshots_alignment_score_check" CHECK ((("alignment_score" >= (0)::double precision) AND ("alignment_score" <= (100)::double precision))),
    CONSTRAINT "inter_body_alignment_snapshots_cc_no_pct_check" CHECK ((("cc_no_pct" >= (0)::double precision) AND ("cc_no_pct" <= (100)::double precision))),
    CONSTRAINT "inter_body_alignment_snapshots_cc_total_check" CHECK (("cc_total" >= 0)),
    CONSTRAINT "inter_body_alignment_snapshots_cc_yes_pct_check" CHECK ((("cc_yes_pct" >= (0)::double precision) AND ("cc_yes_pct" <= (100)::double precision))),
    CONSTRAINT "inter_body_alignment_snapshots_drep_no_pct_check" CHECK ((("drep_no_pct" >= (0)::double precision) AND ("drep_no_pct" <= (100)::double precision))),
    CONSTRAINT "inter_body_alignment_snapshots_drep_total_check" CHECK (("drep_total" >= 0)),
    CONSTRAINT "inter_body_alignment_snapshots_drep_yes_pct_check" CHECK ((("drep_yes_pct" >= (0)::double precision) AND ("drep_yes_pct" <= (100)::double precision))),
    CONSTRAINT "inter_body_alignment_snapshots_spo_no_pct_check" CHECK ((("spo_no_pct" >= (0)::double precision) AND ("spo_no_pct" <= (100)::double precision))),
    CONSTRAINT "inter_body_alignment_snapshots_spo_total_check" CHECK (("spo_total" >= 0)),
    CONSTRAINT "inter_body_alignment_snapshots_spo_yes_pct_check" CHECK ((("spo_yes_pct" >= (0)::double precision) AND ("spo_yes_pct" <= (100)::double precision)))
);


ALTER TABLE "public"."inter_body_alignment_snapshots" OWNER TO "postgres";

--
-- Name: matching_topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."matching_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "display_text" "text" NOT NULL,
    "alignment_hints" "jsonb",
    "source" "text" DEFAULT 'static'::"text" NOT NULL,
    "epoch_introduced" integer,
    "selection_count" integer DEFAULT 0,
    "enabled" boolean DEFAULT true,
    "trending" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."matching_topics" OWNER TO "postgres";

--
-- Name: metadata_archive; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."metadata_archive" (
    "id" bigint NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "meta_url" "text",
    "meta_hash" "text",
    "meta_json" "jsonb",
    "cip_standard" "text",
    "fetch_status" "text" DEFAULT 'success'::"text" NOT NULL,
    "content_hash" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "metadata_archive_cip_standard_check" CHECK (("cip_standard" = ANY (ARRAY['CIP-100'::"text", 'CIP-108'::"text", 'CIP-119'::"text", 'CIP-136'::"text", 'unknown'::"text"]))),
    CONSTRAINT "metadata_archive_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['drep'::"text", 'proposal'::"text", 'vote_rationale'::"text", 'cc_rationale'::"text"]))),
    CONSTRAINT "metadata_archive_fetch_status_check" CHECK (("fetch_status" = ANY (ARRAY['success'::"text", 'hash_mismatch'::"text", 'fetch_error'::"text", 'decode_error'::"text", 'timeout'::"text"])))
);


ALTER TABLE "public"."metadata_archive" OWNER TO "postgres";

--
-- Name: TABLE "metadata_archive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."metadata_archive" IS 'Persistent archive of off-chain governance metadata.';


--
-- Name: metadata_archive_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."metadata_archive" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."metadata_archive_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ncl_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."ncl_periods" (
    "id" integer NOT NULL,
    "ncl_ada" numeric NOT NULL,
    "start_epoch" integer NOT NULL,
    "end_epoch" integer NOT NULL,
    "info_action_tx_hash" "text",
    "info_action_index" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ncl_periods_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."ncl_periods" OWNER TO "postgres";

--
-- Name: TABLE "ncl_periods"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ncl_periods" IS 'Tracks Net Change Limit periods set by DRep Info Action votes. The NCL is the constitutional ceiling on treasury withdrawals per budget period.';


--
-- Name: ncl_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."ncl_periods_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ncl_periods_id_seq" OWNER TO "postgres";

--
-- Name: ncl_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."ncl_periods_id_seq" OWNED BY "public"."ncl_periods"."id";


--
-- Name: notification_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_wallet" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid"
);


ALTER TABLE "public"."notification_log" OWNER TO "postgres";

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_wallet" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_stake_address" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "read" boolean DEFAULT false NOT NULL,
    "action_url" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";

--
-- Name: observatory_narratives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."observatory_narratives" (
    "id" bigint NOT NULL,
    "epoch" integer NOT NULL,
    "unified" "text",
    "treasury" "text",
    "committee" "text",
    "health" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."observatory_narratives" OWNER TO "postgres";

--
-- Name: observatory_narratives_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."observatory_narratives" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."observatory_narratives_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pca_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."pca_results" (
    "run_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"(),
    "num_dreps" integer NOT NULL,
    "num_proposals" integer NOT NULL,
    "components" integer NOT NULL,
    "explained_variance" real[] NOT NULL,
    "total_explained_variance" real NOT NULL,
    "loadings" "jsonb" NOT NULL,
    "proposal_ids" "text"[] NOT NULL,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."pca_results" OWNER TO "postgres";

--
-- Name: perspective_clusters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."perspective_clusters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "clusters" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "minority_perspectives" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "bridging_points" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "rationale_count" integer DEFAULT 0 NOT NULL,
    "model_used" "text" DEFAULT ''::"text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."perspective_clusters" OWNER TO "postgres";

--
-- Name: poll_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."poll_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "wallet_address" "text" NOT NULL,
    "stake_address" "text",
    "delegated_drep_id" "text",
    "vote" "text" NOT NULL,
    "initial_vote" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vote_count" integer DEFAULT 1,
    "source" "text" DEFAULT 'poll'::"text",
    "user_id" "uuid",
    CONSTRAINT "poll_responses_initial_vote_check" CHECK (("initial_vote" = ANY (ARRAY['yes'::"text", 'no'::"text", 'abstain'::"text"]))),
    CONSTRAINT "poll_responses_source_check" CHECK (("source" = ANY (ARRAY['poll'::"text", 'quiz'::"text"]))),
    CONSTRAINT "poll_responses_vote_check" CHECK (("vote" = ANY (ARRAY['yes'::"text", 'no'::"text", 'abstain'::"text"])))
);


ALTER TABLE "public"."poll_responses" OWNER TO "postgres";

--
-- Name: pools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."pools" (
    "pool_id" "text" NOT NULL,
    "ticker" "text",
    "pool_name" "text",
    "pledge_lovelace" bigint DEFAULT 0,
    "margin" numeric(7,4) DEFAULT 0,
    "fixed_cost_lovelace" bigint DEFAULT 0,
    "delegator_count" integer DEFAULT 0,
    "live_stake_lovelace" bigint DEFAULT 0,
    "governance_score" integer,
    "participation_raw" integer,
    "consistency_raw" integer,
    "reliability_raw" integer,
    "participation_pct" integer,
    "consistency_pct" integer,
    "reliability_pct" integer,
    "vote_count" integer DEFAULT 0,
    "alignment_treasury_conservative" numeric(5,2),
    "alignment_treasury_growth" numeric(5,2),
    "alignment_decentralization" numeric(5,2),
    "alignment_security" numeric(5,2),
    "alignment_innovation" numeric(5,2),
    "alignment_transparency" numeric(5,2),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "governance_identity_raw" integer,
    "governance_identity_pct" integer,
    "score_momentum" numeric(6,2),
    "governance_statement" "text",
    "claimed_at" timestamp with time zone,
    "claimed_by" "text",
    "social_links" "jsonb" DEFAULT '[]'::"jsonb",
    "homepage_url" "text",
    "metadata_hash_verified" boolean DEFAULT false,
    "narrative" "text",
    "current_tier" "text",
    "deliberation_raw" integer,
    "deliberation_pct" integer,
    "confidence" integer,
    "relay_lat" double precision,
    "relay_lon" double precision,
    "relay_locations" "jsonb",
    "pool_status" "text" DEFAULT 'registered'::"text",
    "retiring_epoch" integer,
    "spotlight_narrative" "text",
    "spotlight_narrative_generated_at" timestamp with time zone,
    "score_version" "text" DEFAULT '3.1'::"text"
);


ALTER TABLE "public"."pools" OWNER TO "postgres";

--
-- Name: COLUMN "pools"."relay_lat"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."pools"."relay_lat" IS 'Primary relay latitude (geocoded from relay IP)';


--
-- Name: COLUMN "pools"."relay_lon"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."pools"."relay_lon" IS 'Primary relay longitude (geocoded from relay IP)';


--
-- Name: COLUMN "pools"."relay_locations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."pools"."relay_locations" IS 'All relay locations: [{lat, lon, ip, dns, country, city}]';


--
-- Name: position_statements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."position_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drep_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "statement_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entity_type" "text" DEFAULT 'drep'::"text" NOT NULL,
    "entity_id" "text",
    CONSTRAINT "position_statements_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['drep'::"text", 'spo'::"text"])))
);


ALTER TABLE "public"."position_statements" OWNER TO "postgres";

--
-- Name: preview_cohorts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."preview_cohorts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_cohorts" OWNER TO "postgres";

--
-- Name: preview_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."preview_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "page" "text" NOT NULL,
    "persona_preset_id" "text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_feedback" OWNER TO "postgres";

--
-- Name: preview_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."preview_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "cohort_id" "uuid" NOT NULL,
    "persona_preset_id" "text" NOT NULL,
    "segment_overrides" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "max_uses" integer DEFAULT 5 NOT NULL,
    "use_count" integer DEFAULT 0 NOT NULL,
    "created_by" "text" NOT NULL,
    "notes" "text",
    "revoked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_invites" OWNER TO "postgres";

--
-- Name: preview_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."preview_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invite_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cohort_id" "uuid" NOT NULL,
    "persona_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_active" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."preview_sessions" OWNER TO "postgres";

--
-- Name: profile_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."profile_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drep_id" "text" NOT NULL,
    "viewer_wallet" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_views" OWNER TO "postgres";

--
-- Name: proposal_annotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "anchor_start" integer NOT NULL,
    "anchor_end" integer NOT NULL,
    "anchor_field" "text" DEFAULT 'abstract'::"text" NOT NULL,
    "annotation_text" "text" NOT NULL,
    "annotation_type" "text" DEFAULT 'note'::"text" NOT NULL,
    "color" "text" DEFAULT 'yellow'::"text",
    "is_public" boolean DEFAULT false NOT NULL,
    "upvote_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "suggested_text" "jsonb",
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "proposal_annotations_annotation_type_check" CHECK (("annotation_type" = ANY (ARRAY['note'::"text", 'highlight'::"text", 'citation'::"text", 'concern'::"text"])))
);


ALTER TABLE "public"."proposal_annotations" OWNER TO "postgres";

--
-- Name: COLUMN "proposal_annotations"."suggested_text"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."proposal_annotations"."suggested_text" IS 'For suggestion annotations: { original: string, proposed: string, explanation: string }';


--
-- Name: COLUMN "proposal_annotations"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."proposal_annotations"."status" IS 'Annotation lifecycle: active (default), accepted (suggestion applied), rejected (suggestion dismissed)';


--
-- Name: proposal_brief_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_brief_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "helpful" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposal_brief_feedback" OWNER TO "postgres";

--
-- Name: proposal_briefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "conviction_score" smallint DEFAULT 0 NOT NULL,
    "polarization_score" smallint DEFAULT 0 NOT NULL,
    "rationale_hash" "text",
    "rationale_count" smallint DEFAULT 0 NOT NULL,
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "not_helpful_count" integer DEFAULT 0 NOT NULL,
    "model_used" "text",
    "generation_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposal_briefs" OWNER TO "postgres";

--
-- Name: proposal_classifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_classifications" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "dim_treasury_conservative" real DEFAULT 0,
    "dim_treasury_growth" real DEFAULT 0,
    "dim_decentralization" real DEFAULT 0,
    "dim_security" real DEFAULT 0,
    "dim_innovation" real DEFAULT 0,
    "dim_transparency" real DEFAULT 0,
    "ai_summary" "text",
    "classified_at" timestamp with time zone DEFAULT "now"(),
    "constitutional_analysis" "jsonb"
);


ALTER TABLE "public"."proposal_classifications" OWNER TO "postgres";

--
-- Name: COLUMN "proposal_classifications"."constitutional_analysis"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."proposal_classifications"."constitutional_analysis" IS 'AI-generated constitutional alignment analysis (alignment, confidence, summary, relevant articles)';


--
-- Name: proposal_draft_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_draft_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "version_name" "text" DEFAULT ''::"text" NOT NULL,
    "edit_summary" "text" DEFAULT ''::"text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "constitutional_check" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_justifications" "jsonb"
);


ALTER TABLE "public"."proposal_draft_versions" OWNER TO "postgres";

--
-- Name: proposal_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_stake_address" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "abstract" "text" DEFAULT ''::"text" NOT NULL,
    "motivation" "text" DEFAULT ''::"text" NOT NULL,
    "rationale" "text" DEFAULT ''::"text" NOT NULL,
    "proposal_type" "text" DEFAULT 'InfoAction'::"text" NOT NULL,
    "type_specific" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "current_version" integer DEFAULT 1 NOT NULL,
    "last_constitutional_check" "jsonb",
    "last_constitutional_check_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stage_entered_at" timestamp with time zone DEFAULT "now"(),
    "community_review_started_at" timestamp with time zone,
    "fcp_started_at" timestamp with time zone,
    "submitted_tx_hash" "text",
    "submitted_anchor_url" "text",
    "submitted_anchor_hash" "text",
    "submitted_at" timestamp with time zone,
    "ai_influence_score" double precision,
    "ai_originality_score" double precision,
    "preview_cohort_id" "uuid",
    "supersedes_id" "uuid",
    CONSTRAINT "proposal_drafts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'community_review'::"text", 'final_comment'::"text", 'submitted'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."proposal_drafts" OWNER TO "postgres";

--
-- Name: COLUMN "proposal_drafts"."supersedes_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."proposal_drafts"."supersedes_id" IS 'References the draft this proposal is a revision/fork of. Used for lineage tracking.';


--
-- Name: proposal_engagement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_engagement_events" (
    "id" bigint NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "event_type" "text" NOT NULL,
    "section" "text",
    "duration_seconds" integer,
    "user_segment" "text",
    "user_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_engagement_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['view'::"text", 'time_spent'::"text", 'section_read'::"text", 'share'::"text", 'annotation'::"text", 'vote'::"text"])))
);


ALTER TABLE "public"."proposal_engagement_events" OWNER TO "postgres";

--
-- Name: proposal_engagement_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_engagement_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."proposal_engagement_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: proposal_feedback_themes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_feedback_themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "theme_summary" "text" NOT NULL,
    "theme_category" "text" NOT NULL,
    "endorsement_count" integer DEFAULT 0 NOT NULL,
    "key_voices" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "novel_contributions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "addressed_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "addressed_reason" "text",
    "linked_annotation_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_feedback_themes_addressed_status_check" CHECK (("addressed_status" = ANY (ARRAY['open'::"text", 'addressed'::"text", 'deferred'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "proposal_feedback_themes_theme_category_check" CHECK (("theme_category" = ANY (ARRAY['concern'::"text", 'support'::"text", 'question'::"text", 'suggestion'::"text"])))
);


ALTER TABLE "public"."proposal_feedback_themes" OWNER TO "postgres";

--
-- Name: proposal_intelligence_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_intelligence_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "section_type" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "content_hash" "text",
    "model_used" "text",
    "generation_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proposal_intelligence_cache" OWNER TO "postgres";

--
-- Name: proposal_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "note_text" "text" DEFAULT ''::"text" NOT NULL,
    "highlights" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposal_notes" OWNER TO "postgres";

--
-- Name: proposal_outcomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_outcomes" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "delivery_status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "delivery_score" smallint,
    "total_poll_responses" integer DEFAULT 0 NOT NULL,
    "delivered_count" integer DEFAULT 0 NOT NULL,
    "partial_count" integer DEFAULT 0 NOT NULL,
    "not_delivered_count" integer DEFAULT 0 NOT NULL,
    "too_early_count" integer DEFAULT 0 NOT NULL,
    "would_approve_again_pct" numeric(5,2),
    "milestones_total" smallint,
    "milestones_completed" smallint,
    "enacted_epoch" integer,
    "last_evaluated_epoch" integer,
    "epochs_since_enactment" integer GENERATED ALWAYS AS (
CASE
    WHEN (("enacted_epoch" IS NOT NULL) AND ("last_evaluated_epoch" IS NOT NULL)) THEN ("last_evaluated_epoch" - "enacted_epoch")
    ELSE NULL::integer
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_outcomes_delivery_score_check" CHECK ((("delivery_score" IS NULL) OR (("delivery_score" >= 0) AND ("delivery_score" <= 100)))),
    CONSTRAINT "proposal_outcomes_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['in_progress'::"text", 'delivered'::"text", 'partial'::"text", 'not_delivered'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."proposal_outcomes" OWNER TO "postgres";

--
-- Name: proposal_proposers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_proposers" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "proposer_id" "text" NOT NULL
);


ALTER TABLE "public"."proposal_proposers" OWNER TO "postgres";

--
-- Name: proposal_revision_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_revision_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_tx_hash" "text",
    "proposal_index" integer,
    "draft_id" "text",
    "version_number" integer NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "recipient_type" "text" NOT NULL,
    "sections_changed" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "themes_addressed" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_revision_notifications_recipient_type_check" CHECK (("recipient_type" = ANY (ARRAY['commenter'::"text", 'voter'::"text", 'endorser'::"text"])))
);


ALTER TABLE "public"."proposal_revision_notifications" OWNER TO "postgres";

--
-- Name: proposal_similarity_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_similarity_cache" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "similar_tx_hash" "text" NOT NULL,
    "similar_index" integer NOT NULL,
    "similarity_score" real NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proposal_similarity_cache" OWNER TO "postgres";

--
-- Name: proposal_team_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_team_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "team_member_id" "uuid" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proposal_team_approvals" OWNER TO "postgres";

--
-- Name: TABLE "proposal_team_approvals"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."proposal_team_approvals" IS 'Records team member approvals for proposal submission. The lead can always submit; editors must approve.';


--
-- Name: proposal_team_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_team_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "invite_code" "text" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "max_uses" integer DEFAULT 1 NOT NULL,
    "use_count" integer DEFAULT 0 NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_team_invites_role_check" CHECK (("role" = ANY (ARRAY['editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."proposal_team_invites" OWNER TO "postgres";

--
-- Name: proposal_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "stake_address" "text" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "joined_at" timestamp with time zone,
    CONSTRAINT "proposal_team_members_role_check" CHECK (("role" = ANY (ARRAY['lead'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."proposal_team_members" OWNER TO "postgres";

--
-- Name: proposal_teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposal_teams" OWNER TO "postgres";

--
-- Name: proposal_theme_endorsements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_theme_endorsements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "theme_id" "uuid" NOT NULL,
    "reviewer_user_id" "uuid" NOT NULL,
    "additional_context" "text",
    "is_novel" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposal_theme_endorsements" OWNER TO "postgres";

--
-- Name: proposal_vote_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_vote_snapshots" (
    "epoch" integer NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "drep_yes_count" integer NOT NULL,
    "drep_no_count" integer NOT NULL,
    "drep_abstain_count" integer NOT NULL,
    "drep_yes_power" bigint DEFAULT 0 NOT NULL,
    "drep_no_power" bigint DEFAULT 0 NOT NULL,
    "spo_yes_count" integer NOT NULL,
    "spo_no_count" integer NOT NULL,
    "spo_abstain_count" integer NOT NULL,
    "cc_yes_count" integer NOT NULL,
    "cc_no_count" integer NOT NULL,
    "cc_abstain_count" integer NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_vote_snapshots_cc_abstain_count_check" CHECK (("cc_abstain_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_cc_no_count_check" CHECK (("cc_no_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_cc_yes_count_check" CHECK (("cc_yes_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_drep_abstain_count_check" CHECK (("drep_abstain_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_drep_no_count_check" CHECK (("drep_no_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_drep_no_power_check" CHECK (("drep_no_power" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_drep_yes_count_check" CHECK (("drep_yes_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_drep_yes_power_check" CHECK (("drep_yes_power" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_spo_abstain_count_check" CHECK (("spo_abstain_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_spo_no_count_check" CHECK (("spo_no_count" >= 0)),
    CONSTRAINT "proposal_vote_snapshots_spo_yes_count_check" CHECK (("spo_yes_count" >= 0))
);


ALTER TABLE "public"."proposal_vote_snapshots" OWNER TO "postgres";

--
-- Name: proposal_voting_summary; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposal_voting_summary" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "epoch_no" integer NOT NULL,
    "drep_yes_votes_cast" integer,
    "drep_yes_vote_power" bigint,
    "drep_no_votes_cast" integer,
    "drep_no_vote_power" bigint,
    "drep_abstain_votes_cast" integer,
    "drep_abstain_vote_power" bigint,
    "drep_always_abstain_power" bigint,
    "drep_always_no_confidence_power" bigint,
    "pool_yes_votes_cast" integer,
    "pool_yes_vote_power" bigint,
    "pool_no_votes_cast" integer,
    "pool_no_vote_power" bigint,
    "pool_abstain_votes_cast" integer,
    "pool_abstain_vote_power" bigint,
    "committee_yes_votes_cast" integer,
    "committee_no_votes_cast" integer,
    "committee_abstain_votes_cast" integer,
    "fetched_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proposal_voting_summary" OWNER TO "postgres";

--
-- Name: proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposals" (
    "tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "proposal_type" "text" NOT NULL,
    "title" "text",
    "abstract" "text",
    "withdrawal_amount" bigint,
    "treasury_tier" "text",
    "param_changes" "jsonb",
    "relevant_prefs" "text"[],
    "proposed_epoch" integer,
    "block_time" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ai_summary" "text",
    "expired_epoch" integer,
    "ratified_epoch" integer,
    "enacted_epoch" integer,
    "dropped_epoch" integer,
    "expiration_epoch" integer,
    "proposal_id" "text",
    "meta_json" "jsonb",
    "assessment_sealed_until" timestamp with time zone,
    "ai_proposal_quality" integer,
    "ai_proposal_quality_details" "jsonb"
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";

--
-- Name: proposer_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposer_aliases" (
    "id" bigint NOT NULL,
    "alias_name" "text" NOT NULL,
    "alias_key" "text" DEFAULT ''::"text" NOT NULL,
    "proposer_id" "text" NOT NULL
);


ALTER TABLE "public"."proposer_aliases" OWNER TO "postgres";

--
-- Name: proposer_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposer_aliases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."proposer_aliases_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: proposers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."proposers" (
    "id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "type" "text" DEFAULT 'individual'::"text" NOT NULL,
    "first_proposal_epoch" integer,
    "proposal_count" integer DEFAULT 0 NOT NULL,
    "enacted_count" integer DEFAULT 0 NOT NULL,
    "dropped_count" integer DEFAULT 0 NOT NULL,
    "composite_score" real,
    "track_record_score" real,
    "proposal_quality_score" real,
    "fiscal_responsibility_score" real,
    "governance_citizenship_score" real,
    "confidence" integer DEFAULT 0 NOT NULL,
    "tier" "text" DEFAULT 'Emerging'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposers_type_check" CHECK (("type" = ANY (ARRAY['individual'::"text", 'organization'::"text", 'institutional'::"text"])))
);


ALTER TABLE "public"."proposers" OWNER TO "postgres";

--
-- Name: rationale_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."rationale_documents" (
    "content_hash" "text" NOT NULL,
    "drep_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "document" "jsonb" NOT NULL,
    "rationale_text" "text" NOT NULL,
    "vote_tx_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rationale_documents" OWNER TO "postgres";

--
-- Name: reconciliation_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."reconciliation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'blockfrost'::"text" NOT NULL,
    "tier_scope" "text" DEFAULT 'tier1+tier2'::"text" NOT NULL,
    "results" "jsonb" NOT NULL,
    "overall_status" "text" NOT NULL,
    "mismatches" "jsonb",
    "duration_ms" integer,
    "metadata" "jsonb",
    CONSTRAINT "reconciliation_log_overall_status_check" CHECK (("overall_status" = ANY (ARRAY['match'::"text", 'drift'::"text", 'mismatch'::"text"])))
);


ALTER TABLE "public"."reconciliation_log" OWNER TO "postgres";

--
-- Name: research_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."research_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."research_conversations" OWNER TO "postgres";

--
-- Name: review_framework_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."review_framework_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "checklist" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_framework_templates" OWNER TO "postgres";

--
-- Name: review_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."review_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voter_id" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proposals_reviewed" integer DEFAULT 0,
    "total_time_seconds" integer DEFAULT 0,
    "avg_seconds_per_proposal" real,
    "session_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_sessions" OWNER TO "postgres";

--
-- Name: reviewer_briefing_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."reviewer_briefing_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voter_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "content" "jsonb" NOT NULL,
    "voter_context_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reviewer_briefing_cache" OWNER TO "postgres";

--
-- Name: revoked_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."revoked_sessions" (
    "jti" "text" NOT NULL,
    "wallet_address" "text" NOT NULL,
    "revoked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."revoked_sessions" OWNER TO "postgres";

--
-- Name: scoring_methodology_changelog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."scoring_methodology_changelog" (
    "id" integer NOT NULL,
    "entity_type" "text" NOT NULL,
    "version" "text" NOT NULL,
    "released_at" timestamp with time zone,
    "summary" "text" NOT NULL,
    "changes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pillar_weights" "jsonb",
    "migration_notes" "text",
    CONSTRAINT "scoring_methodology_changelog_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['drep'::"text", 'spo'::"text", 'cc'::"text"])))
);


ALTER TABLE "public"."scoring_methodology_changelog" OWNER TO "postgres";

--
-- Name: scoring_methodology_changelog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."scoring_methodology_changelog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."scoring_methodology_changelog_id_seq" OWNER TO "postgres";

--
-- Name: scoring_methodology_changelog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."scoring_methodology_changelog_id_seq" OWNED BY "public"."scoring_methodology_changelog"."id";


--
-- Name: semantic_similarity_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."semantic_similarity_cache" (
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "similar_entity_type" "text" NOT NULL,
    "similar_entity_id" "text" NOT NULL,
    "similarity_score" real NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."semantic_similarity_cache" OWNER TO "postgres";

--
-- Name: seneca_conversation_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."seneca_conversation_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "summary" "text" NOT NULL,
    "message_count" smallint DEFAULT 0 NOT NULL,
    "epoch" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."seneca_conversation_summaries" OWNER TO "postgres";

--
-- Name: snapshot_completeness_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."snapshot_completeness_log" (
    "id" integer NOT NULL,
    "snapshot_type" "text" NOT NULL,
    "epoch_no" integer DEFAULT 0 NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "record_count" integer NOT NULL,
    "expected_count" integer,
    "coverage_pct" numeric(5,2),
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."snapshot_completeness_log" OWNER TO "postgres";

--
-- Name: snapshot_completeness_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."snapshot_completeness_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."snapshot_completeness_log_id_seq" OWNER TO "postgres";

--
-- Name: snapshot_completeness_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."snapshot_completeness_log_id_seq" OWNED BY "public"."snapshot_completeness_log"."id";


--
-- Name: social_link_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."social_link_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drep_id" "text" NOT NULL,
    "uri" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "http_status" integer,
    "last_checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."social_link_checks" OWNER TO "postgres";

--
-- Name: spo_alignment_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."spo_alignment_snapshots" (
    "pool_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "alignment_treasury_conservative" numeric(5,2),
    "alignment_treasury_growth" numeric(5,2),
    "alignment_decentralization" numeric(5,2),
    "alignment_security" numeric(5,2),
    "alignment_innovation" numeric(5,2),
    "alignment_transparency" numeric(5,2),
    "snapshot_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spo_alignment_snapshots" OWNER TO "postgres";

--
-- Name: spo_characters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."spo_characters" (
    "pool_id" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "character_title" "text" NOT NULL,
    "character_summary" "text" NOT NULL,
    "attribute_pills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "input_hash" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."spo_characters" OWNER TO "postgres";

--
-- Name: spo_power_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."spo_power_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pool_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "delegator_count" integer DEFAULT 0 NOT NULL,
    "live_stake_lovelace" bigint DEFAULT 0 NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."spo_power_snapshots" OWNER TO "postgres";

--
-- Name: spo_score_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."spo_score_snapshots" (
    "pool_id" "text" NOT NULL,
    "epoch_no" integer NOT NULL,
    "governance_score" integer,
    "participation_rate" numeric(5,2),
    "rationale_rate" numeric(5,2),
    "vote_count" integer DEFAULT 0,
    "snapshot_at" timestamp with time zone DEFAULT "now"(),
    "participation_pct" integer,
    "consistency_raw" integer,
    "consistency_pct" integer,
    "reliability_raw" integer,
    "reliability_pct" integer,
    "governance_identity_raw" integer,
    "governance_identity_pct" integer,
    "score_momentum" numeric(6,2),
    "deliberation_raw" integer,
    "deliberation_pct" integer,
    "confidence" integer,
    "score_version" "text" DEFAULT '3.1'::"text"
);


ALTER TABLE "public"."spo_score_snapshots" OWNER TO "postgres";

--
-- Name: spo_sybil_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."spo_sybil_flags" (
    "id" integer NOT NULL,
    "pool_a" "text" NOT NULL,
    "pool_b" "text" NOT NULL,
    "agreement_rate" numeric(5,3) NOT NULL,
    "shared_votes" integer NOT NULL,
    "epoch_no" integer NOT NULL,
    "detected_at" timestamp with time zone DEFAULT "now"(),
    "resolved" boolean DEFAULT false
);


ALTER TABLE "public"."spo_sybil_flags" OWNER TO "postgres";

--
-- Name: spo_sybil_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."spo_sybil_flags_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."spo_sybil_flags_id_seq" OWNER TO "postgres";

--
-- Name: spo_sybil_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."spo_sybil_flags_id_seq" OWNED BY "public"."spo_sybil_flags"."id";


--
-- Name: spo_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."spo_votes" (
    "pool_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "vote" "text" NOT NULL,
    "block_time" integer NOT NULL,
    "tx_hash" "text" NOT NULL,
    "epoch" integer NOT NULL,
    CONSTRAINT "spo_votes_vote_check" CHECK (("vote" = ANY (ARRAY['Yes'::"text", 'No'::"text", 'Abstain'::"text"])))
);


ALTER TABLE "public"."spo_votes" OWNER TO "postgres";

--
-- Name: state_of_governance_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."state_of_governance_reports" (
    "epoch_no" integer NOT NULL,
    "report_data" "jsonb" NOT NULL,
    "narrative_html" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "published" boolean DEFAULT false
);


ALTER TABLE "public"."state_of_governance_reports" OWNER TO "postgres";

--
-- Name: sync_cursors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."sync_cursors" (
    "sync_type" "text" NOT NULL,
    "cursor_block_time" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cursor_timestamp" timestamp with time zone
);


ALTER TABLE "public"."sync_cursors" OWNER TO "postgres";

--
-- Name: sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."sync_log" (
    "id" integer NOT NULL,
    "sync_type" "text" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "finished_at" timestamp with time zone,
    "duration_ms" integer,
    "success" boolean DEFAULT false NOT NULL,
    "error_message" "text",
    "metrics" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sync_log_sync_type_check" CHECK (("sync_type" = ANY (ARRAY['fast'::"text", 'full'::"text", 'integrity_check'::"text", 'proposals'::"text", 'dreps'::"text", 'votes'::"text", 'secondary'::"text", 'slow'::"text", 'treasury'::"text", 'api_health_check'::"text", 'scoring'::"text", 'alignment'::"text", 'ghi'::"text", 'benchmarks'::"text", 'spo_scores'::"text", 'spo_votes'::"text", 'cc_votes'::"text", 'data_moat'::"text", 'delegator_snapshots'::"text", 'drep_lifecycle'::"text", 'epoch_summaries'::"text", 'committee_sync'::"text", 'metadata_archive'::"text", 'governance_epoch_stats'::"text", 'catalyst'::"text", 'catalyst_proposals'::"text", 'catalyst_funds'::"text", 'reconciliation'::"text", 'intelligence_precompute'::"text", 'passage_predictions'::"text"])))
);


ALTER TABLE "public"."sync_log" OWNER TO "postgres";

--
-- Name: sync_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE "public"."sync_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sync_log_id_seq" OWNER TO "postgres";

--
-- Name: sync_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."sync_log_id_seq" OWNED BY "public"."sync_log"."id";


--
-- Name: tier_changes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."tier_changes" (
    "id" bigint NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "old_tier" "text" NOT NULL,
    "new_tier" "text" NOT NULL,
    "old_score" integer NOT NULL,
    "new_score" integer NOT NULL,
    "epoch_no" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tier_changes_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['drep'::"text", 'spo'::"text"])))
);


ALTER TABLE "public"."tier_changes" OWNER TO "postgres";

--
-- Name: tier_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."tier_changes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tier_changes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: treasury_accountability_polls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."treasury_accountability_polls" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "cycle_number" integer DEFAULT 1 NOT NULL,
    "opened_epoch" integer NOT NULL,
    "closes_epoch" integer NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "results_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "next_cycle_epoch" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "treasury_accountability_polls_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."treasury_accountability_polls" OWNER TO "postgres";

--
-- Name: treasury_accountability_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."treasury_accountability_responses" (
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "cycle_number" integer NOT NULL,
    "user_address" "text" NOT NULL,
    "delivered_rating" "text" NOT NULL,
    "would_approve_again" "text" NOT NULL,
    "evidence_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "treasury_accountability_responses_delivered_rating_check" CHECK (("delivered_rating" = ANY (ARRAY['delivered'::"text", 'partial'::"text", 'not_delivered'::"text", 'too_early'::"text"]))),
    CONSTRAINT "treasury_accountability_responses_would_approve_again_check" CHECK (("would_approve_again" = ANY (ARRAY['yes'::"text", 'no'::"text", 'unsure'::"text"])))
);


ALTER TABLE "public"."treasury_accountability_responses" OWNER TO "postgres";

--
-- Name: treasury_health_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."treasury_health_snapshots" (
    "epoch" integer NOT NULL,
    "health_score" integer NOT NULL,
    "balance_trend" integer NOT NULL,
    "withdrawal_velocity" integer NOT NULL,
    "income_stability" integer NOT NULL,
    "pending_load" integer NOT NULL,
    "runway_adequacy" integer NOT NULL,
    "runway_months" integer NOT NULL,
    "burn_rate_per_epoch" integer NOT NULL,
    "pending_count" integer NOT NULL,
    "pending_total_ada" bigint NOT NULL,
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "treasury_health_snapshots_balance_trend_check" CHECK ((("balance_trend" >= 0) AND ("balance_trend" <= 100))),
    CONSTRAINT "treasury_health_snapshots_burn_rate_per_epoch_check" CHECK (("burn_rate_per_epoch" >= 0)),
    CONSTRAINT "treasury_health_snapshots_health_score_check" CHECK ((("health_score" >= 0) AND ("health_score" <= 100))),
    CONSTRAINT "treasury_health_snapshots_income_stability_check" CHECK ((("income_stability" >= 0) AND ("income_stability" <= 100))),
    CONSTRAINT "treasury_health_snapshots_pending_count_check" CHECK (("pending_count" >= 0)),
    CONSTRAINT "treasury_health_snapshots_pending_load_check" CHECK ((("pending_load" >= 0) AND ("pending_load" <= 100))),
    CONSTRAINT "treasury_health_snapshots_pending_total_ada_check" CHECK (("pending_total_ada" >= 0)),
    CONSTRAINT "treasury_health_snapshots_runway_adequacy_check" CHECK ((("runway_adequacy" >= 0) AND ("runway_adequacy" <= 100))),
    CONSTRAINT "treasury_health_snapshots_runway_months_check" CHECK (("runway_months" >= 0)),
    CONSTRAINT "treasury_health_snapshots_withdrawal_velocity_check" CHECK ((("withdrawal_velocity" >= 0) AND ("withdrawal_velocity" <= 100)))
);


ALTER TABLE "public"."treasury_health_snapshots" OWNER TO "postgres";

--
-- Name: treasury_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."treasury_snapshots" (
    "epoch_no" integer NOT NULL,
    "balance_lovelace" bigint NOT NULL,
    "withdrawals_lovelace" bigint DEFAULT 0 NOT NULL,
    "reserves_lovelace" bigint,
    "fees_lovelace" bigint,
    "reserves_income_lovelace" bigint,
    "snapshot_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ck_ts_balance" CHECK (("balance_lovelace" >= 0)),
    CONSTRAINT "ck_ts_reserves" CHECK (("reserves_lovelace" >= 0))
);


ALTER TABLE "public"."treasury_snapshots" OWNER TO "postgres";

--
-- Name: user_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_wallet" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "channel_identifier" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."user_channels" OWNER TO "postgres";

--
-- Name: user_entity_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_entity_subscriptions" (
    "user_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_entity_subscriptions_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['drep'::"text", 'spo'::"text", 'proposal'::"text", 'cc_member'::"text"])))
);


ALTER TABLE "public"."user_entity_subscriptions" OWNER TO "postgres";

--
-- Name: user_governance_profile_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_governance_profile_history" (
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text",
    "snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pca_coordinates" real[],
    "alignment_scores" "jsonb",
    "personality_label" "text",
    "votes_used" integer,
    "confidence" real,
    "confidence_sources" "jsonb",
    CONSTRAINT "user_governance_profile_history_new_confidence_check" CHECK ((("confidence" >= (0)::double precision) AND ("confidence" <= (1)::double precision))),
    CONSTRAINT "user_governance_profile_history_new_votes_used_check" CHECK (("votes_used" >= 0))
);


ALTER TABLE "public"."user_governance_profile_history" OWNER TO "postgres";

--
-- Name: user_governance_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_governance_profiles" (
    "user_id" "uuid" NOT NULL,
    "wallet_address" "text",
    "pca_coordinates" real[],
    "alignment_scores" "jsonb",
    "personality_label" "text",
    "votes_used" integer DEFAULT 0 NOT NULL,
    "confidence" real DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "confidence_sources" "jsonb",
    "has_quick_match" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_governance_profiles" OWNER TO "postgres";

--
-- Name: COLUMN "user_governance_profiles"."confidence_sources"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."user_governance_profiles"."confidence_sources" IS 'Breakdown of progressive confidence sources: quizAnswers, pollVotes, proposalDiversity, engagement, delegation';


--
-- Name: COLUMN "user_governance_profiles"."has_quick_match"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."user_governance_profiles"."has_quick_match" IS 'Whether the user has completed the Quick Match quiz';


--
-- Name: user_hub_checkins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_hub_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_stake_address" "text" NOT NULL,
    "epoch" integer NOT NULL,
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_hub_checkins" OWNER TO "postgres";

--
-- Name: user_notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "email" "text",
    "digest_frequency" "text" DEFAULT 'none'::"text" NOT NULL,
    "alert_drep_voted" boolean DEFAULT true NOT NULL,
    "alert_coverage_changed" boolean DEFAULT true NOT NULL,
    "alert_score_shifted" boolean DEFAULT true NOT NULL,
    "alert_milestone_earned" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_notification_preferences_digest_frequency_check" CHECK (("digest_frequency" = ANY (ARRAY['epoch'::"text", 'weekly'::"text", 'major_only'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."user_notification_preferences" OWNER TO "postgres";

--
-- Name: user_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."user_wallets" (
    "stake_address" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payment_address" "text" NOT NULL,
    "label" "text",
    "segments" "text"[] DEFAULT '{}'::"text"[],
    "drep_id" "text",
    "pool_id" "text",
    "linked_at" timestamp with time zone DEFAULT "now"(),
    "last_used" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_wallets" OWNER TO "postgres";

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."users" (
    "wallet_address" "text" NOT NULL,
    "prefs" "jsonb" DEFAULT '{}'::"jsonb",
    "watchlist" "text"[] DEFAULT '{}'::"text"[],
    "delegation_history" "jsonb"[] DEFAULT '{}'::"jsonb"[],
    "push_subscriptions" "jsonb" DEFAULT '{}'::"jsonb",
    "last_active" timestamp with time zone DEFAULT "now"(),
    "display_name" "text",
    "claimed_drep_id" "text",
    "last_push_check" timestamp with time zone,
    "last_visit_at" timestamp with time zone,
    "onboarding_checklist" "jsonb" DEFAULT '{}'::"jsonb",
    "governance_level" "text" DEFAULT 'observer'::"text",
    "poll_count" integer DEFAULT 0,
    "visit_streak" integer DEFAULT 0,
    "last_epoch_visited" integer,
    "email" "text",
    "email_verified" boolean DEFAULT false,
    "digest_frequency" "text" DEFAULT 'weekly'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "governance_depth" "text" DEFAULT 'informed'::"text" NOT NULL,
    "notification_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "users_digest_frequency_check" CHECK (("digest_frequency" = ANY (ARRAY['weekly'::"text", 'biweekly'::"text", 'monthly'::"text", 'off'::"text", 'epoch'::"text", 'none'::"text"]))),
    CONSTRAINT "users_governance_depth_check" CHECK (("governance_depth" = ANY (ARRAY['hands_off'::"text", 'informed'::"text", 'engaged'::"text", 'deep'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";

--
-- Name: vote_rationales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."vote_rationales" (
    "vote_tx_hash" "text" NOT NULL,
    "drep_id" "text" NOT NULL,
    "proposal_tx_hash" "text",
    "proposal_index" integer,
    "meta_url" "text",
    "rationale_text" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "ai_summary" "text",
    "hash_verified" boolean,
    "hash_check_attempted_at" timestamp with time zone,
    "fetch_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "fetch_attempts" integer DEFAULT 0 NOT NULL,
    "fetch_last_attempted_at" timestamp with time zone,
    "fetch_last_error" "text",
    "next_fetch_at" timestamp with time zone,
    CONSTRAINT "vote_rationales_fetch_attempts_check" CHECK (("fetch_attempts" >= 0)),
    CONSTRAINT "vote_rationales_fetch_status_check" CHECK (("fetch_status" = ANY (ARRAY['pending'::"text", 'retry'::"text", 'fetched'::"text", 'inline'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."vote_rationales" OWNER TO "postgres";

--
-- Name: v_ai_summary_coverage; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_ai_summary_coverage" WITH ("security_invoker"='on') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."proposals") AS "total_proposals",
    ( SELECT "count"(*) AS "count"
           FROM "public"."proposals"
          WHERE ("proposals"."ai_summary" IS NOT NULL)) AS "proposals_with_summary",
    ( SELECT "count"(*) AS "count"
           FROM "public"."proposals"
          WHERE (("proposals"."abstract" IS NOT NULL) AND ("proposals"."abstract" <> ''::"text"))) AS "proposals_with_abstract",
    ( SELECT "count"(*) AS "count"
           FROM "public"."vote_rationales") AS "total_rationales",
    ( SELECT "count"(*) AS "count"
           FROM "public"."vote_rationales"
          WHERE (("vote_rationales"."rationale_text" IS NOT NULL) AND ("vote_rationales"."rationale_text" <> ''::"text"))) AS "rationales_with_text",
    ( SELECT "count"(*) AS "count"
           FROM "public"."vote_rationales"
          WHERE ("vote_rationales"."ai_summary" IS NOT NULL)) AS "rationales_with_summary";


ALTER VIEW "public"."v_ai_summary_coverage" OWNER TO "postgres";

--
-- Name: v_api_abuse_signals; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_api_abuse_signals" WITH ("security_invoker"='on') AS
 SELECT "ip_hash",
    ("count"(*))::integer AS "requests_last_hour",
    ("count"(DISTINCT "key_id"))::integer AS "unique_keys_used",
    ("count"(*) FILTER (WHERE ("status_code" = 429)))::integer AS "rate_limit_hits",
        CASE
            WHEN ("count"(*) > 0) THEN "round"(((("count"(*) FILTER (WHERE ("status_code" >= 400)))::numeric / ("count"(*))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "error_rate_pct"
   FROM "public"."api_usage_log"
  WHERE (("created_at" > ("now"() - '01:00:00'::interval)) AND ("ip_hash" IS NOT NULL))
  GROUP BY "ip_hash"
 HAVING ("count"(*) > 50)
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."v_api_abuse_signals" OWNER TO "postgres";

--
-- Name: v_api_daily_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_api_daily_stats" WITH ("security_invoker"='on') AS
 SELECT ("date_trunc"('day'::"text", "created_at"))::"date" AS "day",
    "tier",
    ("count"(DISTINCT "key_id"))::integer AS "unique_keys",
    ("count"(*))::integer AS "total_requests",
    ("count"(*) FILTER (WHERE ("status_code" = 429)))::integer AS "rate_limit_hits",
    ("count"(*) FILTER (WHERE ("status_code" >= 500)))::integer AS "errors_5xx",
    ("percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY (("response_ms")::double precision)))::integer AS "p95_ms"
   FROM "public"."api_usage_log"
  WHERE ("created_at" > ("now"() - '90 days'::interval))
  GROUP BY (("date_trunc"('day'::"text", "created_at"))::"date"), "tier";


ALTER VIEW "public"."v_api_daily_stats" OWNER TO "postgres";

--
-- Name: v_api_hourly_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_api_hourly_stats" WITH ("security_invoker"='on') AS
 SELECT "date_trunc"('hour'::"text", "created_at") AS "hour",
    "endpoint",
    "tier",
    ("count"(*))::integer AS "requests",
    ("count"(*) FILTER (WHERE ("status_code" >= 500)))::integer AS "errors_5xx",
    ("count"(*) FILTER (WHERE ("status_code" = 429)))::integer AS "rate_limited",
        CASE
            WHEN ("count"(*) > 0) THEN "round"(((("count"(*) FILTER (WHERE ("status_code" >= 500)))::numeric / ("count"(*))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "error_rate_pct",
    ("percentile_cont"((0.50)::double precision) WITHIN GROUP (ORDER BY (("response_ms")::double precision)))::integer AS "p50_ms",
    ("percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY (("response_ms")::double precision)))::integer AS "p95_ms",
    ("percentile_cont"((0.99)::double precision) WITHIN GROUP (ORDER BY (("response_ms")::double precision)))::integer AS "p99_ms",
    ("round"("avg"("data_age_s"), 0))::integer AS "avg_data_age_s"
   FROM "public"."api_usage_log"
  WHERE ("created_at" > ("now"() - '7 days'::interval))
  GROUP BY ("date_trunc"('hour'::"text", "created_at")), "endpoint", "tier";


ALTER VIEW "public"."v_api_hourly_stats" OWNER TO "postgres";

--
-- Name: v_api_key_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_api_key_stats" AS
SELECT
    NULL::"uuid" AS "key_id",
    NULL::"text" AS "key_prefix",
    NULL::"text" AS "name",
    NULL::"text" AS "tier",
    NULL::integer AS "rate_limit",
    NULL::"text" AS "rate_window",
    NULL::timestamp with time zone AS "key_created_at",
    NULL::timestamp with time zone AS "last_used_at",
    NULL::integer AS "requests_last_hour",
    NULL::integer AS "requests_last_day",
    NULL::integer AS "requests_last_7d",
    NULL::integer AS "errors_last_day",
    NULL::integer AS "rate_limits_last_day";


ALTER VIEW "public"."v_api_key_stats" OWNER TO "postgres";

--
-- Name: v_canonical_summary_coverage; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_canonical_summary_coverage" WITH ("security_invoker"='on') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."proposals") AS "total_proposals",
    ( SELECT "count"(*) AS "count"
           FROM "public"."proposals"
          WHERE ("proposals"."proposal_id" IS NOT NULL)) AS "with_proposal_id",
    ( SELECT "count"(*) AS "count"
           FROM "public"."proposal_voting_summary") AS "with_canonical_summary";


ALTER VIEW "public"."v_canonical_summary_coverage" OWNER TO "postgres";

--
-- Name: v_hash_verification; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_hash_verification" WITH ("security_invoker"='on') AS
 SELECT "count"(*) FILTER (WHERE ("hash_verified" = true)) AS "rationale_verified",
    "count"(*) FILTER (WHERE ("hash_verified" = false)) AS "rationale_mismatch",
    "count"(*) FILTER (WHERE ("hash_verified" IS NULL)) AS "rationale_pending",
    "count"(*) FILTER (WHERE (("hash_verified" IS NULL) AND ("hash_check_attempted_at" IS NOT NULL))) AS "rationale_unreachable",
        CASE
            WHEN ("count"(*) FILTER (WHERE ("hash_verified" IS NOT NULL)) > 0) THEN "round"(((("count"(*) FILTER (WHERE ("hash_verified" = false)))::numeric / ("count"(*) FILTER (WHERE ("hash_verified" IS NOT NULL)))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "mismatch_rate_pct"
   FROM "public"."vote_rationales";


ALTER VIEW "public"."v_hash_verification" OWNER TO "postgres";

--
-- Name: v_metadata_verification; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_metadata_verification" WITH ("security_invoker"='on') AS
 SELECT "count"(*) FILTER (WHERE ("metadata_hash_verified" = true)) AS "drep_verified",
    "count"(*) FILTER (WHERE ("metadata_hash_verified" = false)) AS "drep_mismatch",
    "count"(*) FILTER (WHERE ("metadata_hash_verified" IS NULL)) AS "drep_pending",
    "count"(*) FILTER (WHERE ("anchor_hash" IS NOT NULL)) AS "drep_with_anchor_hash"
   FROM "public"."dreps";


ALTER VIEW "public"."v_metadata_verification" OWNER TO "postgres";

--
-- Name: v_reconciliation_status; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_reconciliation_status" AS
 SELECT DISTINCT ON ("source") "id",
    "checked_at",
    "source",
    "tier_scope",
    "results",
    "overall_status",
    "mismatches",
    "duration_ms",
    "metadata"
   FROM "public"."reconciliation_log"
  ORDER BY "source", "checked_at" DESC;


ALTER VIEW "public"."v_reconciliation_status" OWNER TO "postgres";

--
-- Name: v_sync_health; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_sync_health" WITH ("security_invoker"='on') AS
 SELECT "sync_type",
    "max"("started_at") AS "last_run",
    "max"("finished_at") AS "last_finished",
    ( SELECT "s2"."duration_ms"
           FROM "public"."sync_log" "s2"
          WHERE ("s2"."sync_type" = "s1"."sync_type")
          ORDER BY "s2"."started_at" DESC
         LIMIT 1) AS "last_duration_ms",
    ( SELECT "s2"."success"
           FROM "public"."sync_log" "s2"
          WHERE ("s2"."sync_type" = "s1"."sync_type")
          ORDER BY "s2"."started_at" DESC
         LIMIT 1) AS "last_success",
    ( SELECT "s2"."error_message"
           FROM "public"."sync_log" "s2"
          WHERE ("s2"."sync_type" = "s1"."sync_type")
          ORDER BY "s2"."started_at" DESC
         LIMIT 1) AS "last_error",
    "count"(*) FILTER (WHERE ("success" = true)) AS "success_count",
    "count"(*) FILTER (WHERE ("success" = false)) AS "failure_count"
   FROM "public"."sync_log" "s1"
  GROUP BY "sync_type";


ALTER VIEW "public"."v_sync_health" OWNER TO "postgres";

--
-- Name: v_system_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_system_stats" WITH ("security_invoker"='on') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."dreps") AS "total_dreps",
    ( SELECT "count"(*) AS "count"
           FROM "public"."drep_votes") AS "total_votes",
    ( SELECT "count"(*) AS "count"
           FROM "public"."proposals") AS "total_proposals",
    ( SELECT "count"(*) AS "count"
           FROM "public"."vote_rationales") AS "total_rationales",
    ( SELECT "count"(*) AS "count"
           FROM "public"."drep_power_snapshots") AS "total_power_snapshots",
    ( SELECT "count"(DISTINCT "drep_power_snapshots"."drep_id") AS "count"
           FROM "public"."drep_power_snapshots") AS "dreps_with_snapshots",
    ( SELECT "max"("drep_votes"."block_time") AS "max"
           FROM "public"."drep_votes") AS "newest_vote_time",
    ( SELECT "max"("proposal_voting_summary"."fetched_at") AS "max"
           FROM "public"."proposal_voting_summary") AS "newest_summary_fetch";


ALTER VIEW "public"."v_system_stats" OWNER TO "postgres";

--
-- Name: v_vote_power_coverage; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW "public"."v_vote_power_coverage" WITH ("security_invoker"='on') AS
 SELECT "count"(*) AS "total_votes",
    "count"("voting_power_lovelace") AS "with_power",
    "count"(*) FILTER (WHERE ("voting_power_lovelace" IS NULL)) AS "null_power",
    "count"(*) FILTER (WHERE ("power_source" = 'exact'::"text")) AS "exact_count",
    "count"(*) FILTER (WHERE ("power_source" = 'nearest'::"text")) AS "nearest_count",
        CASE
            WHEN ("count"(*) > 0) THEN "round"(((("count"("voting_power_lovelace"))::numeric / ("count"(*))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "coverage_pct"
   FROM "public"."drep_votes";


ALTER VIEW "public"."v_vote_power_coverage" OWNER TO "postgres";

--
-- Name: vote_explanations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "public"."vote_explanations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drep_id" "text" NOT NULL,
    "proposal_tx_hash" "text" NOT NULL,
    "proposal_index" integer NOT NULL,
    "explanation_text" "text" NOT NULL,
    "ai_assisted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vote_explanations" OWNER TO "postgres";

--
-- Name: ai_health_metrics id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_health_metrics" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_health_metrics_id_seq"'::"regclass");


--
-- Name: community_intelligence_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."community_intelligence_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."community_intelligence_snapshots_id_seq"'::"regclass");


--
-- Name: governance_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."governance_events_id_seq"'::"regclass");


--
-- Name: integrity_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."integrity_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."integrity_snapshots_id_seq"'::"regclass");


--
-- Name: ncl_periods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ncl_periods" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ncl_periods_id_seq"'::"regclass");


--
-- Name: scoring_methodology_changelog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scoring_methodology_changelog" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."scoring_methodology_changelog_id_seq"'::"regclass");


--
-- Name: snapshot_completeness_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."snapshot_completeness_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."snapshot_completeness_log_id_seq"'::"regclass");


--
-- Name: spo_sybil_flags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_sybil_flags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."spo_sybil_flags_id_seq"'::"regclass");


--
-- Name: sync_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."sync_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sync_log_id_seq"'::"regclass");


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: agent_conversations agent_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id");


--
-- Name: agent_conversations agent_conversations_proposal_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_proposal_id_user_id_key" UNIQUE ("proposal_id", "user_id");


--
-- Name: ai_activity_log ai_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_activity_log"
    ADD CONSTRAINT "ai_activity_log_pkey" PRIMARY KEY ("id");


--
-- Name: ai_health_metrics ai_health_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_health_metrics"
    ADD CONSTRAINT "ai_health_metrics_pkey" PRIMARY KEY ("id");


--
-- Name: alignment_drift_records alignment_drift_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."alignment_drift_records"
    ADD CONSTRAINT "alignment_drift_records_pkey" PRIMARY KEY ("id");


--
-- Name: alignment_snapshots alignment_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."alignment_snapshots"
    ADD CONSTRAINT "alignment_snapshots_pkey" PRIMARY KEY ("drep_id", "epoch");


--
-- Name: amendment_genealogy amendment_genealogy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."amendment_genealogy"
    ADD CONSTRAINT "amendment_genealogy_pkey" PRIMARY KEY ("id");


--
-- Name: amendment_section_sentiment amendment_section_sentiment_draft_id_section_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."amendment_section_sentiment"
    ADD CONSTRAINT "amendment_section_sentiment_draft_id_section_id_user_id_key" UNIQUE ("draft_id", "section_id", "user_id");


--
-- Name: amendment_section_sentiment amendment_section_sentiment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."amendment_section_sentiment"
    ADD CONSTRAINT "amendment_section_sentiment_pkey" PRIMARY KEY ("id");


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash");


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");


--
-- Name: api_usage_log api_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."api_usage_log"
    ADD CONSTRAINT "api_usage_log_pkey" PRIMARY KEY ("id");


--
-- Name: catalyst_campaigns catalyst_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_campaigns"
    ADD CONSTRAINT "catalyst_campaigns_pkey" PRIMARY KEY ("id");


--
-- Name: catalyst_funds catalyst_funds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_funds"
    ADD CONSTRAINT "catalyst_funds_pkey" PRIMARY KEY ("id");


--
-- Name: catalyst_proposal_team catalyst_proposal_team_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_proposal_team"
    ADD CONSTRAINT "catalyst_proposal_team_pkey" PRIMARY KEY ("proposal_id", "team_member_id");


--
-- Name: catalyst_proposals catalyst_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_proposals"
    ADD CONSTRAINT "catalyst_proposals_pkey" PRIMARY KEY ("id");


--
-- Name: catalyst_team_members catalyst_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_team_members"
    ADD CONSTRAINT "catalyst_team_members_pkey" PRIMARY KEY ("id");


--
-- Name: cc_agreement_matrix cc_agreement_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_agreement_matrix"
    ADD CONSTRAINT "cc_agreement_matrix_pkey" PRIMARY KEY ("member_a", "member_b");


--
-- Name: cc_bloc_assignments cc_bloc_assignments_cc_hot_id_computed_at_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_bloc_assignments"
    ADD CONSTRAINT "cc_bloc_assignments_cc_hot_id_computed_at_key" UNIQUE ("cc_hot_id", "computed_at");


--
-- Name: cc_bloc_assignments cc_bloc_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_bloc_assignments"
    ADD CONSTRAINT "cc_bloc_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: cc_fidelity_proposal_snapshots cc_fidelity_proposal_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_fidelity_proposal_snapshots"
    ADD CONSTRAINT "cc_fidelity_proposal_snapshots_pkey" PRIMARY KEY ("cc_hot_id", "proposal_tx_hash", "proposal_index");


--
-- Name: cc_intelligence_briefs cc_intelligence_briefs_brief_type_reference_id_persona_vari_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_intelligence_briefs"
    ADD CONSTRAINT "cc_intelligence_briefs_brief_type_reference_id_persona_vari_key" UNIQUE ("brief_type", "reference_id", "persona_variant");


--
-- Name: cc_intelligence_briefs cc_intelligence_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_intelligence_briefs"
    ADD CONSTRAINT "cc_intelligence_briefs_pkey" PRIMARY KEY ("id");


--
-- Name: cc_interpretation_history cc_interpretation_history_cc_hot_id_article_proposal_tx_has_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_interpretation_history"
    ADD CONSTRAINT "cc_interpretation_history_cc_hot_id_article_proposal_tx_has_key" UNIQUE ("cc_hot_id", "article", "proposal_tx_hash", "proposal_index");


--
-- Name: cc_interpretation_history cc_interpretation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_interpretation_history"
    ADD CONSTRAINT "cc_interpretation_history_pkey" PRIMARY KEY ("id");


--
-- Name: cc_member_archetypes cc_member_archetypes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_member_archetypes"
    ADD CONSTRAINT "cc_member_archetypes_pkey" PRIMARY KEY ("cc_hot_id");


--
-- Name: cc_members cc_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_members"
    ADD CONSTRAINT "cc_members_pkey" PRIMARY KEY ("cc_hot_id");


--
-- Name: cc_precedent_links cc_precedent_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_precedent_links"
    ADD CONSTRAINT "cc_precedent_links_pkey" PRIMARY KEY ("id");


--
-- Name: cc_precedent_links cc_precedent_links_source_tx_hash_source_index_target_tx_ha_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_precedent_links"
    ADD CONSTRAINT "cc_precedent_links_source_tx_hash_source_index_target_tx_ha_key" UNIQUE ("source_tx_hash", "source_index", "target_tx_hash", "target_index");


--
-- Name: cc_predictive_signals cc_predictive_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_predictive_signals"
    ADD CONSTRAINT "cc_predictive_signals_pkey" PRIMARY KEY ("id");


--
-- Name: cc_predictive_signals cc_predictive_signals_proposal_tx_hash_proposal_index_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_predictive_signals"
    ADD CONSTRAINT "cc_predictive_signals_proposal_tx_hash_proposal_index_key" UNIQUE ("proposal_tx_hash", "proposal_index");


--
-- Name: cc_rationale_analysis cc_rationale_analysis_cc_hot_id_proposal_tx_hash_proposal_i_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_rationale_analysis"
    ADD CONSTRAINT "cc_rationale_analysis_cc_hot_id_proposal_tx_hash_proposal_i_key" UNIQUE ("cc_hot_id", "proposal_tx_hash", "proposal_index");


--
-- Name: cc_rationale_analysis cc_rationale_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_rationale_analysis"
    ADD CONSTRAINT "cc_rationale_analysis_pkey" PRIMARY KEY ("id");


--
-- Name: cc_rationales cc_rationales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_rationales"
    ADD CONSTRAINT "cc_rationales_pkey" PRIMARY KEY ("cc_hot_id", "proposal_tx_hash", "proposal_index");


--
-- Name: cc_fidelity_snapshots cc_transparency_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_fidelity_snapshots"
    ADD CONSTRAINT "cc_transparency_snapshots_pkey" PRIMARY KEY ("cc_hot_id", "epoch_no");


--
-- Name: cc_votes cc_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cc_votes"
    ADD CONSTRAINT "cc_votes_pkey" PRIMARY KEY ("cc_hot_id", "proposal_tx_hash", "proposal_index");


--
-- Name: cip108_documents cip108_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cip108_documents"
    ADD CONSTRAINT "cip108_documents_pkey" PRIMARY KEY ("content_hash");


--
-- Name: citizen_assemblies citizen_assemblies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_assemblies"
    ADD CONSTRAINT "citizen_assemblies_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_assembly_responses citizen_assembly_responses_assembly_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_assembly_responses"
    ADD CONSTRAINT "citizen_assembly_responses_assembly_id_user_id_key" UNIQUE ("assembly_id", "user_id");


--
-- Name: citizen_assembly_responses citizen_assembly_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_assembly_responses"
    ADD CONSTRAINT "citizen_assembly_responses_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_concern_flags citizen_concern_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_concern_flags"
    ADD CONSTRAINT "citizen_concern_flags_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_concern_flags citizen_concern_flags_proposal_tx_hash_proposal_index_user__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_concern_flags"
    ADD CONSTRAINT "citizen_concern_flags_proposal_tx_hash_proposal_index_user__key" UNIQUE ("proposal_tx_hash", "proposal_index", "user_id", "flag_type");


--
-- Name: citizen_endorsements citizen_endorsements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_endorsements"
    ADD CONSTRAINT "citizen_endorsements_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_endorsements citizen_endorsements_user_entity_type_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_endorsements"
    ADD CONSTRAINT "citizen_endorsements_user_entity_type_unique" UNIQUE ("user_id", "entity_type", "entity_id", "endorsement_type");


--
-- Name: citizen_epoch_summaries citizen_epoch_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_epoch_summaries"
    ADD CONSTRAINT "citizen_epoch_summaries_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_epoch_summaries citizen_epoch_summaries_user_id_epoch_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_epoch_summaries"
    ADD CONSTRAINT "citizen_epoch_summaries_user_id_epoch_no_key" UNIQUE ("user_id", "epoch_no");


--
-- Name: citizen_impact_scores citizen_impact_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_impact_scores"
    ADD CONSTRAINT "citizen_impact_scores_pkey" PRIMARY KEY ("user_id");


--
-- Name: citizen_impact_tags citizen_impact_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_impact_tags"
    ADD CONSTRAINT "citizen_impact_tags_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_impact_tags citizen_impact_tags_proposal_tx_hash_proposal_index_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_impact_tags"
    ADD CONSTRAINT "citizen_impact_tags_proposal_tx_hash_proposal_index_user_id_key" UNIQUE ("proposal_tx_hash", "proposal_index", "user_id");


--
-- Name: citizen_milestones citizen_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_milestones"
    ADD CONSTRAINT "citizen_milestones_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_milestones citizen_milestones_user_id_milestone_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_milestones"
    ADD CONSTRAINT "citizen_milestones_user_id_milestone_key_key" UNIQUE ("user_id", "milestone_key");


--
-- Name: citizen_priority_rankings citizen_priority_rankings_epoch_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_priority_rankings"
    ADD CONSTRAINT "citizen_priority_rankings_epoch_key" UNIQUE ("epoch");


--
-- Name: citizen_priority_rankings citizen_priority_rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_priority_rankings"
    ADD CONSTRAINT "citizen_priority_rankings_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_priority_signals citizen_priority_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_priority_signals"
    ADD CONSTRAINT "citizen_priority_signals_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_priority_signals citizen_priority_signals_user_id_epoch_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_priority_signals"
    ADD CONSTRAINT "citizen_priority_signals_user_id_epoch_key" UNIQUE ("user_id", "epoch");


--
-- Name: citizen_proposal_followups citizen_proposal_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_proposal_followups"
    ADD CONSTRAINT "citizen_proposal_followups_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_ring_snapshots citizen_ring_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_ring_snapshots"
    ADD CONSTRAINT "citizen_ring_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_ring_snapshots citizen_ring_snapshots_user_id_epoch_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_ring_snapshots"
    ADD CONSTRAINT "citizen_ring_snapshots_user_id_epoch_key" UNIQUE ("user_id", "epoch");


--
-- Name: citizen_sentiment citizen_sentiment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_sentiment"
    ADD CONSTRAINT "citizen_sentiment_pkey" PRIMARY KEY ("id");


--
-- Name: citizen_sentiment citizen_sentiment_proposal_tx_hash_proposal_index_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_sentiment"
    ADD CONSTRAINT "citizen_sentiment_proposal_tx_hash_proposal_index_user_id_key" UNIQUE ("proposal_tx_hash", "proposal_index", "user_id");


--
-- Name: classification_history classification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."classification_history"
    ADD CONSTRAINT "classification_history_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index", "classified_at");


--
-- Name: community_intelligence_snapshots community_intelligence_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."community_intelligence_snapshots"
    ADD CONSTRAINT "community_intelligence_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: decentralization_snapshots decentralization_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."decentralization_snapshots"
    ADD CONSTRAINT "decentralization_snapshots_pkey" PRIMARY KEY ("epoch_no");


--
-- Name: decision_journal_entries decision_journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."decision_journal_entries"
    ADD CONSTRAINT "decision_journal_entries_pkey" PRIMARY KEY ("id");


--
-- Name: decision_journal_entries decision_journal_entries_user_id_proposal_tx_hash_proposal__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."decision_journal_entries"
    ADD CONSTRAINT "decision_journal_entries_user_id_proposal_tx_hash_proposal__key" UNIQUE ("user_id", "proposal_tx_hash", "proposal_index");


--
-- Name: delegation_snapshots delegation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."delegation_snapshots"
    ADD CONSTRAINT "delegation_snapshots_pkey" PRIMARY KEY ("epoch", "drep_id");


--
-- Name: draft_review_responses draft_review_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."draft_review_responses"
    ADD CONSTRAINT "draft_review_responses_pkey" PRIMARY KEY ("id");


--
-- Name: draft_reviews draft_reviews_draft_id_reviewer_stake_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."draft_reviews"
    ADD CONSTRAINT "draft_reviews_draft_id_reviewer_stake_address_key" UNIQUE ("draft_id", "reviewer_stake_address");


--
-- Name: draft_reviews draft_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."draft_reviews"
    ADD CONSTRAINT "draft_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: drep_characters drep_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_characters"
    ADD CONSTRAINT "drep_characters_pkey" PRIMARY KEY ("drep_id", "epoch");


--
-- Name: drep_delegator_snapshots drep_delegator_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_delegator_snapshots"
    ADD CONSTRAINT "drep_delegator_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: drep_epoch_updates drep_epoch_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_epoch_updates"
    ADD CONSTRAINT "drep_epoch_updates_pkey" PRIMARY KEY ("drep_id", "epoch");


--
-- Name: drep_lifecycle_events drep_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_lifecycle_events"
    ADD CONSTRAINT "drep_lifecycle_events_pkey" PRIMARY KEY ("id");


--
-- Name: drep_milestones drep_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_milestones"
    ADD CONSTRAINT "drep_milestones_pkey" PRIMARY KEY ("drep_id", "milestone_key");


--
-- Name: drep_pca_coordinates drep_pca_coordinates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_pca_coordinates"
    ADD CONSTRAINT "drep_pca_coordinates_pkey" PRIMARY KEY ("drep_id", "run_id");


--
-- Name: drep_power_snapshots drep_power_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_power_snapshots"
    ADD CONSTRAINT "drep_power_snapshots_pkey" PRIMARY KEY ("drep_id", "epoch_no");


--
-- Name: drep_questions drep_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_questions"
    ADD CONSTRAINT "drep_questions_pkey" PRIMARY KEY ("id");


--
-- Name: drep_responses drep_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_responses"
    ADD CONSTRAINT "drep_responses_pkey" PRIMARY KEY ("id");


--
-- Name: drep_score_history drep_score_history_drep_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_score_history"
    ADD CONSTRAINT "drep_score_history_drep_id_snapshot_date_key" UNIQUE ("drep_id", "snapshot_date");


--
-- Name: drep_score_history drep_score_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_score_history"
    ADD CONSTRAINT "drep_score_history_pkey" PRIMARY KEY ("id");


--
-- Name: drep_votes drep_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_votes"
    ADD CONSTRAINT "drep_votes_pkey" PRIMARY KEY ("vote_tx_hash");


--
-- Name: dreps dreps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."dreps"
    ADD CONSTRAINT "dreps_pkey" PRIMARY KEY ("id");


--
-- Name: embeddings embeddings_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."embeddings"
    ADD CONSTRAINT "embeddings_entity_type_entity_id_key" UNIQUE ("entity_type", "entity_id");


--
-- Name: embeddings embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."embeddings"
    ADD CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id");


--
-- Name: encrypted_api_keys encrypted_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."encrypted_api_keys"
    ADD CONSTRAINT "encrypted_api_keys_pkey" PRIMARY KEY ("id");


--
-- Name: encrypted_api_keys encrypted_api_keys_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."encrypted_api_keys"
    ADD CONSTRAINT "encrypted_api_keys_user_id_provider_key" UNIQUE ("user_id", "provider");


--
-- Name: engagement_signal_aggregations engagement_signal_aggregation_entity_type_entity_id_signal__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."engagement_signal_aggregations"
    ADD CONSTRAINT "engagement_signal_aggregation_entity_type_entity_id_signal__key" UNIQUE ("entity_type", "entity_id", "signal_type", "epoch");


--
-- Name: engagement_signal_aggregations engagement_signal_aggregations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."engagement_signal_aggregations"
    ADD CONSTRAINT "engagement_signal_aggregations_pkey" PRIMARY KEY ("id");


--
-- Name: epoch_governance_summaries epoch_governance_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."epoch_governance_summaries"
    ADD CONSTRAINT "epoch_governance_summaries_pkey" PRIMARY KEY ("epoch_no");


--
-- Name: epoch_recaps epoch_recaps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."epoch_recaps"
    ADD CONSTRAINT "epoch_recaps_pkey" PRIMARY KEY ("epoch");


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key");


--
-- Name: ghi_snapshots ghi_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ghi_snapshots"
    ADD CONSTRAINT "ghi_snapshots_pkey" PRIMARY KEY ("epoch_no");


--
-- Name: governance_benchmarks governance_benchmarks_chain_period_label_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_benchmarks"
    ADD CONSTRAINT "governance_benchmarks_chain_period_label_key" UNIQUE ("chain", "period_label");


--
-- Name: governance_benchmarks governance_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_benchmarks"
    ADD CONSTRAINT "governance_benchmarks_pkey" PRIMARY KEY ("id");


--
-- Name: governance_briefs governance_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_briefs"
    ADD CONSTRAINT "governance_briefs_pkey" PRIMARY KEY ("id");


--
-- Name: governance_epoch_stats governance_epoch_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_epoch_stats"
    ADD CONSTRAINT "governance_epoch_stats_pkey" PRIMARY KEY ("epoch_no");


--
-- Name: governance_events governance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_events"
    ADD CONSTRAINT "governance_events_pkey" PRIMARY KEY ("id");


--
-- Name: governance_participation_snapshots governance_participation_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_participation_snapshots"
    ADD CONSTRAINT "governance_participation_snapshots_pkey" PRIMARY KEY ("epoch");


--
-- Name: governance_passport governance_passport_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_passport"
    ADD CONSTRAINT "governance_passport_pkey" PRIMARY KEY ("id");


--
-- Name: governance_passport governance_passport_stake_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_passport"
    ADD CONSTRAINT "governance_passport_stake_address_key" UNIQUE ("stake_address");


--
-- Name: governance_philosophy governance_philosophy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_philosophy"
    ADD CONSTRAINT "governance_philosophy_pkey" PRIMARY KEY ("drep_id");


--
-- Name: governance_reports governance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_reports"
    ADD CONSTRAINT "governance_reports_pkey" PRIMARY KEY ("epoch");


--
-- Name: governance_stats governance_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_stats"
    ADD CONSTRAINT "governance_stats_pkey" PRIMARY KEY ("id");


--
-- Name: governance_wrapped governance_wrapped_entity_type_entity_id_period_type_period_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_wrapped"
    ADD CONSTRAINT "governance_wrapped_entity_type_entity_id_period_type_period_key" UNIQUE ("entity_type", "entity_id", "period_type", "period_id");


--
-- Name: governance_wrapped governance_wrapped_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_wrapped"
    ADD CONSTRAINT "governance_wrapped_pkey" PRIMARY KEY ("id");


--
-- Name: integrity_snapshots integrity_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."integrity_snapshots"
    ADD CONSTRAINT "integrity_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: integrity_snapshots integrity_snapshots_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."integrity_snapshots"
    ADD CONSTRAINT "integrity_snapshots_snapshot_date_key" UNIQUE ("snapshot_date");


--
-- Name: inter_body_alignment inter_body_alignment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."inter_body_alignment"
    ADD CONSTRAINT "inter_body_alignment_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index");


--
-- Name: inter_body_alignment_snapshots inter_body_alignment_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."inter_body_alignment_snapshots"
    ADD CONSTRAINT "inter_body_alignment_snapshots_pkey" PRIMARY KEY ("epoch", "proposal_tx_hash", "proposal_index");


--
-- Name: matching_topics matching_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."matching_topics"
    ADD CONSTRAINT "matching_topics_pkey" PRIMARY KEY ("id");


--
-- Name: matching_topics matching_topics_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."matching_topics"
    ADD CONSTRAINT "matching_topics_slug_key" UNIQUE ("slug");


--
-- Name: metadata_archive metadata_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."metadata_archive"
    ADD CONSTRAINT "metadata_archive_pkey" PRIMARY KEY ("id");


--
-- Name: ncl_periods ncl_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ncl_periods"
    ADD CONSTRAINT "ncl_periods_pkey" PRIMARY KEY ("id");


--
-- Name: notification_log notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id");


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");


--
-- Name: notification_preferences notification_preferences_user_wallet_channel_event_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_wallet_channel_event_type_key" UNIQUE ("user_wallet", "channel", "event_type");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: observatory_narratives observatory_narratives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."observatory_narratives"
    ADD CONSTRAINT "observatory_narratives_pkey" PRIMARY KEY ("id");


--
-- Name: pca_results pca_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pca_results"
    ADD CONSTRAINT "pca_results_pkey" PRIMARY KEY ("run_id");


--
-- Name: perspective_clusters perspective_clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."perspective_clusters"
    ADD CONSTRAINT "perspective_clusters_pkey" PRIMARY KEY ("id");


--
-- Name: perspective_clusters perspective_clusters_proposal_tx_hash_proposal_index_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."perspective_clusters"
    ADD CONSTRAINT "perspective_clusters_proposal_tx_hash_proposal_index_key" UNIQUE ("proposal_tx_hash", "proposal_index");


--
-- Name: committee_members pk_committee_members; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "pk_committee_members" PRIMARY KEY ("cc_hot_id");


--
-- Name: poll_responses poll_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id");


--
-- Name: poll_responses poll_responses_proposal_tx_hash_proposal_index_wallet_addre_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_proposal_tx_hash_proposal_index_wallet_addre_key" UNIQUE ("proposal_tx_hash", "proposal_index", "wallet_address");


--
-- Name: poll_responses poll_responses_user_proposal_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_user_proposal_unique" UNIQUE ("proposal_tx_hash", "proposal_index", "user_id");


--
-- Name: pools pools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."pools"
    ADD CONSTRAINT "pools_pkey" PRIMARY KEY ("pool_id");


--
-- Name: position_statements position_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."position_statements"
    ADD CONSTRAINT "position_statements_pkey" PRIMARY KEY ("id");


--
-- Name: preview_cohorts preview_cohorts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_cohorts"
    ADD CONSTRAINT "preview_cohorts_pkey" PRIMARY KEY ("id");


--
-- Name: preview_feedback preview_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_feedback"
    ADD CONSTRAINT "preview_feedback_pkey" PRIMARY KEY ("id");


--
-- Name: preview_invites preview_invites_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_invites"
    ADD CONSTRAINT "preview_invites_code_key" UNIQUE ("code");


--
-- Name: preview_invites preview_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_invites"
    ADD CONSTRAINT "preview_invites_pkey" PRIMARY KEY ("id");


--
-- Name: preview_sessions preview_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_sessions"
    ADD CONSTRAINT "preview_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: profile_views profile_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_annotations proposal_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_annotations"
    ADD CONSTRAINT "proposal_annotations_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_brief_feedback proposal_brief_feedback_brief_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_brief_feedback"
    ADD CONSTRAINT "proposal_brief_feedback_brief_id_user_id_key" UNIQUE ("brief_id", "user_id");


--
-- Name: proposal_brief_feedback proposal_brief_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_brief_feedback"
    ADD CONSTRAINT "proposal_brief_feedback_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_briefs proposal_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_briefs"
    ADD CONSTRAINT "proposal_briefs_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_briefs proposal_briefs_proposal_tx_hash_proposal_index_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_briefs"
    ADD CONSTRAINT "proposal_briefs_proposal_tx_hash_proposal_index_key" UNIQUE ("proposal_tx_hash", "proposal_index");


--
-- Name: proposal_classifications proposal_classifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_classifications"
    ADD CONSTRAINT "proposal_classifications_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index");


--
-- Name: proposal_draft_versions proposal_draft_versions_draft_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_draft_versions"
    ADD CONSTRAINT "proposal_draft_versions_draft_id_version_number_key" UNIQUE ("draft_id", "version_number");


--
-- Name: proposal_draft_versions proposal_draft_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_draft_versions"
    ADD CONSTRAINT "proposal_draft_versions_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_drafts proposal_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_drafts"
    ADD CONSTRAINT "proposal_drafts_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_engagement_events proposal_engagement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_engagement_events"
    ADD CONSTRAINT "proposal_engagement_events_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_feedback_themes proposal_feedback_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_feedback_themes"
    ADD CONSTRAINT "proposal_feedback_themes_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_intelligence_cache proposal_intelligence_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_intelligence_cache"
    ADD CONSTRAINT "proposal_intelligence_cache_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_notes proposal_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_notes"
    ADD CONSTRAINT "proposal_notes_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_notes proposal_notes_user_id_proposal_tx_hash_proposal_index_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_notes"
    ADD CONSTRAINT "proposal_notes_user_id_proposal_tx_hash_proposal_index_key" UNIQUE ("user_id", "proposal_tx_hash", "proposal_index");


--
-- Name: proposal_outcomes proposal_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_outcomes"
    ADD CONSTRAINT "proposal_outcomes_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index");


--
-- Name: proposal_proposers proposal_proposers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_proposers"
    ADD CONSTRAINT "proposal_proposers_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index", "proposer_id");


--
-- Name: proposal_revision_notifications proposal_revision_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_revision_notifications"
    ADD CONSTRAINT "proposal_revision_notifications_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_similarity_cache proposal_similarity_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_similarity_cache"
    ADD CONSTRAINT "proposal_similarity_cache_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index", "similar_tx_hash", "similar_index");


--
-- Name: proposal_team_approvals proposal_team_approvals_draft_id_team_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_approvals"
    ADD CONSTRAINT "proposal_team_approvals_draft_id_team_member_id_key" UNIQUE ("draft_id", "team_member_id");


--
-- Name: proposal_team_approvals proposal_team_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_approvals"
    ADD CONSTRAINT "proposal_team_approvals_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_team_invites proposal_team_invites_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_invites"
    ADD CONSTRAINT "proposal_team_invites_invite_code_key" UNIQUE ("invite_code");


--
-- Name: proposal_team_invites proposal_team_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_invites"
    ADD CONSTRAINT "proposal_team_invites_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_team_members proposal_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_members"
    ADD CONSTRAINT "proposal_team_members_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_team_members proposal_team_members_team_id_stake_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_members"
    ADD CONSTRAINT "proposal_team_members_team_id_stake_address_key" UNIQUE ("team_id", "stake_address");


--
-- Name: proposal_teams proposal_teams_draft_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_teams"
    ADD CONSTRAINT "proposal_teams_draft_id_key" UNIQUE ("draft_id");


--
-- Name: proposal_teams proposal_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_teams"
    ADD CONSTRAINT "proposal_teams_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_theme_endorsements proposal_theme_endorsements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_theme_endorsements"
    ADD CONSTRAINT "proposal_theme_endorsements_pkey" PRIMARY KEY ("id");


--
-- Name: proposal_theme_endorsements proposal_theme_endorsements_theme_id_reviewer_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_theme_endorsements"
    ADD CONSTRAINT "proposal_theme_endorsements_theme_id_reviewer_user_id_key" UNIQUE ("theme_id", "reviewer_user_id");


--
-- Name: proposal_vote_snapshots proposal_vote_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_vote_snapshots"
    ADD CONSTRAINT "proposal_vote_snapshots_pkey" PRIMARY KEY ("epoch", "proposal_tx_hash", "proposal_index");


--
-- Name: proposal_voting_summary proposal_voting_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_voting_summary"
    ADD CONSTRAINT "proposal_voting_summary_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index");


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("tx_hash", "proposal_index");


--
-- Name: proposer_aliases proposer_aliases_alias_name_alias_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposer_aliases"
    ADD CONSTRAINT "proposer_aliases_alias_name_alias_key_key" UNIQUE ("alias_name", "alias_key");


--
-- Name: proposer_aliases proposer_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposer_aliases"
    ADD CONSTRAINT "proposer_aliases_pkey" PRIMARY KEY ("id");


--
-- Name: proposers proposers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposers"
    ADD CONSTRAINT "proposers_pkey" PRIMARY KEY ("id");


--
-- Name: rationale_documents rationale_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."rationale_documents"
    ADD CONSTRAINT "rationale_documents_pkey" PRIMARY KEY ("content_hash");


--
-- Name: reconciliation_log reconciliation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reconciliation_log"
    ADD CONSTRAINT "reconciliation_log_pkey" PRIMARY KEY ("id");


--
-- Name: research_conversations research_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."research_conversations"
    ADD CONSTRAINT "research_conversations_pkey" PRIMARY KEY ("id");


--
-- Name: research_conversations research_conversations_user_id_proposal_tx_hash_proposal_in_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."research_conversations"
    ADD CONSTRAINT "research_conversations_user_id_proposal_tx_hash_proposal_in_key" UNIQUE ("user_id", "proposal_tx_hash", "proposal_index");


--
-- Name: review_framework_templates review_framework_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."review_framework_templates"
    ADD CONSTRAINT "review_framework_templates_pkey" PRIMARY KEY ("id");


--
-- Name: review_sessions review_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."review_sessions"
    ADD CONSTRAINT "review_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: reviewer_briefing_cache reviewer_briefing_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reviewer_briefing_cache"
    ADD CONSTRAINT "reviewer_briefing_cache_pkey" PRIMARY KEY ("id");


--
-- Name: revoked_sessions revoked_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."revoked_sessions"
    ADD CONSTRAINT "revoked_sessions_pkey" PRIMARY KEY ("jti");


--
-- Name: scoring_methodology_changelog scoring_methodology_changelog_entity_type_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scoring_methodology_changelog"
    ADD CONSTRAINT "scoring_methodology_changelog_entity_type_version_key" UNIQUE ("entity_type", "version");


--
-- Name: scoring_methodology_changelog scoring_methodology_changelog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scoring_methodology_changelog"
    ADD CONSTRAINT "scoring_methodology_changelog_pkey" PRIMARY KEY ("id");


--
-- Name: semantic_similarity_cache semantic_similarity_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."semantic_similarity_cache"
    ADD CONSTRAINT "semantic_similarity_cache_pkey" PRIMARY KEY ("entity_type", "entity_id", "similar_entity_type", "similar_entity_id");


--
-- Name: seneca_conversation_summaries seneca_conversation_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seneca_conversation_summaries"
    ADD CONSTRAINT "seneca_conversation_summaries_pkey" PRIMARY KEY ("id");


--
-- Name: snapshot_completeness_log snapshot_completeness_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."snapshot_completeness_log"
    ADD CONSTRAINT "snapshot_completeness_log_pkey" PRIMARY KEY ("id");


--
-- Name: snapshot_completeness_log snapshot_completeness_log_snapshot_type_epoch_no_snapshot_d_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."snapshot_completeness_log"
    ADD CONSTRAINT "snapshot_completeness_log_snapshot_type_epoch_no_snapshot_d_key" UNIQUE ("snapshot_type", "epoch_no", "snapshot_date");


--
-- Name: social_link_checks social_link_checks_drep_id_uri_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."social_link_checks"
    ADD CONSTRAINT "social_link_checks_drep_id_uri_key" UNIQUE ("drep_id", "uri");


--
-- Name: social_link_checks social_link_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."social_link_checks"
    ADD CONSTRAINT "social_link_checks_pkey" PRIMARY KEY ("id");


--
-- Name: spo_alignment_snapshots spo_alignment_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_alignment_snapshots"
    ADD CONSTRAINT "spo_alignment_snapshots_pkey" PRIMARY KEY ("pool_id", "epoch_no");


--
-- Name: spo_characters spo_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_characters"
    ADD CONSTRAINT "spo_characters_pkey" PRIMARY KEY ("pool_id", "epoch");


--
-- Name: spo_power_snapshots spo_power_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_power_snapshots"
    ADD CONSTRAINT "spo_power_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: spo_power_snapshots spo_power_snapshots_pool_id_epoch_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_power_snapshots"
    ADD CONSTRAINT "spo_power_snapshots_pool_id_epoch_no_key" UNIQUE ("pool_id", "epoch_no");


--
-- Name: spo_score_snapshots spo_score_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_score_snapshots"
    ADD CONSTRAINT "spo_score_snapshots_pkey" PRIMARY KEY ("pool_id", "epoch_no");


--
-- Name: spo_sybil_flags spo_sybil_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_sybil_flags"
    ADD CONSTRAINT "spo_sybil_flags_pkey" PRIMARY KEY ("id");


--
-- Name: spo_sybil_flags spo_sybil_flags_pool_a_pool_b_epoch_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_sybil_flags"
    ADD CONSTRAINT "spo_sybil_flags_pool_a_pool_b_epoch_no_key" UNIQUE ("pool_a", "pool_b", "epoch_no");


--
-- Name: spo_votes spo_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."spo_votes"
    ADD CONSTRAINT "spo_votes_pkey" PRIMARY KEY ("pool_id", "proposal_tx_hash", "proposal_index");


--
-- Name: state_of_governance_reports state_of_governance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."state_of_governance_reports"
    ADD CONSTRAINT "state_of_governance_reports_pkey" PRIMARY KEY ("epoch_no");


--
-- Name: sync_cursors sync_cursors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."sync_cursors"
    ADD CONSTRAINT "sync_cursors_pkey" PRIMARY KEY ("sync_type");


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."sync_log"
    ADD CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id");


--
-- Name: tier_changes tier_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tier_changes"
    ADD CONSTRAINT "tier_changes_pkey" PRIMARY KEY ("id");


--
-- Name: treasury_accountability_polls treasury_accountability_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treasury_accountability_polls"
    ADD CONSTRAINT "treasury_accountability_polls_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index", "cycle_number");


--
-- Name: treasury_accountability_responses treasury_accountability_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treasury_accountability_responses"
    ADD CONSTRAINT "treasury_accountability_responses_pkey" PRIMARY KEY ("proposal_tx_hash", "proposal_index", "cycle_number", "user_address");


--
-- Name: treasury_health_snapshots treasury_health_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treasury_health_snapshots"
    ADD CONSTRAINT "treasury_health_snapshots_pkey" PRIMARY KEY ("epoch");


--
-- Name: treasury_snapshots treasury_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."treasury_snapshots"
    ADD CONSTRAINT "treasury_snapshots_pkey" PRIMARY KEY ("epoch_no");


--
-- Name: drep_delegator_snapshots uq_drep_delegator_snapshot; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_delegator_snapshots"
    ADD CONSTRAINT "uq_drep_delegator_snapshot" UNIQUE ("drep_id", "epoch_no", "stake_address");


--
-- Name: drep_lifecycle_events uq_drep_lifecycle_event; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_lifecycle_events"
    ADD CONSTRAINT "uq_drep_lifecycle_event" UNIQUE ("drep_id", "tx_hash");


--
-- Name: metadata_archive uq_metadata_archive; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."metadata_archive"
    ADD CONSTRAINT "uq_metadata_archive" UNIQUE ("entity_type", "entity_id", "content_hash");


--
-- Name: proposal_intelligence_cache uq_proposal_intel_cache; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_intelligence_cache"
    ADD CONSTRAINT "uq_proposal_intel_cache" UNIQUE ("proposal_tx_hash", "proposal_index", "section_type");


--
-- Name: review_sessions uq_review_sessions_voter_started; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."review_sessions"
    ADD CONSTRAINT "uq_review_sessions_voter_started" UNIQUE ("voter_id", "started_at");


--
-- Name: reviewer_briefing_cache uq_reviewer_briefing_cache; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reviewer_briefing_cache"
    ADD CONSTRAINT "uq_reviewer_briefing_cache" UNIQUE ("voter_id", "proposal_tx_hash", "proposal_index");


--
-- Name: user_channels user_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_channels"
    ADD CONSTRAINT "user_channels_pkey" PRIMARY KEY ("id");


--
-- Name: user_channels user_channels_user_wallet_channel_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_channels"
    ADD CONSTRAINT "user_channels_user_wallet_channel_key" UNIQUE ("user_wallet", "channel");


--
-- Name: user_entity_subscriptions user_entity_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entity_subscriptions"
    ADD CONSTRAINT "user_entity_subscriptions_pkey" PRIMARY KEY ("user_id", "entity_type", "entity_id");


--
-- Name: user_governance_profile_history user_governance_profile_history_new_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_governance_profile_history"
    ADD CONSTRAINT "user_governance_profile_history_new_pkey" PRIMARY KEY ("user_id", "snapshot_at");


--
-- Name: user_governance_profiles user_governance_profiles_new_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_governance_profiles"
    ADD CONSTRAINT "user_governance_profiles_new_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_hub_checkins user_hub_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_hub_checkins"
    ADD CONSTRAINT "user_hub_checkins_pkey" PRIMARY KEY ("id");


--
-- Name: user_hub_checkins user_hub_checkins_user_stake_address_epoch_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_hub_checkins"
    ADD CONSTRAINT "user_hub_checkins_user_stake_address_epoch_key" UNIQUE ("user_stake_address", "epoch");


--
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id");


--
-- Name: user_wallets user_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_wallets"
    ADD CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("stake_address");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: users users_wallet_address_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_wallet_address_unique" UNIQUE ("wallet_address");


--
-- Name: vote_explanations vote_explanations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."vote_explanations"
    ADD CONSTRAINT "vote_explanations_pkey" PRIMARY KEY ("id");


--
-- Name: vote_rationales vote_rationales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."vote_rationales"
    ADD CONSTRAINT "vote_rationales_pkey" PRIMARY KEY ("vote_tx_hash");


--
-- Name: citizen_endorsements_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "citizen_endorsements_entity_idx" ON "public"."citizen_endorsements" USING "btree" ("entity_type", "entity_id");


--
-- Name: citizen_endorsements_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "citizen_endorsements_unique" ON "public"."citizen_endorsements" USING "btree" ("user_id", "entity_type", "entity_id", "endorsement_type");


--
-- Name: idx_accountability_polls_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_accountability_polls_epoch" ON "public"."treasury_accountability_polls" USING "btree" ("opened_epoch");


--
-- Name: idx_accountability_polls_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_accountability_polls_status" ON "public"."treasury_accountability_polls" USING "btree" ("status");


--
-- Name: idx_accountability_responses_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_accountability_responses_proposal" ON "public"."treasury_accountability_responses" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_accountability_responses_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_accountability_responses_user" ON "public"."treasury_accountability_responses" USING "btree" ("user_address");


--
-- Name: idx_admin_audit_log_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_audit_log_created" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_admin_audit_log_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_audit_log_wallet" ON "public"."admin_audit_log" USING "btree" ("wallet_address");


--
-- Name: idx_agent_conversations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agent_conversations_user" ON "public"."agent_conversations" USING "btree" ("user_id");


--
-- Name: idx_ai_activity_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_activity_draft" ON "public"."ai_activity_log" USING "btree" ("draft_id");


--
-- Name: idx_ai_activity_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_activity_proposal" ON "public"."ai_activity_log" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_ai_activity_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_activity_user" ON "public"."ai_activity_log" USING "btree" ("user_id");


--
-- Name: idx_ai_health_metrics_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_health_metrics_created" ON "public"."ai_health_metrics" USING "btree" ("created_at" DESC);


--
-- Name: idx_ai_health_metrics_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_health_metrics_status" ON "public"."ai_health_metrics" USING "btree" ("status", "created_at" DESC);


--
-- Name: idx_ai_health_metrics_use_case; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_health_metrics_use_case" ON "public"."ai_health_metrics" USING "btree" ("use_case", "created_at" DESC);


--
-- Name: idx_alignment_snapshots_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_alignment_snapshots_drep" ON "public"."alignment_snapshots" USING "btree" ("drep_id", "epoch" DESC);


--
-- Name: idx_amendment_sentiment_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_amendment_sentiment_draft" ON "public"."amendment_section_sentiment" USING "btree" ("draft_id");


--
-- Name: idx_amendment_sentiment_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_amendment_sentiment_section" ON "public"."amendment_section_sentiment" USING "btree" ("draft_id", "section_id");


--
-- Name: idx_annotations_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_annotations_proposal" ON "public"."proposal_annotations" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_annotations_public; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_annotations_public" ON "public"."proposal_annotations" USING "btree" ("proposal_tx_hash", "proposal_index") WHERE ("is_public" = true);


--
-- Name: idx_annotations_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_annotations_user" ON "public"."proposal_annotations" USING "btree" ("user_id");


--
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_api_keys_hash" ON "public"."api_keys" USING "btree" ("key_hash") WHERE ("revoked_at" IS NULL);


--
-- Name: idx_api_keys_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_api_keys_owner" ON "public"."api_keys" USING "btree" ("owner_wallet") WHERE ("revoked_at" IS NULL);


--
-- Name: idx_api_usage_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_api_usage_created" ON "public"."api_usage_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_api_usage_endpoint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_api_usage_endpoint" ON "public"."api_usage_log" USING "btree" ("endpoint", "created_at" DESC);


--
-- Name: idx_api_usage_key_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_api_usage_key_time" ON "public"."api_usage_log" USING "btree" ("key_id", "created_at" DESC);


--
-- Name: idx_api_usage_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_api_usage_tier" ON "public"."api_usage_log" USING "btree" ("tier", "created_at" DESC);


--
-- Name: idx_assemblies_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_assemblies_active" ON "public"."citizen_assemblies" USING "btree" ("status", "opens_at", "closes_at") WHERE ("status" = 'active'::"text");


--
-- Name: idx_assemblies_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_assemblies_epoch" ON "public"."citizen_assemblies" USING "btree" ("epoch");


--
-- Name: idx_assemblies_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_assemblies_status" ON "public"."citizen_assemblies" USING "btree" ("status");


--
-- Name: idx_assembly_responses_assembly; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_assembly_responses_assembly" ON "public"."citizen_assembly_responses" USING "btree" ("assembly_id");


--
-- Name: idx_assembly_responses_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_assembly_responses_user" ON "public"."citizen_assembly_responses" USING "btree" ("user_id");


--
-- Name: idx_benchmarks_chain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_benchmarks_chain" ON "public"."governance_benchmarks" USING "btree" ("chain");


--
-- Name: idx_benchmarks_chain_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_benchmarks_chain_period" ON "public"."governance_benchmarks" USING "btree" ("chain", "period_label" DESC);


--
-- Name: idx_benchmarks_fetched; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_benchmarks_fetched" ON "public"."governance_benchmarks" USING "btree" ("fetched_at" DESC);


--
-- Name: idx_brief_feedback_brief; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_brief_feedback_brief" ON "public"."proposal_brief_feedback" USING "btree" ("brief_id");


--
-- Name: idx_briefs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_briefs_created" ON "public"."governance_briefs" USING "btree" ("created_at" DESC);


--
-- Name: idx_briefs_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_briefs_lookup" ON "public"."cc_intelligence_briefs" USING "btree" ("brief_type", "reference_id", "persona_variant");


--
-- Name: idx_briefs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_briefs_user" ON "public"."governance_briefs" USING "btree" ("user_id");


--
-- Name: idx_briefs_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_briefs_wallet" ON "public"."governance_briefs" USING "btree" ("wallet_address");


--
-- Name: idx_catalyst_campaigns_fund; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_campaigns_fund" ON "public"."catalyst_campaigns" USING "btree" ("fund_id");


--
-- Name: idx_catalyst_proposals_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_proposals_campaign" ON "public"."catalyst_proposals" USING "btree" ("campaign_id");


--
-- Name: idx_catalyst_proposals_chain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_proposals_chain" ON "public"."catalyst_proposals" USING "btree" ("chain_proposal_id") WHERE ("chain_proposal_id" IS NOT NULL);


--
-- Name: idx_catalyst_proposals_fund; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_proposals_fund" ON "public"."catalyst_proposals" USING "btree" ("fund_id");


--
-- Name: idx_catalyst_proposals_funded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_proposals_funded_at" ON "public"."catalyst_proposals" USING "btree" ("funded_at");


--
-- Name: idx_catalyst_proposals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_proposals_status" ON "public"."catalyst_proposals" USING "btree" ("status", "funding_status");


--
-- Name: idx_catalyst_pt_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_pt_team" ON "public"."catalyst_proposal_team" USING "btree" ("team_member_id");


--
-- Name: idx_catalyst_team_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_catalyst_team_name" ON "public"."catalyst_team_members" USING "btree" ("name");


--
-- Name: idx_cc_members_epoch_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_members_epoch_range" ON "public"."cc_members" USING "btree" ("authorization_epoch", "expiration_epoch");


--
-- Name: idx_cc_members_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_members_status" ON "public"."committee_members" USING "btree" ("status");


--
-- Name: idx_cc_proposal_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_proposal_snapshots_epoch" ON "public"."cc_fidelity_proposal_snapshots" USING "btree" ("cc_hot_id", "proposal_epoch");


--
-- Name: idx_cc_transparency_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_transparency_snapshots_epoch" ON "public"."cc_fidelity_snapshots" USING "btree" ("epoch_no");


--
-- Name: idx_cc_transparency_snapshots_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_transparency_snapshots_member" ON "public"."cc_fidelity_snapshots" USING "btree" ("cc_hot_id");


--
-- Name: idx_cc_votes_cc_cold_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_votes_cc_cold_id" ON "public"."cc_votes" USING "btree" ("cc_cold_id");


--
-- Name: idx_cc_votes_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_votes_epoch" ON "public"."cc_votes" USING "btree" ("epoch");


--
-- Name: idx_cc_votes_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cc_votes_proposal" ON "public"."cc_votes" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_ch_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ch_proposal" ON "public"."classification_history" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_cip108_documents_draft_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cip108_documents_draft_id" ON "public"."cip108_documents" USING "btree" ("draft_id");


--
-- Name: idx_citizen_epoch_summaries_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_epoch_summaries_user" ON "public"."citizen_epoch_summaries" USING "btree" ("user_id", "epoch_no" DESC);


--
-- Name: idx_citizen_impact_scores_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_impact_scores_score" ON "public"."citizen_impact_scores" USING "btree" ("score" DESC);


--
-- Name: idx_citizen_milestones_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_milestones_user" ON "public"."citizen_milestones" USING "btree" ("user_id");


--
-- Name: idx_citizen_proposal_followups_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_proposal_followups_pending" ON "public"."citizen_proposal_followups" USING "btree" ("notified") WHERE ("notified" = false);


--
-- Name: idx_citizen_proposal_followups_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_proposal_followups_proposal" ON "public"."citizen_proposal_followups" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_citizen_proposal_followups_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_proposal_followups_user" ON "public"."citizen_proposal_followups" USING "btree" ("user_id");


--
-- Name: idx_citizen_ring_snapshots_user_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_ring_snapshots_user_epoch" ON "public"."citizen_ring_snapshots" USING "btree" ("user_id", "epoch" DESC);


--
-- Name: idx_citizen_sentiment_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_sentiment_drep" ON "public"."citizen_sentiment" USING "btree" ("delegated_drep_id");


--
-- Name: idx_citizen_sentiment_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_sentiment_proposal" ON "public"."citizen_sentiment" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_citizen_sentiment_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_citizen_sentiment_user" ON "public"."citizen_sentiment" USING "btree" ("user_id");


--
-- Name: idx_concern_flags_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_concern_flags_proposal" ON "public"."citizen_concern_flags" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_concern_flags_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_concern_flags_type" ON "public"."citizen_concern_flags" USING "btree" ("flag_type");


--
-- Name: idx_concern_flags_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_concern_flags_user" ON "public"."citizen_concern_flags" USING "btree" ("user_id");


--
-- Name: idx_draft_reviews_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_draft_reviews_draft" ON "public"."draft_reviews" USING "btree" ("draft_id");


--
-- Name: idx_draft_versions_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_draft_versions_draft" ON "public"."proposal_draft_versions" USING "btree" ("draft_id");


--
-- Name: idx_drep_characters_drep_latest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_characters_drep_latest" ON "public"."drep_characters" USING "btree" ("drep_id", "epoch" DESC);


--
-- Name: idx_drep_characters_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_characters_epoch" ON "public"."drep_characters" USING "btree" ("epoch");


--
-- Name: idx_drep_deleg_snap_drep_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_deleg_snap_drep_epoch" ON "public"."drep_delegator_snapshots" USING "btree" ("drep_id", "epoch_no");


--
-- Name: idx_drep_deleg_snap_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_deleg_snap_epoch" ON "public"."drep_delegator_snapshots" USING "btree" ("epoch_no");


--
-- Name: idx_drep_deleg_snap_stake; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_deleg_snap_stake" ON "public"."drep_delegator_snapshots" USING "btree" ("stake_address");


--
-- Name: idx_drep_epoch_updates_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_epoch_updates_drep" ON "public"."drep_epoch_updates" USING "btree" ("drep_id");


--
-- Name: idx_drep_epoch_updates_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_epoch_updates_epoch" ON "public"."drep_epoch_updates" USING "btree" ("epoch");


--
-- Name: idx_drep_lifecycle_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_lifecycle_action" ON "public"."drep_lifecycle_events" USING "btree" ("action", "epoch_no");


--
-- Name: idx_drep_lifecycle_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_lifecycle_drep" ON "public"."drep_lifecycle_events" USING "btree" ("drep_id", "epoch_no");


--
-- Name: idx_drep_milestones_drep_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_milestones_drep_id" ON "public"."drep_milestones" USING "btree" ("drep_id");


--
-- Name: idx_drep_pca_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_pca_run" ON "public"."drep_pca_coordinates" USING "btree" ("run_id");


--
-- Name: idx_drep_questions_drep_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_questions_drep_id" ON "public"."drep_questions" USING "btree" ("drep_id");


--
-- Name: idx_drep_questions_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_questions_proposal" ON "public"."drep_questions" USING "btree" ("proposal_tx_hash", "proposal_index") WHERE ("proposal_tx_hash" IS NOT NULL);


--
-- Name: idx_drep_questions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_questions_status" ON "public"."drep_questions" USING "btree" ("status");


--
-- Name: idx_drep_responses_question_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_responses_question_id" ON "public"."drep_responses" USING "btree" ("question_id");


--
-- Name: idx_drep_votes_block_time_tx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_block_time_tx" ON "public"."drep_votes" USING "btree" ("block_time" DESC, "vote_tx_hash");


--
-- Name: idx_drep_votes_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_drep" ON "public"."drep_votes" USING "btree" ("drep_id");


--
-- Name: idx_drep_votes_drep_block_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_drep_block_time" ON "public"."drep_votes" USING "btree" ("drep_id", "block_time" DESC);


--
-- Name: idx_drep_votes_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_epoch" ON "public"."drep_votes" USING "btree" ("epoch_no");


--
-- Name: idx_drep_votes_power_not_null; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_power_not_null" ON "public"."drep_votes" USING "btree" ("proposal_tx_hash", "proposal_index") WHERE ("voting_power_lovelace" IS NOT NULL);


--
-- Name: idx_drep_votes_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_proposal" ON "public"."drep_votes" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_drep_votes_proposal_vote; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drep_votes_proposal_vote" ON "public"."drep_votes" USING "btree" ("proposal_tx_hash", "proposal_index", "vote");


--
-- Name: idx_dreps_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_dreps_score" ON "public"."dreps" USING "btree" ("score" DESC);


--
-- Name: idx_dreps_size_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_dreps_size_tier" ON "public"."dreps" USING "btree" ("size_tier");


--
-- Name: idx_dreps_spotlight_narrative_gen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_dreps_spotlight_narrative_gen" ON "public"."dreps" USING "btree" ("spotlight_narrative_generated_at");


--
-- Name: idx_drift_records_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drift_records_drep" ON "public"."alignment_drift_records" USING "btree" ("drep_id");


--
-- Name: idx_drift_records_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_drift_records_user" ON "public"."alignment_drift_records" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_ds_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ds_drep" ON "public"."delegation_snapshots" USING "btree" ("drep_id");


--
-- Name: idx_emb_draft_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_draft_hnsw" ON "public"."embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("entity_type" = 'proposal_draft'::"text");


--
-- Name: idx_emb_drep_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_drep_hnsw" ON "public"."embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("entity_type" = 'drep_profile'::"text");


--
-- Name: idx_emb_entity_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_entity_lookup" ON "public"."embeddings" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_emb_proposal_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_proposal_hnsw" ON "public"."embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("entity_type" = 'proposal'::"text");


--
-- Name: idx_emb_rationale_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_rationale_hnsw" ON "public"."embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("entity_type" = 'rationale'::"text");


--
-- Name: idx_emb_review_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_review_hnsw" ON "public"."embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("entity_type" = 'review_annotation'::"text");


--
-- Name: idx_emb_user_hnsw; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_emb_user_hnsw" ON "public"."embeddings" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("entity_type" = 'user_preference'::"text");


--
-- Name: idx_engagement_agg_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_engagement_agg_entity" ON "public"."engagement_signal_aggregations" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_engagement_agg_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_engagement_agg_epoch" ON "public"."engagement_signal_aggregations" USING "btree" ("epoch");


--
-- Name: idx_engagement_agg_signal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_engagement_agg_signal" ON "public"."engagement_signal_aggregations" USING "btree" ("signal_type");


--
-- Name: idx_engagement_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_engagement_proposal" ON "public"."proposal_engagement_events" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_engagement_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_engagement_type" ON "public"."proposal_engagement_events" USING "btree" ("event_type");


--
-- Name: idx_entity_subs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_entity_subs_entity" ON "public"."user_entity_subscriptions" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_entity_subs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_entity_subs_user" ON "public"."user_entity_subscriptions" USING "btree" ("user_id");


--
-- Name: idx_feedback_themes_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_feedback_themes_proposal" ON "public"."proposal_feedback_themes" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_genealogy_change; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_genealogy_change" ON "public"."amendment_genealogy" USING "btree" ("change_id");


--
-- Name: idx_genealogy_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_genealogy_draft" ON "public"."amendment_genealogy" USING "btree" ("draft_id");


--
-- Name: idx_ghi_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ghi_snapshots_epoch" ON "public"."ghi_snapshots" USING "btree" ("epoch_no" DESC);


--
-- Name: idx_gov_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_gov_events_type" ON "public"."governance_events" USING "btree" ("event_type");


--
-- Name: idx_gov_events_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_gov_events_wallet" ON "public"."governance_events" USING "btree" ("wallet_address", "created_at" DESC);


--
-- Name: idx_governance_events_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_governance_events_user" ON "public"."governance_events" USING "btree" ("user_id");


--
-- Name: idx_governance_events_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_governance_events_user_created" ON "public"."governance_events" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_hub_checkins_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_hub_checkins_user" ON "public"."user_hub_checkins" USING "btree" ("user_stake_address", "epoch" DESC);


--
-- Name: idx_ibas_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ibas_proposal" ON "public"."inter_body_alignment_snapshots" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_impact_tags_awareness; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_impact_tags_awareness" ON "public"."citizen_impact_tags" USING "btree" ("awareness");


--
-- Name: idx_impact_tags_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_impact_tags_proposal" ON "public"."citizen_impact_tags" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_impact_tags_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_impact_tags_rating" ON "public"."citizen_impact_tags" USING "btree" ("rating");


--
-- Name: idx_integrity_snapshots_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_integrity_snapshots_date" ON "public"."integrity_snapshots" USING "btree" ("snapshot_date" DESC);


--
-- Name: idx_interpretation_member_article; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_interpretation_member_article" ON "public"."cc_interpretation_history" USING "btree" ("cc_hot_id", "article");


--
-- Name: idx_matching_topics_enabled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_matching_topics_enabled" ON "public"."matching_topics" USING "btree" ("enabled", "source", "selection_count" DESC);


--
-- Name: idx_metadata_archive_cip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_metadata_archive_cip" ON "public"."metadata_archive" USING "btree" ("cip_standard");


--
-- Name: idx_metadata_archive_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_metadata_archive_entity" ON "public"."metadata_archive" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_metadata_archive_fetched; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_metadata_archive_fetched" ON "public"."metadata_archive" USING "btree" ("fetched_at");


--
-- Name: idx_ncl_periods_epochs; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ncl_periods_epochs" ON "public"."ncl_periods" USING "btree" ("start_epoch", "end_epoch");


--
-- Name: idx_ncl_periods_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ncl_periods_status" ON "public"."ncl_periods" USING "btree" ("status") WHERE ("status" = 'active'::"text");


--
-- Name: idx_notification_log_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_log_sent" ON "public"."notification_log" USING "btree" ("sent_at" DESC);


--
-- Name: idx_notification_log_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_log_user" ON "public"."notification_log" USING "btree" ("user_id");


--
-- Name: idx_notification_log_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_log_wallet" ON "public"."notification_log" USING "btree" ("user_wallet");


--
-- Name: idx_notification_prefs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_prefs_user" ON "public"."notification_preferences" USING "btree" ("user_id");


--
-- Name: idx_notification_prefs_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_notification_prefs_wallet" ON "public"."notification_preferences" USING "btree" ("user_wallet");


--
-- Name: idx_observatory_narratives_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_observatory_narratives_epoch" ON "public"."observatory_narratives" USING "btree" ("epoch" DESC);


--
-- Name: idx_pca_results_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_pca_results_active" ON "public"."pca_results" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_poll_responses_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_poll_responses_drep" ON "public"."poll_responses" USING "btree" ("delegated_drep_id") WHERE ("delegated_drep_id" IS NOT NULL);


--
-- Name: idx_poll_responses_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_poll_responses_proposal" ON "public"."poll_responses" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_poll_responses_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_poll_responses_user" ON "public"."poll_responses" USING "btree" ("user_id");


--
-- Name: idx_poll_responses_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_poll_responses_wallet" ON "public"."poll_responses" USING "btree" ("wallet_address");


--
-- Name: idx_pools_confidence; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pools_confidence" ON "public"."pools" USING "btree" ("confidence") WHERE ("confidence" IS NOT NULL);


--
-- Name: idx_pools_current_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pools_current_tier" ON "public"."pools" USING "btree" ("current_tier") WHERE ("current_tier" IS NOT NULL);


--
-- Name: idx_pools_governance_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pools_governance_score" ON "public"."pools" USING "btree" ("governance_score" DESC NULLS LAST);


--
-- Name: idx_pools_pool_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pools_pool_status" ON "public"."pools" USING "btree" ("pool_status");


--
-- Name: idx_pools_spotlight_narrative_gen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pools_spotlight_narrative_gen" ON "public"."pools" USING "btree" ("spotlight_narrative_generated_at");


--
-- Name: idx_pools_vote_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pools_vote_count" ON "public"."pools" USING "btree" ("vote_count" DESC);


--
-- Name: idx_position_statements_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_position_statements_drep" ON "public"."position_statements" USING "btree" ("drep_id");


--
-- Name: idx_position_statements_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_position_statements_proposal" ON "public"."position_statements" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_position_statements_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_position_statements_unique" ON "public"."position_statements" USING "btree" ("drep_id", "proposal_tx_hash", "proposal_index");


--
-- Name: idx_power_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_power_snapshots_epoch" ON "public"."drep_power_snapshots" USING "btree" ("epoch_no");


--
-- Name: idx_precedent_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_precedent_source" ON "public"."cc_precedent_links" USING "btree" ("source_tx_hash", "source_index");


--
-- Name: idx_precedent_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_precedent_target" ON "public"."cc_precedent_links" USING "btree" ("target_tx_hash", "target_index");


--
-- Name: idx_predictions_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_predictions_proposal" ON "public"."cc_predictive_signals" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_preview_feedback_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preview_feedback_session" ON "public"."preview_feedback" USING "btree" ("session_id");


--
-- Name: idx_preview_invites_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preview_invites_code" ON "public"."preview_invites" USING "btree" ("code");


--
-- Name: idx_preview_sessions_cohort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preview_sessions_cohort" ON "public"."preview_sessions" USING "btree" ("cohort_id");


--
-- Name: idx_preview_sessions_invite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preview_sessions_invite" ON "public"."preview_sessions" USING "btree" ("invite_id");


--
-- Name: idx_preview_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_preview_sessions_user" ON "public"."preview_sessions" USING "btree" ("user_id");


--
-- Name: idx_priority_signals_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_priority_signals_epoch" ON "public"."citizen_priority_signals" USING "btree" ("epoch");


--
-- Name: idx_priority_signals_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_priority_signals_user" ON "public"."citizen_priority_signals" USING "btree" ("user_id");


--
-- Name: idx_profile_views_drep_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profile_views_drep_id" ON "public"."profile_views" USING "btree" ("drep_id");


--
-- Name: idx_profile_views_drep_week; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profile_views_drep_week" ON "public"."profile_views" USING "btree" ("drep_id", "viewed_at" DESC);


--
-- Name: idx_profile_views_viewed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profile_views_viewed_at" ON "public"."profile_views" USING "btree" ("viewed_at");


--
-- Name: idx_proposal_briefs_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_briefs_lookup" ON "public"."proposal_briefs" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_proposal_briefs_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_briefs_updated" ON "public"."proposal_briefs" USING "btree" ("updated_at");


--
-- Name: idx_proposal_drafts_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_drafts_owner" ON "public"."proposal_drafts" USING "btree" ("owner_stake_address");


--
-- Name: idx_proposal_drafts_preview_cohort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_drafts_preview_cohort" ON "public"."proposal_drafts" USING "btree" ("preview_cohort_id") WHERE ("preview_cohort_id" IS NOT NULL);


--
-- Name: idx_proposal_drafts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_drafts_status" ON "public"."proposal_drafts" USING "btree" ("status");


--
-- Name: idx_proposal_drafts_supersedes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_drafts_supersedes" ON "public"."proposal_drafts" USING "btree" ("supersedes_id") WHERE ("supersedes_id" IS NOT NULL);


--
-- Name: idx_proposal_intel_cache_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_intel_cache_proposal" ON "public"."proposal_intelligence_cache" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_proposal_outcomes_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_outcomes_score" ON "public"."proposal_outcomes" USING "btree" ("delivery_score" DESC NULLS LAST);


--
-- Name: idx_proposal_outcomes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_outcomes_status" ON "public"."proposal_outcomes" USING "btree" ("delivery_status");


--
-- Name: idx_proposal_proposers_proposer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_proposers_proposer" ON "public"."proposal_proposers" USING "btree" ("proposer_id");


--
-- Name: idx_proposal_teams_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposal_teams_draft" ON "public"."proposal_teams" USING "btree" ("draft_id");


--
-- Name: idx_proposals_open; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposals_open" ON "public"."proposals" USING "btree" ("block_time" DESC) WHERE (("ratified_epoch" IS NULL) AND ("enacted_epoch" IS NULL) AND ("dropped_epoch" IS NULL) AND ("expired_epoch" IS NULL));


--
-- Name: idx_proposals_proposal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_proposals_proposal_id" ON "public"."proposals" USING "btree" ("proposal_id") WHERE ("proposal_id" IS NOT NULL);


--
-- Name: idx_proposals_proposed_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposals_proposed_epoch" ON "public"."proposals" USING "btree" ("proposed_epoch");


--
-- Name: idx_proposals_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposals_type" ON "public"."proposals" USING "btree" ("proposal_type");


--
-- Name: idx_proposer_aliases_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposer_aliases_name" ON "public"."proposer_aliases" USING "btree" ("alias_name");


--
-- Name: idx_proposer_aliases_proposer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_proposer_aliases_proposer" ON "public"."proposer_aliases" USING "btree" ("proposer_id");


--
-- Name: idx_pvs_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_pvs_proposal" ON "public"."proposal_vote_snapshots" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_rationale_analysis_member; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rationale_analysis_member" ON "public"."cc_rationale_analysis" USING "btree" ("cc_hot_id");


--
-- Name: idx_rationale_analysis_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rationale_analysis_proposal" ON "public"."cc_rationale_analysis" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_rationale_documents_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rationale_documents_drep" ON "public"."rationale_documents" USING "btree" ("drep_id");


--
-- Name: idx_rationale_documents_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_rationale_documents_proposal" ON "public"."rationale_documents" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_reconciliation_log_checked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reconciliation_log_checked" ON "public"."reconciliation_log" USING "btree" ("checked_at" DESC);


--
-- Name: idx_reconciliation_log_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reconciliation_log_status" ON "public"."reconciliation_log" USING "btree" ("overall_status") WHERE ("overall_status" <> 'match'::"text");


--
-- Name: idx_review_responses_review; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_review_responses_review" ON "public"."draft_review_responses" USING "btree" ("review_id");


--
-- Name: idx_review_sessions_voter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_review_sessions_voter" ON "public"."review_sessions" USING "btree" ("voter_id", "started_at" DESC);


--
-- Name: idx_revision_notifications_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_revision_notifications_recipient" ON "public"."proposal_revision_notifications" USING "btree" ("recipient_user_id", "read_at");


--
-- Name: idx_revoked_sessions_revoked_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_revoked_sessions_revoked_at" ON "public"."revoked_sessions" USING "btree" ("revoked_at");


--
-- Name: idx_score_history_drep_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_score_history_drep_id" ON "public"."drep_score_history" USING "btree" ("drep_id");


--
-- Name: idx_score_history_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_score_history_epoch" ON "public"."drep_score_history" USING "btree" ("epoch_no") WHERE ("epoch_no" IS NOT NULL);


--
-- Name: idx_score_history_snapshot_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_score_history_snapshot_date" ON "public"."drep_score_history" USING "btree" ("snapshot_date");


--
-- Name: idx_seneca_summaries_user_recent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_seneca_summaries_user_recent" ON "public"."seneca_conversation_summaries" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_similarity_cache_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_similarity_cache_source" ON "public"."proposal_similarity_cache" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_social_checks_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_social_checks_drep" ON "public"."social_link_checks" USING "btree" ("drep_id");


--
-- Name: idx_social_link_checks_drep_uri; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_social_link_checks_drep_uri" ON "public"."social_link_checks" USING "btree" ("drep_id", "uri");


--
-- Name: idx_spo_alignment_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_alignment_snapshots_epoch" ON "public"."spo_alignment_snapshots" USING "btree" ("epoch_no");


--
-- Name: idx_spo_characters_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_characters_epoch" ON "public"."spo_characters" USING "btree" ("epoch");


--
-- Name: idx_spo_characters_pool_latest; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_characters_pool_latest" ON "public"."spo_characters" USING "btree" ("pool_id", "epoch" DESC);


--
-- Name: idx_spo_power_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_power_epoch" ON "public"."spo_power_snapshots" USING "btree" ("epoch_no");


--
-- Name: idx_spo_power_pool; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_power_pool" ON "public"."spo_power_snapshots" USING "btree" ("pool_id");


--
-- Name: idx_spo_score_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_score_snapshots_epoch" ON "public"."spo_score_snapshots" USING "btree" ("epoch_no");


--
-- Name: idx_spo_sybil_flags_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_sybil_flags_epoch" ON "public"."spo_sybil_flags" USING "btree" ("epoch_no");


--
-- Name: idx_spo_sybil_flags_pools; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_sybil_flags_pools" ON "public"."spo_sybil_flags" USING "btree" ("pool_a", "pool_b");


--
-- Name: idx_spo_votes_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_votes_epoch" ON "public"."spo_votes" USING "btree" ("epoch");


--
-- Name: idx_spo_votes_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_spo_votes_proposal" ON "public"."spo_votes" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_statements_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_statements_entity" ON "public"."position_statements" USING "btree" ("entity_type", "entity_id", "created_at" DESC);


--
-- Name: idx_sync_log_type_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_sync_log_type_time" ON "public"."sync_log" USING "btree" ("sync_type", "started_at" DESC);


--
-- Name: idx_team_approvals_draft; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_team_approvals_draft" ON "public"."proposal_team_approvals" USING "btree" ("draft_id");


--
-- Name: idx_team_invites_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_team_invites_code" ON "public"."proposal_team_invites" USING "btree" ("invite_code");


--
-- Name: idx_team_members_stake; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_team_members_stake" ON "public"."proposal_team_members" USING "btree" ("stake_address");


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_team_members_team" ON "public"."proposal_team_members" USING "btree" ("team_id");


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_team_members_user" ON "public"."proposal_team_members" USING "btree" ("user_id");


--
-- Name: idx_theme_endorsements_theme; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_theme_endorsements_theme" ON "public"."proposal_theme_endorsements" USING "btree" ("theme_id");


--
-- Name: idx_tier_changes_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_tier_changes_created" ON "public"."tier_changes" USING "btree" ("created_at" DESC);


--
-- Name: idx_tier_changes_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_tier_changes_entity" ON "public"."tier_changes" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_treasury_snapshots_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_treasury_snapshots_epoch" ON "public"."treasury_snapshots" USING "btree" ("epoch_no" DESC);


--
-- Name: idx_ugph_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ugph_user" ON "public"."user_governance_profile_history" USING "btree" ("user_id");


--
-- Name: idx_user_channels_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_channels_channel" ON "public"."user_channels" USING "btree" ("channel");


--
-- Name: idx_user_channels_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_channels_user" ON "public"."user_channels" USING "btree" ("user_id");


--
-- Name: idx_user_channels_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_channels_wallet" ON "public"."user_channels" USING "btree" ("user_wallet");


--
-- Name: idx_user_gov_profiles_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_gov_profiles_updated" ON "public"."user_governance_profiles" USING "btree" ("updated_at" DESC);


--
-- Name: idx_user_wallets_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_wallets_user" ON "public"."user_wallets" USING "btree" ("user_id");


--
-- Name: idx_users_claimed_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_users_claimed_drep" ON "public"."users" USING "btree" ("claimed_drep_id");


--
-- Name: idx_vote_explanations_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vote_explanations_drep" ON "public"."vote_explanations" USING "btree" ("drep_id");


--
-- Name: idx_vote_explanations_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vote_explanations_proposal" ON "public"."vote_explanations" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_vote_explanations_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_vote_explanations_unique" ON "public"."vote_explanations" USING "btree" ("drep_id", "proposal_tx_hash", "proposal_index");


--
-- Name: idx_vote_rationales_drep; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vote_rationales_drep" ON "public"."vote_rationales" USING "btree" ("drep_id");


--
-- Name: idx_vote_rationales_fetch_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vote_rationales_fetch_queue" ON "public"."vote_rationales" USING "btree" ("fetch_status", "next_fetch_at") WHERE ("meta_url" IS NOT NULL);


--
-- Name: idx_vote_rationales_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_vote_rationales_proposal" ON "public"."vote_rationales" USING "btree" ("proposal_tx_hash", "proposal_index");


--
-- Name: idx_wrapped_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_wrapped_entity" ON "public"."governance_wrapped" USING "btree" ("entity_type", "entity_id");


--
-- Name: idx_wrapped_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_wrapped_period" ON "public"."governance_wrapped" USING "btree" ("period_type", "period_id");


--
-- Name: notifications_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "notifications_read_idx" ON "public"."notifications" USING "btree" ("user_stake_address", "read") WHERE ("read" = false);


--
-- Name: notifications_user_stake_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "notifications_user_stake_address_idx" ON "public"."notifications" USING "btree" ("user_stake_address");


--
-- Name: uix_ci_snapshots_type_epoch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uix_ci_snapshots_type_epoch" ON "public"."community_intelligence_snapshots" USING "btree" ("snapshot_type", "epoch");


--
-- Name: v_api_key_stats _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."v_api_key_stats" WITH ("security_invoker"='on') AS
 SELECT "k"."id" AS "key_id",
    "k"."key_prefix",
    "k"."name",
    "k"."tier",
    "k"."rate_limit",
    "k"."rate_window",
    "k"."created_at" AS "key_created_at",
    "k"."last_used_at",
    ("count"("l"."id") FILTER (WHERE ("l"."created_at" > ("now"() - '01:00:00'::interval))))::integer AS "requests_last_hour",
    ("count"("l"."id") FILTER (WHERE ("l"."created_at" > ("now"() - '1 day'::interval))))::integer AS "requests_last_day",
    ("count"("l"."id") FILTER (WHERE ("l"."created_at" > ("now"() - '7 days'::interval))))::integer AS "requests_last_7d",
    ("count"("l"."id") FILTER (WHERE (("l"."status_code" >= 500) AND ("l"."created_at" > ("now"() - '1 day'::interval)))))::integer AS "errors_last_day",
    ("count"("l"."id") FILTER (WHERE (("l"."status_code" = 429) AND ("l"."created_at" > ("now"() - '1 day'::interval)))))::integer AS "rate_limits_last_day"
   FROM ("public"."api_keys" "k"
     LEFT JOIN "public"."api_usage_log" "l" ON (("l"."key_id" = "k"."id")))
  WHERE ("k"."revoked_at" IS NULL)
  GROUP BY "k"."id";


--
-- Name: governance_philosophy set_governance_philosophy_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "set_governance_philosophy_updated_at" BEFORE UPDATE ON "public"."governance_philosophy" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: position_statements set_position_statements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "set_position_statements_updated_at" BEFORE UPDATE ON "public"."position_statements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: vote_explanations set_vote_explanations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "set_vote_explanations_updated_at" BEFORE UPDATE ON "public"."vote_explanations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: dreps trg_dreps_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "trg_dreps_updated_at" BEFORE UPDATE ON "public"."dreps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: admin_audit_log admin_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_activity_log ai_activity_log_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_activity_log"
    ADD CONSTRAINT "ai_activity_log_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE SET NULL;


--
-- Name: ai_activity_log ai_activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_activity_log"
    ADD CONSTRAINT "ai_activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: amendment_genealogy amendment_genealogy_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."amendment_genealogy"
    ADD CONSTRAINT "amendment_genealogy_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: amendment_section_sentiment amendment_section_sentiment_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."amendment_section_sentiment"
    ADD CONSTRAINT "amendment_section_sentiment_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: api_usage_log api_usage_log_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."api_usage_log"
    ADD CONSTRAINT "api_usage_log_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id");


--
-- Name: catalyst_campaigns catalyst_campaigns_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_campaigns"
    ADD CONSTRAINT "catalyst_campaigns_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."catalyst_funds"("id");


--
-- Name: catalyst_proposal_team catalyst_proposal_team_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_proposal_team"
    ADD CONSTRAINT "catalyst_proposal_team_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."catalyst_proposals"("id") ON DELETE CASCADE;


--
-- Name: catalyst_proposal_team catalyst_proposal_team_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_proposal_team"
    ADD CONSTRAINT "catalyst_proposal_team_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "public"."catalyst_team_members"("id") ON DELETE CASCADE;


--
-- Name: catalyst_proposals catalyst_proposals_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_proposals"
    ADD CONSTRAINT "catalyst_proposals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."catalyst_campaigns"("id");


--
-- Name: catalyst_proposals catalyst_proposals_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."catalyst_proposals"
    ADD CONSTRAINT "catalyst_proposals_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."catalyst_funds"("id");


--
-- Name: cip108_documents cip108_documents_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cip108_documents"
    ADD CONSTRAINT "cip108_documents_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: citizen_assembly_responses citizen_assembly_responses_assembly_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_assembly_responses"
    ADD CONSTRAINT "citizen_assembly_responses_assembly_id_fkey" FOREIGN KEY ("assembly_id") REFERENCES "public"."citizen_assemblies"("id") ON DELETE CASCADE;


--
-- Name: citizen_assembly_responses citizen_assembly_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_assembly_responses"
    ADD CONSTRAINT "citizen_assembly_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: citizen_concern_flags citizen_concern_flags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_concern_flags"
    ADD CONSTRAINT "citizen_concern_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: citizen_endorsements citizen_endorsements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_endorsements"
    ADD CONSTRAINT "citizen_endorsements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: citizen_impact_scores citizen_impact_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_impact_scores"
    ADD CONSTRAINT "citizen_impact_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: citizen_impact_tags citizen_impact_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_impact_tags"
    ADD CONSTRAINT "citizen_impact_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: citizen_milestones citizen_milestones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_milestones"
    ADD CONSTRAINT "citizen_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: citizen_priority_signals citizen_priority_signals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_priority_signals"
    ADD CONSTRAINT "citizen_priority_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: citizen_proposal_followups citizen_proposal_followups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_proposal_followups"
    ADD CONSTRAINT "citizen_proposal_followups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: citizen_ring_snapshots citizen_ring_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_ring_snapshots"
    ADD CONSTRAINT "citizen_ring_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: citizen_sentiment citizen_sentiment_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."citizen_sentiment"
    ADD CONSTRAINT "citizen_sentiment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: decision_journal_entries decision_journal_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."decision_journal_entries"
    ADD CONSTRAINT "decision_journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: draft_review_responses draft_review_responses_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."draft_review_responses"
    ADD CONSTRAINT "draft_review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."draft_reviews"("id") ON DELETE CASCADE;


--
-- Name: draft_reviews draft_reviews_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."draft_reviews"
    ADD CONSTRAINT "draft_reviews_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: draft_reviews draft_reviews_reviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."draft_reviews"
    ADD CONSTRAINT "draft_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: drep_milestones drep_milestones_drep_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_milestones"
    ADD CONSTRAINT "drep_milestones_drep_id_fkey" FOREIGN KEY ("drep_id") REFERENCES "public"."dreps"("id") ON DELETE CASCADE;


--
-- Name: drep_pca_coordinates drep_pca_coordinates_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_pca_coordinates"
    ADD CONSTRAINT "drep_pca_coordinates_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."pca_results"("run_id") ON DELETE CASCADE;


--
-- Name: drep_questions drep_questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_questions"
    ADD CONSTRAINT "drep_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: drep_responses drep_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."drep_responses"
    ADD CONSTRAINT "drep_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."drep_questions"("id") ON DELETE CASCADE;


--
-- Name: encrypted_api_keys encrypted_api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."encrypted_api_keys"
    ADD CONSTRAINT "encrypted_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: proposal_outcomes fk_proposal; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_outcomes"
    ADD CONSTRAINT "fk_proposal" FOREIGN KEY ("proposal_tx_hash", "proposal_index") REFERENCES "public"."proposals"("tx_hash", "proposal_index") ON DELETE CASCADE;


--
-- Name: governance_briefs governance_briefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_briefs"
    ADD CONSTRAINT "governance_briefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: governance_events governance_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."governance_events"
    ADD CONSTRAINT "governance_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: notification_log notification_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: poll_responses poll_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."poll_responses"
    ADD CONSTRAINT "poll_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: preview_feedback preview_feedback_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_feedback"
    ADD CONSTRAINT "preview_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."preview_sessions"("id") ON DELETE CASCADE;


--
-- Name: preview_invites preview_invites_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_invites"
    ADD CONSTRAINT "preview_invites_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."preview_cohorts"("id") ON DELETE CASCADE;


--
-- Name: preview_sessions preview_sessions_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_sessions"
    ADD CONSTRAINT "preview_sessions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."preview_cohorts"("id") ON DELETE CASCADE;


--
-- Name: preview_sessions preview_sessions_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_sessions"
    ADD CONSTRAINT "preview_sessions_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "public"."preview_invites"("id") ON DELETE CASCADE;


--
-- Name: preview_sessions preview_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."preview_sessions"
    ADD CONSTRAINT "preview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: profile_views profile_views_drep_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_drep_id_fkey" FOREIGN KEY ("drep_id") REFERENCES "public"."dreps"("id") ON DELETE CASCADE;


--
-- Name: proposal_brief_feedback proposal_brief_feedback_brief_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_brief_feedback"
    ADD CONSTRAINT "proposal_brief_feedback_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "public"."proposal_briefs"("id") ON DELETE CASCADE;


--
-- Name: proposal_brief_feedback proposal_brief_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_brief_feedback"
    ADD CONSTRAINT "proposal_brief_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: proposal_draft_versions proposal_draft_versions_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_draft_versions"
    ADD CONSTRAINT "proposal_draft_versions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: proposal_drafts proposal_drafts_preview_cohort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_drafts"
    ADD CONSTRAINT "proposal_drafts_preview_cohort_id_fkey" FOREIGN KEY ("preview_cohort_id") REFERENCES "public"."preview_cohorts"("id") ON DELETE SET NULL;


--
-- Name: proposal_drafts proposal_drafts_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_drafts"
    ADD CONSTRAINT "proposal_drafts_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE SET NULL;


--
-- Name: proposal_notes proposal_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_notes"
    ADD CONSTRAINT "proposal_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: proposal_proposers proposal_proposers_proposer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_proposers"
    ADD CONSTRAINT "proposal_proposers_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "public"."proposers"("id") ON DELETE CASCADE;


--
-- Name: proposal_team_approvals proposal_team_approvals_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_approvals"
    ADD CONSTRAINT "proposal_team_approvals_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: proposal_team_approvals proposal_team_approvals_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_approvals"
    ADD CONSTRAINT "proposal_team_approvals_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "public"."proposal_team_members"("id") ON DELETE CASCADE;


--
-- Name: proposal_team_invites proposal_team_invites_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_invites"
    ADD CONSTRAINT "proposal_team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."proposal_teams"("id") ON DELETE CASCADE;


--
-- Name: proposal_team_members proposal_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_members"
    ADD CONSTRAINT "proposal_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."proposal_teams"("id") ON DELETE CASCADE;


--
-- Name: proposal_team_members proposal_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_team_members"
    ADD CONSTRAINT "proposal_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: proposal_teams proposal_teams_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_teams"
    ADD CONSTRAINT "proposal_teams_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE CASCADE;


--
-- Name: proposal_theme_endorsements proposal_theme_endorsements_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposal_theme_endorsements"
    ADD CONSTRAINT "proposal_theme_endorsements_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."proposal_feedback_themes"("id") ON DELETE CASCADE;


--
-- Name: proposer_aliases proposer_aliases_proposer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."proposer_aliases"
    ADD CONSTRAINT "proposer_aliases_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "public"."proposers"("id") ON DELETE CASCADE;


--
-- Name: research_conversations research_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."research_conversations"
    ADD CONSTRAINT "research_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: revoked_sessions revoked_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."revoked_sessions"
    ADD CONSTRAINT "revoked_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: seneca_conversation_summaries seneca_conversation_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."seneca_conversation_summaries"
    ADD CONSTRAINT "seneca_conversation_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_channels user_channels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_channels"
    ADD CONSTRAINT "user_channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: user_entity_subscriptions user_entity_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_entity_subscriptions"
    ADD CONSTRAINT "user_entity_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: user_governance_profile_history user_governance_profile_history_new_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_governance_profile_history"
    ADD CONSTRAINT "user_governance_profile_history_new_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: user_governance_profiles user_governance_profiles_new_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_governance_profiles"
    ADD CONSTRAINT "user_governance_profiles_new_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: user_wallets user_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_wallets"
    ADD CONSTRAINT "user_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;


--
-- Name: community_intelligence_snapshots Allow anon read on community_intelligence_snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon read on community_intelligence_snapshots" ON "public"."community_intelligence_snapshots" FOR SELECT TO "anon" USING (true);


--
-- Name: governance_reports Allow anon read on governance_reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon read on governance_reports" ON "public"."governance_reports" FOR SELECT TO "anon" USING (true);


--
-- Name: review_sessions Allow owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow owner read" ON "public"."review_sessions" FOR SELECT USING (true);


--
-- Name: reviewer_briefing_cache Allow owner read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow owner read" ON "public"."reviewer_briefing_cache" FOR SELECT USING (true);


--
-- Name: catalyst_campaigns Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."catalyst_campaigns" FOR SELECT USING (true);


--
-- Name: catalyst_funds Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."catalyst_funds" FOR SELECT USING (true);


--
-- Name: catalyst_proposal_team Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."catalyst_proposal_team" FOR SELECT USING (true);


--
-- Name: catalyst_proposals Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."catalyst_proposals" FOR SELECT USING (true);


--
-- Name: catalyst_team_members Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."catalyst_team_members" FOR SELECT USING (true);


--
-- Name: committee_members Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."committee_members" FOR SELECT USING (true);


--
-- Name: drep_delegator_snapshots Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."drep_delegator_snapshots" FOR SELECT USING (true);


--
-- Name: drep_lifecycle_events Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."drep_lifecycle_events" FOR SELECT USING (true);


--
-- Name: epoch_governance_summaries Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."epoch_governance_summaries" FOR SELECT USING (true);


--
-- Name: metadata_archive Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."metadata_archive" FOR SELECT USING (true);


--
-- Name: proposal_intelligence_cache Allow public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read" ON "public"."proposal_intelligence_cache" FOR SELECT USING (true);


--
-- Name: drep_score_history Allow public read access on drep_score_history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access on drep_score_history" ON "public"."drep_score_history" FOR SELECT USING (true);


--
-- Name: profile_views Allow public reads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public reads" ON "public"."profile_views" FOR SELECT USING (true);


--
-- Name: proposal_intelligence_cache Allow service_role write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow service_role write" ON "public"."proposal_intelligence_cache" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: review_sessions Allow service_role write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow service_role write" ON "public"."review_sessions" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: reviewer_briefing_cache Allow service_role write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow service_role write" ON "public"."reviewer_briefing_cache" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: community_intelligence_snapshots Allow service_role write on community_intelligence_snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow service_role write on community_intelligence_snapshots" ON "public"."community_intelligence_snapshots" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: governance_reports Allow service_role write on governance_reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow service_role write on governance_reports" ON "public"."governance_reports" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: citizen_endorsements Anyone can read endorsements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read endorsements" ON "public"."citizen_endorsements" FOR SELECT USING (true);


--
-- Name: proposal_outcomes Anyone can read proposal outcomes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read proposal outcomes" ON "public"."proposal_outcomes" FOR SELECT USING (true);


--
-- Name: drep_questions Anyone can read questions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read questions" ON "public"."drep_questions" FOR SELECT USING (("status" <> 'hidden'::"text"));


--
-- Name: drep_responses Anyone can read responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read responses" ON "public"."drep_responses" FOR SELECT USING (true);


--
-- Name: citizen_endorsements Authenticated users can insert own endorsements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert own endorsements" ON "public"."citizen_endorsements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: drep_epoch_updates Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."drep_epoch_updates" FOR DELETE USING (false);


--
-- Name: governance_epoch_stats Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."governance_epoch_stats" FOR DELETE USING (false);


--
-- Name: notification_preferences Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."notification_preferences" FOR DELETE USING (false);


--
-- Name: rationale_documents Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."rationale_documents" FOR DELETE USING (false);


--
-- Name: snapshot_completeness_log Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."snapshot_completeness_log" FOR DELETE USING (false);


--
-- Name: spo_alignment_snapshots Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."spo_alignment_snapshots" FOR DELETE USING (false);


--
-- Name: spo_score_snapshots Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."spo_score_snapshots" FOR DELETE USING (false);


--
-- Name: user_channels Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."user_channels" FOR DELETE USING (false);


--
-- Name: user_governance_profiles Block anon deletes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon deletes" ON "public"."user_governance_profiles" FOR DELETE USING (false);


--
-- Name: drep_epoch_updates Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."drep_epoch_updates" FOR INSERT WITH CHECK (false);


--
-- Name: governance_epoch_stats Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."governance_epoch_stats" FOR INSERT WITH CHECK (false);


--
-- Name: notification_log Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."notification_log" FOR INSERT WITH CHECK (false);


--
-- Name: notification_preferences Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."notification_preferences" FOR INSERT WITH CHECK (false);


--
-- Name: profile_views Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."profile_views" FOR INSERT WITH CHECK (false);


--
-- Name: rationale_documents Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."rationale_documents" FOR INSERT WITH CHECK (false);


--
-- Name: snapshot_completeness_log Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."snapshot_completeness_log" FOR INSERT WITH CHECK (false);


--
-- Name: spo_alignment_snapshots Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."spo_alignment_snapshots" FOR INSERT WITH CHECK (false);


--
-- Name: spo_score_snapshots Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."spo_score_snapshots" FOR INSERT WITH CHECK (false);


--
-- Name: user_channels Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."user_channels" FOR INSERT WITH CHECK (false);


--
-- Name: user_governance_profiles Block anon inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon inserts" ON "public"."user_governance_profiles" FOR INSERT WITH CHECK (false);


--
-- Name: drep_epoch_updates Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."drep_epoch_updates" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: governance_epoch_stats Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."governance_epoch_stats" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: notification_preferences Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."notification_preferences" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: rationale_documents Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."rationale_documents" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: snapshot_completeness_log Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."snapshot_completeness_log" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: spo_alignment_snapshots Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."spo_alignment_snapshots" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: spo_score_snapshots Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."spo_score_snapshots" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: user_channels Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."user_channels" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: user_governance_profiles Block anon updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Block anon updates" ON "public"."user_governance_profiles" FOR UPDATE USING (false) WITH CHECK (false);


--
-- Name: semantic_similarity_cache Cache publicly readable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cache publicly readable" ON "public"."semantic_similarity_cache" FOR SELECT USING (true);


--
-- Name: semantic_similarity_cache Cache writable by service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Cache writable by service" ON "public"."semantic_similarity_cache" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: embeddings Embeddings publicly readable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Embeddings publicly readable" ON "public"."embeddings" FOR SELECT USING (true);


--
-- Name: embeddings Embeddings writable by service; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Embeddings writable by service" ON "public"."embeddings" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: dreps Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON "public"."dreps" FOR SELECT TO "anon" USING (true);


--
-- Name: cc_members Public can read cc_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read cc_members" ON "public"."cc_members" FOR SELECT USING (true);


--
-- Name: cc_rationales Public can read cc_rationales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read cc_rationales" ON "public"."cc_rationales" FOR SELECT USING (true);


--
-- Name: cc_fidelity_snapshots Public can read cc_transparency_snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read cc_transparency_snapshots" ON "public"."cc_fidelity_snapshots" FOR SELECT USING (true);


--
-- Name: ai_health_metrics Public read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read" ON "public"."ai_health_metrics" FOR SELECT USING (true);


--
-- Name: drep_epoch_updates Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."drep_epoch_updates" FOR SELECT USING (true);


--
-- Name: drep_power_snapshots Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."drep_power_snapshots" FOR SELECT USING (true);


--
-- Name: drep_votes Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."drep_votes" FOR SELECT USING (true);


--
-- Name: governance_epoch_stats Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."governance_epoch_stats" FOR SELECT USING (true);


--
-- Name: governance_philosophy Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."governance_philosophy" FOR SELECT USING (true);


--
-- Name: integrity_snapshots Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."integrity_snapshots" FOR SELECT USING (true);


--
-- Name: poll_responses Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."poll_responses" FOR SELECT USING (true);


--
-- Name: position_statements Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."position_statements" FOR SELECT USING (true);


--
-- Name: proposal_voting_summary Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."proposal_voting_summary" FOR SELECT USING (true);


--
-- Name: proposals Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."proposals" FOR SELECT USING (true);


--
-- Name: rationale_documents Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."rationale_documents" FOR SELECT USING (true);


--
-- Name: snapshot_completeness_log Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."snapshot_completeness_log" FOR SELECT USING (true);


--
-- Name: social_link_checks Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."social_link_checks" FOR SELECT USING (true);


--
-- Name: spo_alignment_snapshots Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."spo_alignment_snapshots" FOR SELECT USING (true);


--
-- Name: spo_score_snapshots Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."spo_score_snapshots" FOR SELECT USING (true);


--
-- Name: sync_log Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."sync_log" FOR SELECT USING (true);


--
-- Name: treasury_accountability_polls Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."treasury_accountability_polls" FOR SELECT USING (true);


--
-- Name: treasury_accountability_responses Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."treasury_accountability_responses" FOR SELECT USING (true);


--
-- Name: treasury_snapshots Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."treasury_snapshots" FOR SELECT USING (true);


--
-- Name: user_governance_profiles Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."user_governance_profiles" FOR SELECT USING (true);


--
-- Name: users Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."users" FOR SELECT USING (true);


--
-- Name: vote_explanations Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."vote_explanations" FOR SELECT USING (true);


--
-- Name: vote_rationales Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."vote_rationales" FOR SELECT USING (true);


--
-- Name: scoring_methodology_changelog Public read access to methodology changelog; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access to methodology changelog" ON "public"."scoring_methodology_changelog" FOR SELECT USING (true);


--
-- Name: cc_agreement_matrix Public read cc_agreement_matrix; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_agreement_matrix" ON "public"."cc_agreement_matrix" FOR SELECT USING (true);


--
-- Name: cc_bloc_assignments Public read cc_bloc_assignments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_bloc_assignments" ON "public"."cc_bloc_assignments" FOR SELECT USING (true);


--
-- Name: cc_intelligence_briefs Public read cc_intelligence_briefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_intelligence_briefs" ON "public"."cc_intelligence_briefs" FOR SELECT USING (true);


--
-- Name: cc_interpretation_history Public read cc_interpretation_history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_interpretation_history" ON "public"."cc_interpretation_history" FOR SELECT USING (true);


--
-- Name: cc_member_archetypes Public read cc_member_archetypes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_member_archetypes" ON "public"."cc_member_archetypes" FOR SELECT USING (true);


--
-- Name: cc_precedent_links Public read cc_precedent_links; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_precedent_links" ON "public"."cc_precedent_links" FOR SELECT USING (true);


--
-- Name: cc_predictive_signals Public read cc_predictive_signals; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_predictive_signals" ON "public"."cc_predictive_signals" FOR SELECT USING (true);


--
-- Name: cc_rationale_analysis Public read cc_rationale_analysis; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read cc_rationale_analysis" ON "public"."cc_rationale_analysis" FOR SELECT USING (true);


--
-- Name: observatory_narratives Public read observatory narratives; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read observatory narratives" ON "public"."observatory_narratives" FOR SELECT USING (true);


--
-- Name: pools Public read pools; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read pools" ON "public"."pools" FOR SELECT USING (true);


--
-- Name: proposal_proposers Public read proposal_proposers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read proposal_proposers" ON "public"."proposal_proposers" FOR SELECT USING (true);


--
-- Name: proposer_aliases Public read proposer_aliases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read proposer_aliases" ON "public"."proposer_aliases" FOR SELECT USING (true);


--
-- Name: proposers Public read proposers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read proposers" ON "public"."proposers" FOR SELECT USING (true);


--
-- Name: spo_sybil_flags Public read sybil flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read sybil flags" ON "public"."spo_sybil_flags" FOR SELECT USING (true);


--
-- Name: tier_changes Public read tier_changes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read tier_changes" ON "public"."tier_changes" FOR SELECT USING (true);


--
-- Name: citizen_ring_snapshots Service role can insert ring snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can insert ring snapshots" ON "public"."citizen_ring_snapshots" FOR INSERT WITH CHECK (true);


--
-- Name: proposal_outcomes Service role can manage proposal outcomes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage proposal outcomes" ON "public"."proposal_outcomes" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: citizen_ring_snapshots Service role can update ring snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can update ring snapshots" ON "public"."citizen_ring_snapshots" FOR UPDATE USING (true);


--
-- Name: cc_members Service role can write cc_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can write cc_members" ON "public"."cc_members" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: cc_rationales Service role can write cc_rationales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can write cc_rationales" ON "public"."cc_rationales" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: cc_fidelity_snapshots Service role can write cc_transparency_snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can write cc_transparency_snapshots" ON "public"."cc_fidelity_snapshots" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: ai_health_metrics Service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access" ON "public"."ai_health_metrics" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: citizen_epoch_summaries Service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access" ON "public"."citizen_epoch_summaries" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: citizen_proposal_followups Service role full access to citizen proposal followups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access to citizen proposal followups" ON "public"."citizen_proposal_followups" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: user_entity_subscriptions Service role full access to entity subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access to entity subscriptions" ON "public"."user_entity_subscriptions" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: user_notification_preferences Service role full access to notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access to notification preferences" ON "public"."user_notification_preferences" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: citizen_milestones Service role inserts milestones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role inserts milestones" ON "public"."citizen_milestones" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: api_keys Service role only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only" ON "public"."api_keys" FOR SELECT USING (false);


--
-- Name: api_usage_log Service role only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only" ON "public"."api_usage_log" FOR SELECT USING (false);


--
-- Name: drep_milestones Service role only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only" ON "public"."drep_milestones" FOR INSERT WITH CHECK (false);


--
-- Name: governance_philosophy Service role only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only" ON "public"."governance_philosophy" FOR INSERT WITH CHECK (false);


--
-- Name: position_statements Service role only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only" ON "public"."position_statements" FOR INSERT WITH CHECK (false);


--
-- Name: vote_explanations Service role only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only" ON "public"."vote_explanations" FOR INSERT WITH CHECK (false);


--
-- Name: drep_milestones Service role only delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only delete" ON "public"."drep_milestones" FOR DELETE USING (false);


--
-- Name: governance_philosophy Service role only delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only delete" ON "public"."governance_philosophy" FOR DELETE USING (false);


--
-- Name: position_statements Service role only delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only delete" ON "public"."position_statements" FOR DELETE USING (false);


--
-- Name: vote_explanations Service role only delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only delete" ON "public"."vote_explanations" FOR DELETE USING (false);


--
-- Name: drep_milestones Service role only update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only update" ON "public"."drep_milestones" FOR UPDATE USING (false);


--
-- Name: governance_philosophy Service role only update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only update" ON "public"."governance_philosophy" FOR UPDATE USING (false);


--
-- Name: position_statements Service role only update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only update" ON "public"."position_statements" FOR UPDATE USING (false);


--
-- Name: vote_explanations Service role only update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role only update" ON "public"."vote_explanations" FOR UPDATE USING (false);


--
-- Name: alignment_drift_records Service write drift records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write drift records" ON "public"."alignment_drift_records" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: pools Service write pools; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write pools" ON "public"."pools" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_proposers Service write proposal_proposers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write proposal_proposers" ON "public"."proposal_proposers" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposer_aliases Service write proposer_aliases; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write proposer_aliases" ON "public"."proposer_aliases" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposers Service write proposers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write proposers" ON "public"."proposers" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: spo_sybil_flags Service write sybil flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write sybil flags" ON "public"."spo_sybil_flags" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: tier_changes Service write tier_changes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service write tier_changes" ON "public"."tier_changes" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: citizen_endorsements Users can delete own endorsements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own endorsements" ON "public"."citizen_endorsements" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: user_entity_subscriptions Users can delete own entity subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own entity subscriptions" ON "public"."user_entity_subscriptions" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: user_entity_subscriptions Users can insert own entity subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own entity subscriptions" ON "public"."user_entity_subscriptions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_notification_preferences Users can insert own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own notification preferences" ON "public"."user_notification_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: governance_passport Users can insert own passport; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own passport" ON "public"."governance_passport" FOR INSERT WITH CHECK (("stake_address" = "current_setting"('app.stake_address'::"text", true)));


--
-- Name: seneca_conversation_summaries Users can insert own summaries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own summaries" ON "public"."seneca_conversation_summaries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: user_channels Users can read own channels; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own channels" ON "public"."user_channels" FOR SELECT USING (true);


--
-- Name: user_entity_subscriptions Users can read own entity subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own entity subscriptions" ON "public"."user_entity_subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: citizen_impact_scores Users can read own impact score; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own impact score" ON "public"."citizen_impact_scores" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: notification_log Users can read own log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own log" ON "public"."notification_log" FOR SELECT USING (true);


--
-- Name: user_notification_preferences Users can read own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own notification preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: governance_passport Users can read own passport; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own passport" ON "public"."governance_passport" FOR SELECT USING (("stake_address" = "current_setting"('app.stake_address'::"text", true)));


--
-- Name: notification_preferences Users can read own prefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own prefs" ON "public"."notification_preferences" FOR SELECT USING (true);


--
-- Name: citizen_proposal_followups Users can read own proposal followups; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own proposal followups" ON "public"."citizen_proposal_followups" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: citizen_ring_snapshots Users can read own ring snapshots; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own ring snapshots" ON "public"."citizen_ring_snapshots" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: seneca_conversation_summaries Users can read own summaries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own summaries" ON "public"."seneca_conversation_summaries" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: user_hub_checkins Users can read their own check-ins; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read their own check-ins" ON "public"."user_hub_checkins" FOR SELECT USING (true);


--
-- Name: user_notification_preferences Users can update own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own notification preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));


--
-- Name: governance_passport Users can update own passport; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own passport" ON "public"."governance_passport" FOR UPDATE USING (("stake_address" = "current_setting"('app.stake_address'::"text", true)));


--
-- Name: alignment_drift_records Users read own drift records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own drift records" ON "public"."alignment_drift_records" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: citizen_milestones Users read own milestones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own milestones" ON "public"."citizen_milestones" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."agent_conversations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_activity_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_activity_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_activity_log ai_activity_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_activity_public_read" ON "public"."ai_activity_log" FOR SELECT USING (true);


--
-- Name: ai_activity_log ai_activity_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_activity_service_write" ON "public"."ai_activity_log" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: ai_health_metrics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_health_metrics" ENABLE ROW LEVEL SECURITY;

--
-- Name: alignment_drift_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."alignment_drift_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: alignment_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."alignment_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: alignment_snapshots alignment_snapshots_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "alignment_snapshots_read" ON "public"."alignment_snapshots" FOR SELECT USING (true);


--
-- Name: amendment_genealogy; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."amendment_genealogy" ENABLE ROW LEVEL SECURITY;

--
-- Name: amendment_section_sentiment; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."amendment_section_sentiment" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_annotations annotations_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "annotations_public_read" ON "public"."proposal_annotations" FOR SELECT USING (true);


--
-- Name: proposal_annotations annotations_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "annotations_service_write" ON "public"."proposal_annotations" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;

--
-- Name: api_usage_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."api_usage_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_assemblies assemblies_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "assemblies_select" ON "public"."citizen_assemblies" FOR SELECT USING (true);


--
-- Name: citizen_assembly_responses assembly_responses_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "assembly_responses_insert" ON "public"."citizen_assembly_responses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: citizen_assembly_responses assembly_responses_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "assembly_responses_select" ON "public"."citizen_assembly_responses" FOR SELECT USING (true);


--
-- Name: proposal_brief_feedback brief_feedback_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "brief_feedback_public_read" ON "public"."proposal_brief_feedback" FOR SELECT USING (true);


--
-- Name: proposal_brief_feedback brief_feedback_user_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "brief_feedback_user_insert" ON "public"."proposal_brief_feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: proposal_brief_feedback brief_feedback_user_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "brief_feedback_user_update" ON "public"."proposal_brief_feedback" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: catalyst_campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."catalyst_campaigns" ENABLE ROW LEVEL SECURITY;

--
-- Name: catalyst_funds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."catalyst_funds" ENABLE ROW LEVEL SECURITY;

--
-- Name: catalyst_proposal_team; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."catalyst_proposal_team" ENABLE ROW LEVEL SECURITY;

--
-- Name: catalyst_proposals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."catalyst_proposals" ENABLE ROW LEVEL SECURITY;

--
-- Name: catalyst_team_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."catalyst_team_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_agreement_matrix; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_agreement_matrix" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_bloc_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_bloc_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_fidelity_proposal_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_fidelity_proposal_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_fidelity_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_fidelity_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_intelligence_briefs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_intelligence_briefs" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_interpretation_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_interpretation_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_member_archetypes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_member_archetypes" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_precedent_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_precedent_links" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_predictive_signals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_predictive_signals" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_rationale_analysis; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_rationale_analysis" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_rationales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_rationales" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cc_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: cc_votes cc_votes_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cc_votes_public_read" ON "public"."cc_votes" FOR SELECT USING (true);


--
-- Name: cc_votes cc_votes_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cc_votes_service_delete" ON "public"."cc_votes" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: cc_votes cc_votes_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cc_votes_service_update" ON "public"."cc_votes" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: cc_votes cc_votes_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cc_votes_service_write" ON "public"."cc_votes" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: classification_history ch_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ch_public_read" ON "public"."classification_history" FOR SELECT USING (true);


--
-- Name: classification_history ch_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ch_service_insert" ON "public"."classification_history" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: cip108_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cip108_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: cip108_documents cip108_documents_insert_owner; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cip108_documents_insert_owner" ON "public"."cip108_documents" FOR INSERT WITH CHECK (("owner_stake_address" = (("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'walletAddress'::"text")));


--
-- Name: cip108_documents cip108_documents_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "cip108_documents_select_all" ON "public"."cip108_documents" FOR SELECT USING (true);


--
-- Name: citizen_assemblies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_assemblies" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_assembly_responses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_assembly_responses" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_concern_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_concern_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_endorsements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_endorsements" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_epoch_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_epoch_summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_impact_scores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_impact_scores" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_impact_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_impact_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_milestones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_milestones" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_priority_rankings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_priority_rankings" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_priority_signals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_priority_signals" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_proposal_followups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_proposal_followups" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_ring_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_ring_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_sentiment; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."citizen_sentiment" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_sentiment citizen_sentiment_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "citizen_sentiment_insert" ON "public"."citizen_sentiment" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: citizen_sentiment citizen_sentiment_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "citizen_sentiment_select" ON "public"."citizen_sentiment" FOR SELECT USING (true);


--
-- Name: citizen_sentiment citizen_sentiment_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "citizen_sentiment_update" ON "public"."citizen_sentiment" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: classification_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."classification_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: committee_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."committee_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: community_intelligence_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."community_intelligence_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_concern_flags concern_flags_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "concern_flags_delete" ON "public"."citizen_concern_flags" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: citizen_concern_flags concern_flags_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "concern_flags_insert" ON "public"."citizen_concern_flags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: citizen_concern_flags concern_flags_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "concern_flags_select" ON "public"."citizen_concern_flags" FOR SELECT USING (true);


--
-- Name: decentralization_snapshots decentral_snapshots_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "decentral_snapshots_public_read" ON "public"."decentralization_snapshots" FOR SELECT USING (true);


--
-- Name: decentralization_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."decentralization_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: decision_journal_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."decision_journal_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: delegation_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."delegation_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_review_responses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."draft_review_responses" ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."draft_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_reviews draft_reviews_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "draft_reviews_public_read" ON "public"."draft_reviews" FOR SELECT USING (true);


--
-- Name: draft_reviews draft_reviews_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "draft_reviews_service_write" ON "public"."draft_reviews" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_draft_versions draft_versions_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "draft_versions_public_read" ON "public"."proposal_draft_versions" FOR SELECT USING (true);


--
-- Name: proposal_draft_versions draft_versions_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "draft_versions_service_write" ON "public"."proposal_draft_versions" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: drep_characters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_characters" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_characters drep_characters_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drep_characters_public_read" ON "public"."drep_characters" FOR SELECT USING (true);


--
-- Name: drep_delegator_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_delegator_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_epoch_updates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_epoch_updates" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_lifecycle_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_lifecycle_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_milestones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_milestones" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_pca_coordinates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_pca_coordinates" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_pca_coordinates drep_pca_coordinates_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "drep_pca_coordinates_read" ON "public"."drep_pca_coordinates" FOR SELECT USING (true);


--
-- Name: drep_power_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_power_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_questions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_questions" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_responses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_responses" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_score_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_score_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."drep_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: dreps; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."dreps" ENABLE ROW LEVEL SECURITY;

--
-- Name: delegation_snapshots ds_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ds_public_read" ON "public"."delegation_snapshots" FOR SELECT USING (true);


--
-- Name: delegation_snapshots ds_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ds_service_insert" ON "public"."delegation_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: embeddings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."embeddings" ENABLE ROW LEVEL SECURITY;

--
-- Name: encrypted_api_keys; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."encrypted_api_keys" ENABLE ROW LEVEL SECURITY;

--
-- Name: encrypted_api_keys encrypted_api_keys_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "encrypted_api_keys_service_write" ON "public"."encrypted_api_keys" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: encrypted_api_keys encrypted_api_keys_user_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "encrypted_api_keys_user_read" ON "public"."encrypted_api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: engagement_signal_aggregations engagement_agg_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "engagement_agg_select" ON "public"."engagement_signal_aggregations" FOR SELECT USING (true);


--
-- Name: proposal_engagement_events engagement_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "engagement_public_read" ON "public"."proposal_engagement_events" FOR SELECT USING (true);


--
-- Name: proposal_engagement_events engagement_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "engagement_service_write" ON "public"."proposal_engagement_events" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: engagement_signal_aggregations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."engagement_signal_aggregations" ENABLE ROW LEVEL SECURITY;

--
-- Name: epoch_governance_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."epoch_governance_summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: epoch_recaps; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."epoch_recaps" ENABLE ROW LEVEL SECURITY;

--
-- Name: epoch_recaps epoch_recaps_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "epoch_recaps_public_read" ON "public"."epoch_recaps" FOR SELECT USING (true);


--
-- Name: epoch_recaps epoch_recaps_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "epoch_recaps_service_delete" ON "public"."epoch_recaps" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: epoch_recaps epoch_recaps_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "epoch_recaps_service_update" ON "public"."epoch_recaps" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: epoch_recaps epoch_recaps_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "epoch_recaps_service_write" ON "public"."epoch_recaps" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_epoch_stats ges_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ges_public_read" ON "public"."governance_epoch_stats" FOR SELECT USING (true);


--
-- Name: governance_epoch_stats ges_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ges_service_insert" ON "public"."governance_epoch_stats" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: governance_epoch_stats ges_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ges_service_update" ON "public"."governance_epoch_stats" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: ghi_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ghi_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: ghi_snapshots ghi_snapshots_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ghi_snapshots_public_read" ON "public"."ghi_snapshots" FOR SELECT USING (true);


--
-- Name: governance_benchmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_benchmarks" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_briefs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_briefs" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_epoch_stats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_epoch_stats" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_events governance_events_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "governance_events_own_read" ON "public"."governance_events" FOR SELECT USING (("wallet_address" = ((( SELECT "current_setting"('request.jwt.claims'::"text", true) AS "current_setting"))::"jsonb" ->> 'wallet_address'::"text")));


--
-- Name: governance_events governance_events_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "governance_events_service_insert" ON "public"."governance_events" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: governance_participation_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_participation_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_passport; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_passport" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_philosophy; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_philosophy" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_stats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_stats" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_stats governance_stats_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "governance_stats_public_read" ON "public"."governance_stats" FOR SELECT USING (true);


--
-- Name: governance_wrapped; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."governance_wrapped" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_participation_snapshots gps_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gps_public_read" ON "public"."governance_participation_snapshots" FOR SELECT USING (true);


--
-- Name: governance_participation_snapshots gps_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "gps_service_insert" ON "public"."governance_participation_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: inter_body_alignment_snapshots ibas_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ibas_public_read" ON "public"."inter_body_alignment_snapshots" FOR SELECT USING (true);


--
-- Name: inter_body_alignment_snapshots ibas_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ibas_service_insert" ON "public"."inter_body_alignment_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: citizen_impact_tags impact_tags_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "impact_tags_insert" ON "public"."citizen_impact_tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: citizen_impact_tags impact_tags_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "impact_tags_select" ON "public"."citizen_impact_tags" FOR SELECT USING (true);


--
-- Name: citizen_impact_tags impact_tags_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "impact_tags_update" ON "public"."citizen_impact_tags" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: integrity_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."integrity_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: inter_body_alignment; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."inter_body_alignment" ENABLE ROW LEVEL SECURITY;

--
-- Name: inter_body_alignment inter_body_alignment_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inter_body_alignment_public_read" ON "public"."inter_body_alignment" FOR SELECT USING (true);


--
-- Name: inter_body_alignment inter_body_alignment_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inter_body_alignment_service_delete" ON "public"."inter_body_alignment" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: inter_body_alignment inter_body_alignment_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inter_body_alignment_service_update" ON "public"."inter_body_alignment" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: inter_body_alignment inter_body_alignment_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inter_body_alignment_service_write" ON "public"."inter_body_alignment" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: inter_body_alignment_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."inter_body_alignment_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: decision_journal_entries journal_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "journal_service_write" ON "public"."decision_journal_entries" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: decision_journal_entries journal_user_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "journal_user_read" ON "public"."decision_journal_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: matching_topics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."matching_topics" ENABLE ROW LEVEL SECURITY;

--
-- Name: matching_topics matching_topics_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "matching_topics_public_read" ON "public"."matching_topics" FOR SELECT USING (true);


--
-- Name: matching_topics matching_topics_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "matching_topics_service_write" ON "public"."matching_topics" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: metadata_archive; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."metadata_archive" ENABLE ROW LEVEL SECURITY;

--
-- Name: ncl_periods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ncl_periods" ENABLE ROW LEVEL SECURITY;

--
-- Name: ncl_periods ncl_periods_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ncl_periods_read" ON "public"."ncl_periods" FOR SELECT USING (true);


--
-- Name: notification_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("user_stake_address" = "current_setting"('app.stake_address'::"text", true)));


--
-- Name: observatory_narratives; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."observatory_narratives" ENABLE ROW LEVEL SECURITY;

--
-- Name: pca_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pca_results" ENABLE ROW LEVEL SECURITY;

--
-- Name: pca_results pca_results_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pca_results_read" ON "public"."pca_results" FOR SELECT USING (true);


--
-- Name: perspective_clusters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."perspective_clusters" ENABLE ROW LEVEL SECURITY;

--
-- Name: perspective_clusters perspectives_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "perspectives_public_read" ON "public"."perspective_clusters" FOR SELECT USING (true);


--
-- Name: perspective_clusters perspectives_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "perspectives_service_write" ON "public"."perspective_clusters" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: poll_responses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."poll_responses" ENABLE ROW LEVEL SECURITY;

--
-- Name: pools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."pools" ENABLE ROW LEVEL SECURITY;

--
-- Name: position_statements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."position_statements" ENABLE ROW LEVEL SECURITY;

--
-- Name: preview_cohorts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."preview_cohorts" ENABLE ROW LEVEL SECURITY;

--
-- Name: preview_feedback; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."preview_feedback" ENABLE ROW LEVEL SECURITY;

--
-- Name: preview_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."preview_invites" ENABLE ROW LEVEL SECURITY;

--
-- Name: preview_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."preview_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: citizen_priority_rankings priority_rankings_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "priority_rankings_select" ON "public"."citizen_priority_rankings" FOR SELECT USING (true);


--
-- Name: citizen_priority_signals priority_signals_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "priority_signals_insert" ON "public"."citizen_priority_signals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: citizen_priority_signals priority_signals_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "priority_signals_select" ON "public"."citizen_priority_signals" FOR SELECT USING (true);


--
-- Name: citizen_priority_signals priority_signals_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "priority_signals_update" ON "public"."citizen_priority_signals" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: profile_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profile_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_annotations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_annotations" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_brief_feedback; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_brief_feedback" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_briefs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_briefs" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_briefs proposal_briefs_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_briefs_public_read" ON "public"."proposal_briefs" FOR SELECT USING (true);


--
-- Name: proposal_briefs proposal_briefs_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_briefs_service_write" ON "public"."proposal_briefs" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_classifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_classifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_classifications proposal_classifications_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_classifications_read" ON "public"."proposal_classifications" FOR SELECT USING (true);


--
-- Name: proposal_draft_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_draft_versions" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_drafts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_drafts" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_drafts proposal_drafts_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_drafts_public_read" ON "public"."proposal_drafts" FOR SELECT USING (true);


--
-- Name: proposal_drafts proposal_drafts_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_drafts_service_write" ON "public"."proposal_drafts" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_engagement_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_engagement_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_feedback_themes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_feedback_themes" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_intelligence_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_intelligence_cache" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_notes proposal_notes_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_notes_service_write" ON "public"."proposal_notes" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_notes proposal_notes_user_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_notes_user_read" ON "public"."proposal_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: proposal_outcomes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_outcomes" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_proposers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_proposers" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_revision_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_revision_notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_similarity_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_similarity_cache" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_similarity_cache proposal_similarity_cache_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_similarity_cache_public_read" ON "public"."proposal_similarity_cache" FOR SELECT USING (true);


--
-- Name: proposal_similarity_cache proposal_similarity_cache_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_similarity_cache_service_delete" ON "public"."proposal_similarity_cache" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: proposal_similarity_cache proposal_similarity_cache_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_similarity_cache_service_update" ON "public"."proposal_similarity_cache" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: proposal_similarity_cache proposal_similarity_cache_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_similarity_cache_service_write" ON "public"."proposal_similarity_cache" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: proposal_team_approvals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_team_approvals" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_team_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_team_invites" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_team_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_team_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_teams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_teams" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_teams proposal_teams_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_teams_public_read" ON "public"."proposal_teams" FOR SELECT USING (true);


--
-- Name: proposal_teams proposal_teams_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "proposal_teams_service_write" ON "public"."proposal_teams" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_theme_endorsements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_theme_endorsements" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_vote_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_vote_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposal_voting_summary; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposal_voting_summary" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposer_aliases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposer_aliases" ENABLE ROW LEVEL SECURITY;

--
-- Name: proposers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."proposers" ENABLE ROW LEVEL SECURITY;

--
-- Name: drep_milestones public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_read" ON "public"."drep_milestones" FOR SELECT USING (true);


--
-- Name: governance_wrapped public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_read" ON "public"."governance_wrapped" FOR SELECT USING (true);


--
-- Name: proposal_feedback_themes public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_read" ON "public"."proposal_feedback_themes" FOR SELECT USING (true);


--
-- Name: governance_benchmarks public_read_benchmarks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_read_benchmarks" ON "public"."governance_benchmarks" FOR SELECT USING (true);


--
-- Name: feature_flags public_read_flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_read_flags" ON "public"."feature_flags" FOR SELECT USING (true);


--
-- Name: proposal_vote_snapshots pvs_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pvs_public_read" ON "public"."proposal_vote_snapshots" FOR SELECT USING (true);


--
-- Name: proposal_vote_snapshots pvs_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pvs_service_insert" ON "public"."proposal_vote_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: rationale_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."rationale_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: amendment_genealogy read_genealogy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "read_genealogy" ON "public"."amendment_genealogy" FOR SELECT USING (true);


--
-- Name: amendment_section_sentiment read_sentiment; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "read_sentiment" ON "public"."amendment_section_sentiment" FOR SELECT USING (true);


--
-- Name: reconciliation_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reconciliation_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_log reconciliation_log_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reconciliation_log_read" ON "public"."reconciliation_log" FOR SELECT USING (true);


--
-- Name: reconciliation_log reconciliation_log_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "reconciliation_log_service_write" ON "public"."reconciliation_log" FOR INSERT WITH CHECK (true);


--
-- Name: research_conversations research_conv_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "research_conv_service_write" ON "public"."research_conversations" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: research_conversations research_conv_user_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "research_conv_user_read" ON "public"."research_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: research_conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."research_conversations" ENABLE ROW LEVEL SECURITY;

--
-- Name: review_framework_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."review_framework_templates" ENABLE ROW LEVEL SECURITY;

--
-- Name: draft_review_responses review_responses_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "review_responses_public_read" ON "public"."draft_review_responses" FOR SELECT USING (true);


--
-- Name: draft_review_responses review_responses_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "review_responses_service_write" ON "public"."draft_review_responses" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: review_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."review_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: reviewer_briefing_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reviewer_briefing_cache" ENABLE ROW LEVEL SECURITY;

--
-- Name: revoked_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."revoked_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_alignment_snapshots sas_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sas_public_read" ON "public"."spo_alignment_snapshots" FOR SELECT USING (true);


--
-- Name: spo_alignment_snapshots sas_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sas_service_insert" ON "public"."spo_alignment_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: spo_alignment_snapshots sas_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sas_service_update" ON "public"."spo_alignment_snapshots" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: snapshot_completeness_log scl_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scl_public_read" ON "public"."snapshot_completeness_log" FOR SELECT USING (true);


--
-- Name: snapshot_completeness_log scl_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "scl_service_insert" ON "public"."snapshot_completeness_log" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: scoring_methodology_changelog; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."scoring_methodology_changelog" ENABLE ROW LEVEL SECURITY;

--
-- Name: semantic_similarity_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."semantic_similarity_cache" ENABLE ROW LEVEL SECURITY;

--
-- Name: seneca_conversation_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."seneca_conversation_summaries" ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_benchmarks service_role_delete_benchmarks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_delete_benchmarks" ON "public"."governance_benchmarks" FOR DELETE USING ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: governance_briefs service_role_delete_briefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_delete_briefs" ON "public"."governance_briefs" FOR DELETE USING ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: feature_flags service_role_delete_flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_delete_flags" ON "public"."feature_flags" FOR DELETE USING ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: amendment_genealogy service_role_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_insert" ON "public"."amendment_genealogy" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: amendment_section_sentiment service_role_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_insert" ON "public"."amendment_section_sentiment" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: user_hub_checkins service_role_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_insert" ON "public"."user_hub_checkins" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: drep_questions service_role_insert_questions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_insert_questions" ON "public"."drep_questions" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: drep_responses service_role_insert_responses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_insert_responses" ON "public"."drep_responses" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: admin_audit_log service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."admin_audit_log" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: agent_conversations service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."agent_conversations" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: cc_fidelity_proposal_snapshots service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."cc_fidelity_proposal_snapshots" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: preview_cohorts service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."preview_cohorts" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: preview_feedback service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."preview_feedback" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: preview_invites service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."preview_invites" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: preview_sessions service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."preview_sessions" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_revision_notifications service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."proposal_revision_notifications" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_team_approvals service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."proposal_team_approvals" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_theme_endorsements service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."proposal_theme_endorsements" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: revoked_sessions service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."revoked_sessions" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: spo_power_snapshots service_role_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_only" ON "public"."spo_power_snapshots" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: amendment_section_sentiment service_role_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update" ON "public"."amendment_section_sentiment" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: governance_wrapped service_role_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update" ON "public"."governance_wrapped" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: notifications service_role_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update" ON "public"."notifications" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_feedback_themes service_role_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update" ON "public"."proposal_feedback_themes" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: governance_benchmarks service_role_update_benchmarks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update_benchmarks" ON "public"."governance_benchmarks" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: governance_briefs service_role_update_briefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update_briefs" ON "public"."governance_briefs" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: feature_flags service_role_update_flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update_flags" ON "public"."feature_flags" FOR UPDATE USING ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: drep_questions service_role_update_questions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_update_questions" ON "public"."drep_questions" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: governance_wrapped service_role_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_write" ON "public"."governance_wrapped" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_feedback_themes service_role_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_write" ON "public"."proposal_feedback_themes" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));


--
-- Name: governance_benchmarks service_role_write_benchmarks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_write_benchmarks" ON "public"."governance_benchmarks" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: governance_briefs service_role_write_briefs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_write_briefs" ON "public"."governance_briefs" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: feature_flags service_role_write_flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_write_flags" ON "public"."feature_flags" FOR INSERT WITH CHECK ((( SELECT "current_setting"('role'::"text") AS "current_setting") = 'service_role'::"text"));


--
-- Name: snapshot_completeness_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."snapshot_completeness_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: social_link_checks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."social_link_checks" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_alignment_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."spo_alignment_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_characters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."spo_characters" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_characters spo_characters_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "spo_characters_public_read" ON "public"."spo_characters" FOR SELECT USING (true);


--
-- Name: spo_power_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."spo_power_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_score_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."spo_score_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_sybil_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."spo_sybil_flags" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."spo_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: spo_votes spo_votes_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "spo_votes_public_read" ON "public"."spo_votes" FOR SELECT USING (true);


--
-- Name: spo_votes spo_votes_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "spo_votes_service_delete" ON "public"."spo_votes" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: spo_votes spo_votes_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "spo_votes_service_update" ON "public"."spo_votes" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: spo_votes spo_votes_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "spo_votes_service_write" ON "public"."spo_votes" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: spo_score_snapshots sss_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sss_public_read" ON "public"."spo_score_snapshots" FOR SELECT USING (true);


--
-- Name: spo_score_snapshots sss_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sss_service_insert" ON "public"."spo_score_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: spo_score_snapshots sss_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "sss_service_update" ON "public"."spo_score_snapshots" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: state_of_governance_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."state_of_governance_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: state_of_governance_reports state_of_governance_reports_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "state_of_governance_reports_public_read" ON "public"."state_of_governance_reports" FOR SELECT USING (("published" = true));


--
-- Name: sync_cursors; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."sync_cursors" ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."sync_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_accountability_polls tap_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tap_service_delete" ON "public"."treasury_accountability_polls" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_accountability_polls tap_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tap_service_update" ON "public"."treasury_accountability_polls" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_accountability_polls tap_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tap_service_write" ON "public"."treasury_accountability_polls" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_accountability_responses tar_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tar_service_delete" ON "public"."treasury_accountability_responses" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_accountability_responses tar_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tar_service_update" ON "public"."treasury_accountability_responses" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_accountability_responses tar_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tar_service_write" ON "public"."treasury_accountability_responses" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: proposal_team_invites team_invites_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team_invites_public_read" ON "public"."proposal_team_invites" FOR SELECT USING (true);


--
-- Name: proposal_team_invites team_invites_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team_invites_service_write" ON "public"."proposal_team_invites" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: proposal_team_members team_members_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team_members_public_read" ON "public"."proposal_team_members" FOR SELECT USING (true);


--
-- Name: proposal_team_members team_members_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team_members_service_write" ON "public"."proposal_team_members" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: review_framework_templates templates_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "templates_public_read" ON "public"."review_framework_templates" FOR SELECT USING (true);


--
-- Name: review_framework_templates templates_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "templates_service_write" ON "public"."review_framework_templates" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: treasury_health_snapshots ths_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ths_public_read" ON "public"."treasury_health_snapshots" FOR SELECT USING (true);


--
-- Name: treasury_health_snapshots ths_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ths_service_insert" ON "public"."treasury_health_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: tier_changes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."tier_changes" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_accountability_polls; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."treasury_accountability_polls" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_accountability_responses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."treasury_accountability_responses" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_health_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."treasury_health_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_snapshots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."treasury_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_snapshots ts_service_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ts_service_delete" ON "public"."treasury_snapshots" FOR DELETE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_snapshots ts_service_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ts_service_update" ON "public"."treasury_snapshots" FOR UPDATE USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: treasury_snapshots ts_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ts_service_write" ON "public"."treasury_snapshots" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));


--
-- Name: user_governance_profile_history ugph_owner_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ugph_owner_read" ON "public"."user_governance_profile_history" FOR SELECT USING (true);


--
-- Name: user_governance_profile_history ugph_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ugph_service_insert" ON "public"."user_governance_profile_history" FOR INSERT WITH CHECK (true);


--
-- Name: user_channels; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_channels" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entity_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_entity_subscriptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_governance_profile_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_governance_profile_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_governance_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_governance_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_hub_checkins; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_hub_checkins" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_notification_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wallets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_wallets" ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wallets uw_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "uw_public_read" ON "public"."user_wallets" FOR SELECT USING (true);


--
-- Name: user_wallets uw_service_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "uw_service_write" ON "public"."user_wallets" USING (("current_setting"('role'::"text") = 'service_role'::"text")) WITH CHECK (("current_setting"('role'::"text") = 'service_role'::"text"));


--
-- Name: vote_explanations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."vote_explanations" ENABLE ROW LEVEL SECURITY;

--
-- Name: vote_rationales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."vote_rationales" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "embedding_similarity"("embedding_a" "extensions"."vector", "embedding_b" "extensions"."vector"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."embedding_similarity"("embedding_a" "extensions"."vector", "embedding_b" "extensions"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."embedding_similarity"("embedding_a" "extensions"."vector", "embedding_b" "extensions"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."embedding_similarity"("embedding_a" "extensions"."vector", "embedding_b" "extensions"."vector") TO "service_role";


--
-- Name: FUNCTION "match_embeddings"("query_embedding" "extensions"."vector", "match_entity_type" "text", "match_limit" integer, "min_similarity" double precision); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."match_embeddings"("query_embedding" "extensions"."vector", "match_entity_type" "text", "match_limit" integer, "min_similarity" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."match_embeddings"("query_embedding" "extensions"."vector", "match_entity_type" "text", "match_limit" integer, "min_similarity" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_embeddings"("query_embedding" "extensions"."vector", "match_entity_type" "text", "match_limit" integer, "min_similarity" double precision) TO "service_role";


--
-- Name: FUNCTION "rls_auto_enable"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


--
-- Name: FUNCTION "set_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


--
-- Name: TABLE "admin_audit_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";


--
-- Name: SEQUENCE "admin_audit_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_audit_log_id_seq" TO "service_role";


--
-- Name: TABLE "agent_conversations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."agent_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_conversations" TO "service_role";


--
-- Name: TABLE "ai_activity_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_activity_log" TO "service_role";


--
-- Name: TABLE "ai_health_metrics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_health_metrics" TO "anon";
GRANT ALL ON TABLE "public"."ai_health_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_health_metrics" TO "service_role";


--
-- Name: SEQUENCE "ai_health_metrics_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."ai_health_metrics_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_health_metrics_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_health_metrics_id_seq" TO "service_role";


--
-- Name: TABLE "alignment_drift_records"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."alignment_drift_records" TO "anon";
GRANT ALL ON TABLE "public"."alignment_drift_records" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_drift_records" TO "service_role";


--
-- Name: SEQUENCE "alignment_drift_records_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."alignment_drift_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."alignment_drift_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."alignment_drift_records_id_seq" TO "service_role";


--
-- Name: TABLE "alignment_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."alignment_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."alignment_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_snapshots" TO "service_role";


--
-- Name: TABLE "amendment_genealogy"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."amendment_genealogy" TO "anon";
GRANT ALL ON TABLE "public"."amendment_genealogy" TO "authenticated";
GRANT ALL ON TABLE "public"."amendment_genealogy" TO "service_role";


--
-- Name: TABLE "amendment_section_sentiment"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."amendment_section_sentiment" TO "anon";
GRANT ALL ON TABLE "public"."amendment_section_sentiment" TO "authenticated";
GRANT ALL ON TABLE "public"."amendment_section_sentiment" TO "service_role";


--
-- Name: TABLE "api_keys"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";


--
-- Name: TABLE "api_usage_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."api_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."api_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."api_usage_log" TO "service_role";


--
-- Name: SEQUENCE "api_usage_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."api_usage_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."api_usage_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."api_usage_log_id_seq" TO "service_role";


--
-- Name: TABLE "catalyst_campaigns"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."catalyst_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."catalyst_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."catalyst_campaigns" TO "service_role";


--
-- Name: TABLE "catalyst_funds"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."catalyst_funds" TO "anon";
GRANT ALL ON TABLE "public"."catalyst_funds" TO "authenticated";
GRANT ALL ON TABLE "public"."catalyst_funds" TO "service_role";


--
-- Name: TABLE "catalyst_proposal_team"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."catalyst_proposal_team" TO "anon";
GRANT ALL ON TABLE "public"."catalyst_proposal_team" TO "authenticated";
GRANT ALL ON TABLE "public"."catalyst_proposal_team" TO "service_role";


--
-- Name: TABLE "catalyst_proposals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."catalyst_proposals" TO "anon";
GRANT ALL ON TABLE "public"."catalyst_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."catalyst_proposals" TO "service_role";


--
-- Name: TABLE "catalyst_team_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."catalyst_team_members" TO "anon";
GRANT ALL ON TABLE "public"."catalyst_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."catalyst_team_members" TO "service_role";


--
-- Name: TABLE "cc_agreement_matrix"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_agreement_matrix" TO "anon";
GRANT ALL ON TABLE "public"."cc_agreement_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_agreement_matrix" TO "service_role";


--
-- Name: TABLE "cc_bloc_assignments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_bloc_assignments" TO "anon";
GRANT ALL ON TABLE "public"."cc_bloc_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_bloc_assignments" TO "service_role";


--
-- Name: TABLE "cc_fidelity_proposal_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_fidelity_proposal_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."cc_fidelity_proposal_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_fidelity_proposal_snapshots" TO "service_role";


--
-- Name: TABLE "cc_fidelity_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_fidelity_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."cc_fidelity_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_fidelity_snapshots" TO "service_role";


--
-- Name: TABLE "cc_intelligence_briefs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_intelligence_briefs" TO "anon";
GRANT ALL ON TABLE "public"."cc_intelligence_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_intelligence_briefs" TO "service_role";


--
-- Name: TABLE "cc_interpretation_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_interpretation_history" TO "anon";
GRANT ALL ON TABLE "public"."cc_interpretation_history" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_interpretation_history" TO "service_role";


--
-- Name: TABLE "cc_member_archetypes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_member_archetypes" TO "anon";
GRANT ALL ON TABLE "public"."cc_member_archetypes" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_member_archetypes" TO "service_role";


--
-- Name: TABLE "cc_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_members" TO "anon";
GRANT ALL ON TABLE "public"."cc_members" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_members" TO "service_role";


--
-- Name: TABLE "cc_precedent_links"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_precedent_links" TO "anon";
GRANT ALL ON TABLE "public"."cc_precedent_links" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_precedent_links" TO "service_role";


--
-- Name: TABLE "cc_predictive_signals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_predictive_signals" TO "anon";
GRANT ALL ON TABLE "public"."cc_predictive_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_predictive_signals" TO "service_role";


--
-- Name: TABLE "cc_rationale_analysis"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_rationale_analysis" TO "anon";
GRANT ALL ON TABLE "public"."cc_rationale_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_rationale_analysis" TO "service_role";


--
-- Name: TABLE "cc_rationales"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_rationales" TO "anon";
GRANT ALL ON TABLE "public"."cc_rationales" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_rationales" TO "service_role";


--
-- Name: TABLE "cc_votes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cc_votes" TO "anon";
GRANT ALL ON TABLE "public"."cc_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."cc_votes" TO "service_role";


--
-- Name: TABLE "cip108_documents"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cip108_documents" TO "anon";
GRANT ALL ON TABLE "public"."cip108_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."cip108_documents" TO "service_role";


--
-- Name: TABLE "citizen_assemblies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_assemblies" TO "anon";
GRANT ALL ON TABLE "public"."citizen_assemblies" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_assemblies" TO "service_role";


--
-- Name: TABLE "citizen_assembly_responses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_assembly_responses" TO "anon";
GRANT ALL ON TABLE "public"."citizen_assembly_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_assembly_responses" TO "service_role";


--
-- Name: TABLE "citizen_concern_flags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_concern_flags" TO "anon";
GRANT ALL ON TABLE "public"."citizen_concern_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_concern_flags" TO "service_role";


--
-- Name: TABLE "citizen_endorsements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_endorsements" TO "anon";
GRANT ALL ON TABLE "public"."citizen_endorsements" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_endorsements" TO "service_role";


--
-- Name: TABLE "citizen_epoch_summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_epoch_summaries" TO "anon";
GRANT ALL ON TABLE "public"."citizen_epoch_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_epoch_summaries" TO "service_role";


--
-- Name: SEQUENCE "citizen_epoch_summaries_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."citizen_epoch_summaries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."citizen_epoch_summaries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."citizen_epoch_summaries_id_seq" TO "service_role";


--
-- Name: TABLE "citizen_impact_scores"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_impact_scores" TO "anon";
GRANT ALL ON TABLE "public"."citizen_impact_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_impact_scores" TO "service_role";


--
-- Name: TABLE "citizen_impact_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_impact_tags" TO "anon";
GRANT ALL ON TABLE "public"."citizen_impact_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_impact_tags" TO "service_role";


--
-- Name: TABLE "citizen_milestones"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_milestones" TO "anon";
GRANT ALL ON TABLE "public"."citizen_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_milestones" TO "service_role";


--
-- Name: TABLE "citizen_priority_rankings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_priority_rankings" TO "anon";
GRANT ALL ON TABLE "public"."citizen_priority_rankings" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_priority_rankings" TO "service_role";


--
-- Name: TABLE "citizen_priority_signals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_priority_signals" TO "anon";
GRANT ALL ON TABLE "public"."citizen_priority_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_priority_signals" TO "service_role";


--
-- Name: TABLE "citizen_proposal_followups"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_proposal_followups" TO "anon";
GRANT ALL ON TABLE "public"."citizen_proposal_followups" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_proposal_followups" TO "service_role";


--
-- Name: TABLE "citizen_ring_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_ring_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."citizen_ring_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_ring_snapshots" TO "service_role";


--
-- Name: TABLE "citizen_sentiment"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."citizen_sentiment" TO "anon";
GRANT ALL ON TABLE "public"."citizen_sentiment" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_sentiment" TO "service_role";


--
-- Name: TABLE "classification_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."classification_history" TO "anon";
GRANT ALL ON TABLE "public"."classification_history" TO "authenticated";
GRANT ALL ON TABLE "public"."classification_history" TO "service_role";


--
-- Name: TABLE "committee_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."committee_members" TO "anon";
GRANT ALL ON TABLE "public"."committee_members" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_members" TO "service_role";


--
-- Name: TABLE "community_intelligence_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."community_intelligence_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."community_intelligence_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."community_intelligence_snapshots" TO "service_role";


--
-- Name: SEQUENCE "community_intelligence_snapshots_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."community_intelligence_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."community_intelligence_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."community_intelligence_snapshots_id_seq" TO "service_role";


--
-- Name: TABLE "decentralization_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."decentralization_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."decentralization_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."decentralization_snapshots" TO "service_role";


--
-- Name: TABLE "decision_journal_entries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."decision_journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."decision_journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."decision_journal_entries" TO "service_role";


--
-- Name: TABLE "delegation_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."delegation_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."delegation_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."delegation_snapshots" TO "service_role";


--
-- Name: TABLE "draft_review_responses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."draft_review_responses" TO "anon";
GRANT ALL ON TABLE "public"."draft_review_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."draft_review_responses" TO "service_role";


--
-- Name: TABLE "draft_reviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."draft_reviews" TO "anon";
GRANT ALL ON TABLE "public"."draft_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."draft_reviews" TO "service_role";


--
-- Name: TABLE "drep_characters"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_characters" TO "anon";
GRANT ALL ON TABLE "public"."drep_characters" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_characters" TO "service_role";


--
-- Name: TABLE "drep_delegator_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_delegator_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."drep_delegator_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_delegator_snapshots" TO "service_role";


--
-- Name: SEQUENCE "drep_delegator_snapshots_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."drep_delegator_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."drep_delegator_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."drep_delegator_snapshots_id_seq" TO "service_role";


--
-- Name: TABLE "drep_epoch_updates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_epoch_updates" TO "anon";
GRANT ALL ON TABLE "public"."drep_epoch_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_epoch_updates" TO "service_role";


--
-- Name: TABLE "drep_lifecycle_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_lifecycle_events" TO "anon";
GRANT ALL ON TABLE "public"."drep_lifecycle_events" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_lifecycle_events" TO "service_role";


--
-- Name: SEQUENCE "drep_lifecycle_events_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."drep_lifecycle_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."drep_lifecycle_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."drep_lifecycle_events_id_seq" TO "service_role";


--
-- Name: TABLE "drep_milestones"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_milestones" TO "anon";
GRANT ALL ON TABLE "public"."drep_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_milestones" TO "service_role";


--
-- Name: TABLE "drep_pca_coordinates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_pca_coordinates" TO "anon";
GRANT ALL ON TABLE "public"."drep_pca_coordinates" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_pca_coordinates" TO "service_role";


--
-- Name: TABLE "drep_power_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_power_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."drep_power_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_power_snapshots" TO "service_role";


--
-- Name: TABLE "drep_questions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_questions" TO "anon";
GRANT ALL ON TABLE "public"."drep_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_questions" TO "service_role";


--
-- Name: TABLE "drep_responses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_responses" TO "anon";
GRANT ALL ON TABLE "public"."drep_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_responses" TO "service_role";


--
-- Name: TABLE "drep_score_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_score_history" TO "anon";
GRANT ALL ON TABLE "public"."drep_score_history" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_score_history" TO "service_role";


--
-- Name: TABLE "drep_votes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."drep_votes" TO "anon";
GRANT ALL ON TABLE "public"."drep_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."drep_votes" TO "service_role";


--
-- Name: TABLE "dreps"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."dreps" TO "anon";
GRANT ALL ON TABLE "public"."dreps" TO "authenticated";
GRANT ALL ON TABLE "public"."dreps" TO "service_role";


--
-- Name: TABLE "embeddings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."embeddings" TO "anon";
GRANT ALL ON TABLE "public"."embeddings" TO "authenticated";
GRANT ALL ON TABLE "public"."embeddings" TO "service_role";


--
-- Name: TABLE "encrypted_api_keys"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."encrypted_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."encrypted_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."encrypted_api_keys" TO "service_role";


--
-- Name: TABLE "engagement_signal_aggregations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."engagement_signal_aggregations" TO "anon";
GRANT ALL ON TABLE "public"."engagement_signal_aggregations" TO "authenticated";
GRANT ALL ON TABLE "public"."engagement_signal_aggregations" TO "service_role";


--
-- Name: TABLE "epoch_governance_summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."epoch_governance_summaries" TO "anon";
GRANT ALL ON TABLE "public"."epoch_governance_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."epoch_governance_summaries" TO "service_role";


--
-- Name: TABLE "epoch_recaps"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."epoch_recaps" TO "anon";
GRANT ALL ON TABLE "public"."epoch_recaps" TO "authenticated";
GRANT ALL ON TABLE "public"."epoch_recaps" TO "service_role";


--
-- Name: TABLE "feature_flags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";


--
-- Name: TABLE "ghi_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ghi_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."ghi_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."ghi_snapshots" TO "service_role";


--
-- Name: TABLE "governance_benchmarks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."governance_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_benchmarks" TO "service_role";


--
-- Name: TABLE "governance_briefs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_briefs" TO "anon";
GRANT ALL ON TABLE "public"."governance_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_briefs" TO "service_role";


--
-- Name: TABLE "governance_epoch_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_epoch_stats" TO "anon";
GRANT ALL ON TABLE "public"."governance_epoch_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_epoch_stats" TO "service_role";


--
-- Name: TABLE "governance_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_events" TO "anon";
GRANT ALL ON TABLE "public"."governance_events" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_events" TO "service_role";


--
-- Name: SEQUENCE "governance_events_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."governance_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."governance_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."governance_events_id_seq" TO "service_role";


--
-- Name: TABLE "governance_participation_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_participation_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."governance_participation_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_participation_snapshots" TO "service_role";


--
-- Name: TABLE "governance_passport"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_passport" TO "anon";
GRANT ALL ON TABLE "public"."governance_passport" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_passport" TO "service_role";


--
-- Name: TABLE "governance_philosophy"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_philosophy" TO "anon";
GRANT ALL ON TABLE "public"."governance_philosophy" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_philosophy" TO "service_role";


--
-- Name: TABLE "governance_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_reports" TO "anon";
GRANT ALL ON TABLE "public"."governance_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_reports" TO "service_role";


--
-- Name: TABLE "governance_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_stats" TO "anon";
GRANT ALL ON TABLE "public"."governance_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_stats" TO "service_role";


--
-- Name: TABLE "governance_wrapped"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."governance_wrapped" TO "anon";
GRANT ALL ON TABLE "public"."governance_wrapped" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_wrapped" TO "service_role";


--
-- Name: TABLE "integrity_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."integrity_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."integrity_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."integrity_snapshots" TO "service_role";


--
-- Name: SEQUENCE "integrity_snapshots_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."integrity_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."integrity_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."integrity_snapshots_id_seq" TO "service_role";


--
-- Name: TABLE "inter_body_alignment"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."inter_body_alignment" TO "anon";
GRANT ALL ON TABLE "public"."inter_body_alignment" TO "authenticated";
GRANT ALL ON TABLE "public"."inter_body_alignment" TO "service_role";


--
-- Name: TABLE "inter_body_alignment_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."inter_body_alignment_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."inter_body_alignment_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."inter_body_alignment_snapshots" TO "service_role";


--
-- Name: TABLE "matching_topics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."matching_topics" TO "anon";
GRANT ALL ON TABLE "public"."matching_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."matching_topics" TO "service_role";


--
-- Name: TABLE "metadata_archive"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."metadata_archive" TO "anon";
GRANT ALL ON TABLE "public"."metadata_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."metadata_archive" TO "service_role";


--
-- Name: SEQUENCE "metadata_archive_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."metadata_archive_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metadata_archive_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metadata_archive_id_seq" TO "service_role";


--
-- Name: TABLE "ncl_periods"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ncl_periods" TO "anon";
GRANT ALL ON TABLE "public"."ncl_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."ncl_periods" TO "service_role";


--
-- Name: SEQUENCE "ncl_periods_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."ncl_periods_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ncl_periods_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ncl_periods_id_seq" TO "service_role";


--
-- Name: TABLE "notification_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_log" TO "service_role";


--
-- Name: TABLE "notification_preferences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";


--
-- Name: TABLE "notifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";


--
-- Name: TABLE "observatory_narratives"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."observatory_narratives" TO "anon";
GRANT ALL ON TABLE "public"."observatory_narratives" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_narratives" TO "service_role";


--
-- Name: SEQUENCE "observatory_narratives_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."observatory_narratives_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."observatory_narratives_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."observatory_narratives_id_seq" TO "service_role";


--
-- Name: TABLE "pca_results"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pca_results" TO "anon";
GRANT ALL ON TABLE "public"."pca_results" TO "authenticated";
GRANT ALL ON TABLE "public"."pca_results" TO "service_role";


--
-- Name: TABLE "perspective_clusters"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."perspective_clusters" TO "anon";
GRANT ALL ON TABLE "public"."perspective_clusters" TO "authenticated";
GRANT ALL ON TABLE "public"."perspective_clusters" TO "service_role";


--
-- Name: TABLE "poll_responses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."poll_responses" TO "anon";
GRANT ALL ON TABLE "public"."poll_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_responses" TO "service_role";


--
-- Name: TABLE "pools"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."pools" TO "anon";
GRANT ALL ON TABLE "public"."pools" TO "authenticated";
GRANT ALL ON TABLE "public"."pools" TO "service_role";


--
-- Name: TABLE "position_statements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."position_statements" TO "anon";
GRANT ALL ON TABLE "public"."position_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."position_statements" TO "service_role";


--
-- Name: TABLE "preview_cohorts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."preview_cohorts" TO "anon";
GRANT ALL ON TABLE "public"."preview_cohorts" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_cohorts" TO "service_role";


--
-- Name: TABLE "preview_feedback"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."preview_feedback" TO "anon";
GRANT ALL ON TABLE "public"."preview_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_feedback" TO "service_role";


--
-- Name: TABLE "preview_invites"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."preview_invites" TO "anon";
GRANT ALL ON TABLE "public"."preview_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_invites" TO "service_role";


--
-- Name: TABLE "preview_sessions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."preview_sessions" TO "anon";
GRANT ALL ON TABLE "public"."preview_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_sessions" TO "service_role";


--
-- Name: TABLE "profile_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profile_views" TO "anon";
GRANT ALL ON TABLE "public"."profile_views" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_views" TO "service_role";


--
-- Name: TABLE "proposal_annotations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_annotations" TO "anon";
GRANT ALL ON TABLE "public"."proposal_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_annotations" TO "service_role";


--
-- Name: TABLE "proposal_brief_feedback"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_brief_feedback" TO "anon";
GRANT ALL ON TABLE "public"."proposal_brief_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_brief_feedback" TO "service_role";


--
-- Name: TABLE "proposal_briefs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_briefs" TO "anon";
GRANT ALL ON TABLE "public"."proposal_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_briefs" TO "service_role";


--
-- Name: TABLE "proposal_classifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_classifications" TO "anon";
GRANT ALL ON TABLE "public"."proposal_classifications" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_classifications" TO "service_role";


--
-- Name: TABLE "proposal_draft_versions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_draft_versions" TO "anon";
GRANT ALL ON TABLE "public"."proposal_draft_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_draft_versions" TO "service_role";


--
-- Name: TABLE "proposal_drafts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_drafts" TO "anon";
GRANT ALL ON TABLE "public"."proposal_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_drafts" TO "service_role";


--
-- Name: TABLE "proposal_engagement_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_engagement_events" TO "anon";
GRANT ALL ON TABLE "public"."proposal_engagement_events" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_engagement_events" TO "service_role";


--
-- Name: SEQUENCE "proposal_engagement_events_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."proposal_engagement_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."proposal_engagement_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."proposal_engagement_events_id_seq" TO "service_role";


--
-- Name: TABLE "proposal_feedback_themes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_feedback_themes" TO "anon";
GRANT ALL ON TABLE "public"."proposal_feedback_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_feedback_themes" TO "service_role";


--
-- Name: TABLE "proposal_intelligence_cache"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_intelligence_cache" TO "anon";
GRANT ALL ON TABLE "public"."proposal_intelligence_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_intelligence_cache" TO "service_role";


--
-- Name: TABLE "proposal_notes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_notes" TO "anon";
GRANT ALL ON TABLE "public"."proposal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_notes" TO "service_role";


--
-- Name: TABLE "proposal_outcomes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_outcomes" TO "anon";
GRANT ALL ON TABLE "public"."proposal_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_outcomes" TO "service_role";


--
-- Name: TABLE "proposal_proposers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_proposers" TO "anon";
GRANT ALL ON TABLE "public"."proposal_proposers" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_proposers" TO "service_role";


--
-- Name: TABLE "proposal_revision_notifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_revision_notifications" TO "anon";
GRANT ALL ON TABLE "public"."proposal_revision_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_revision_notifications" TO "service_role";


--
-- Name: TABLE "proposal_similarity_cache"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_similarity_cache" TO "anon";
GRANT ALL ON TABLE "public"."proposal_similarity_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_similarity_cache" TO "service_role";


--
-- Name: TABLE "proposal_team_approvals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_team_approvals" TO "anon";
GRANT ALL ON TABLE "public"."proposal_team_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_team_approvals" TO "service_role";


--
-- Name: TABLE "proposal_team_invites"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_team_invites" TO "anon";
GRANT ALL ON TABLE "public"."proposal_team_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_team_invites" TO "service_role";


--
-- Name: TABLE "proposal_team_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_team_members" TO "anon";
GRANT ALL ON TABLE "public"."proposal_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_team_members" TO "service_role";


--
-- Name: TABLE "proposal_teams"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_teams" TO "anon";
GRANT ALL ON TABLE "public"."proposal_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_teams" TO "service_role";


--
-- Name: TABLE "proposal_theme_endorsements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_theme_endorsements" TO "anon";
GRANT ALL ON TABLE "public"."proposal_theme_endorsements" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_theme_endorsements" TO "service_role";


--
-- Name: TABLE "proposal_vote_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_vote_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."proposal_vote_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_vote_snapshots" TO "service_role";


--
-- Name: TABLE "proposal_voting_summary"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposal_voting_summary" TO "anon";
GRANT ALL ON TABLE "public"."proposal_voting_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_voting_summary" TO "service_role";


--
-- Name: TABLE "proposals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";


--
-- Name: TABLE "proposer_aliases"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposer_aliases" TO "anon";
GRANT ALL ON TABLE "public"."proposer_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."proposer_aliases" TO "service_role";


--
-- Name: SEQUENCE "proposer_aliases_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."proposer_aliases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."proposer_aliases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."proposer_aliases_id_seq" TO "service_role";


--
-- Name: TABLE "proposers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."proposers" TO "anon";
GRANT ALL ON TABLE "public"."proposers" TO "authenticated";
GRANT ALL ON TABLE "public"."proposers" TO "service_role";


--
-- Name: TABLE "rationale_documents"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."rationale_documents" TO "anon";
GRANT ALL ON TABLE "public"."rationale_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."rationale_documents" TO "service_role";


--
-- Name: TABLE "reconciliation_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reconciliation_log" TO "anon";
GRANT ALL ON TABLE "public"."reconciliation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_log" TO "service_role";


--
-- Name: TABLE "research_conversations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."research_conversations" TO "anon";
GRANT ALL ON TABLE "public"."research_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."research_conversations" TO "service_role";


--
-- Name: TABLE "review_framework_templates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."review_framework_templates" TO "anon";
GRANT ALL ON TABLE "public"."review_framework_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."review_framework_templates" TO "service_role";


--
-- Name: TABLE "review_sessions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."review_sessions" TO "anon";
GRANT ALL ON TABLE "public"."review_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."review_sessions" TO "service_role";


--
-- Name: TABLE "reviewer_briefing_cache"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reviewer_briefing_cache" TO "anon";
GRANT ALL ON TABLE "public"."reviewer_briefing_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."reviewer_briefing_cache" TO "service_role";


--
-- Name: TABLE "revoked_sessions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."revoked_sessions" TO "anon";
GRANT ALL ON TABLE "public"."revoked_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."revoked_sessions" TO "service_role";


--
-- Name: TABLE "scoring_methodology_changelog"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."scoring_methodology_changelog" TO "anon";
GRANT ALL ON TABLE "public"."scoring_methodology_changelog" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_methodology_changelog" TO "service_role";


--
-- Name: SEQUENCE "scoring_methodology_changelog_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."scoring_methodology_changelog_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."scoring_methodology_changelog_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."scoring_methodology_changelog_id_seq" TO "service_role";


--
-- Name: TABLE "semantic_similarity_cache"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."semantic_similarity_cache" TO "anon";
GRANT ALL ON TABLE "public"."semantic_similarity_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."semantic_similarity_cache" TO "service_role";


--
-- Name: TABLE "seneca_conversation_summaries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."seneca_conversation_summaries" TO "anon";
GRANT ALL ON TABLE "public"."seneca_conversation_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."seneca_conversation_summaries" TO "service_role";


--
-- Name: TABLE "snapshot_completeness_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."snapshot_completeness_log" TO "anon";
GRANT ALL ON TABLE "public"."snapshot_completeness_log" TO "authenticated";
GRANT ALL ON TABLE "public"."snapshot_completeness_log" TO "service_role";


--
-- Name: SEQUENCE "snapshot_completeness_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."snapshot_completeness_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."snapshot_completeness_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."snapshot_completeness_log_id_seq" TO "service_role";


--
-- Name: TABLE "social_link_checks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."social_link_checks" TO "anon";
GRANT ALL ON TABLE "public"."social_link_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."social_link_checks" TO "service_role";


--
-- Name: TABLE "spo_alignment_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."spo_alignment_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."spo_alignment_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."spo_alignment_snapshots" TO "service_role";


--
-- Name: TABLE "spo_characters"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."spo_characters" TO "anon";
GRANT ALL ON TABLE "public"."spo_characters" TO "authenticated";
GRANT ALL ON TABLE "public"."spo_characters" TO "service_role";


--
-- Name: TABLE "spo_power_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."spo_power_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."spo_power_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."spo_power_snapshots" TO "service_role";


--
-- Name: TABLE "spo_score_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."spo_score_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."spo_score_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."spo_score_snapshots" TO "service_role";


--
-- Name: TABLE "spo_sybil_flags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."spo_sybil_flags" TO "anon";
GRANT ALL ON TABLE "public"."spo_sybil_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."spo_sybil_flags" TO "service_role";


--
-- Name: SEQUENCE "spo_sybil_flags_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."spo_sybil_flags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."spo_sybil_flags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."spo_sybil_flags_id_seq" TO "service_role";


--
-- Name: TABLE "spo_votes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."spo_votes" TO "anon";
GRANT ALL ON TABLE "public"."spo_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."spo_votes" TO "service_role";


--
-- Name: TABLE "state_of_governance_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."state_of_governance_reports" TO "anon";
GRANT ALL ON TABLE "public"."state_of_governance_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."state_of_governance_reports" TO "service_role";


--
-- Name: TABLE "sync_cursors"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."sync_cursors" TO "anon";
GRANT ALL ON TABLE "public"."sync_cursors" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_cursors" TO "service_role";


--
-- Name: TABLE "sync_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."sync_log" TO "anon";
GRANT ALL ON TABLE "public"."sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_log" TO "service_role";


--
-- Name: SEQUENCE "sync_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sync_log_id_seq" TO "service_role";


--
-- Name: TABLE "tier_changes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."tier_changes" TO "anon";
GRANT ALL ON TABLE "public"."tier_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."tier_changes" TO "service_role";


--
-- Name: SEQUENCE "tier_changes_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."tier_changes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tier_changes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tier_changes_id_seq" TO "service_role";


--
-- Name: TABLE "treasury_accountability_polls"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."treasury_accountability_polls" TO "anon";
GRANT ALL ON TABLE "public"."treasury_accountability_polls" TO "authenticated";
GRANT ALL ON TABLE "public"."treasury_accountability_polls" TO "service_role";


--
-- Name: TABLE "treasury_accountability_responses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."treasury_accountability_responses" TO "anon";
GRANT ALL ON TABLE "public"."treasury_accountability_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."treasury_accountability_responses" TO "service_role";


--
-- Name: TABLE "treasury_health_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."treasury_health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."treasury_health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."treasury_health_snapshots" TO "service_role";


--
-- Name: TABLE "treasury_snapshots"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."treasury_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."treasury_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."treasury_snapshots" TO "service_role";


--
-- Name: TABLE "user_channels"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_channels" TO "anon";
GRANT ALL ON TABLE "public"."user_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."user_channels" TO "service_role";


--
-- Name: TABLE "user_entity_subscriptions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_entity_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_entity_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_entity_subscriptions" TO "service_role";


--
-- Name: TABLE "user_governance_profile_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_governance_profile_history" TO "anon";
GRANT ALL ON TABLE "public"."user_governance_profile_history" TO "authenticated";
GRANT ALL ON TABLE "public"."user_governance_profile_history" TO "service_role";


--
-- Name: TABLE "user_governance_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_governance_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_governance_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_governance_profiles" TO "service_role";


--
-- Name: TABLE "user_hub_checkins"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_hub_checkins" TO "anon";
GRANT ALL ON TABLE "public"."user_hub_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."user_hub_checkins" TO "service_role";


--
-- Name: TABLE "user_notification_preferences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "service_role";


--
-- Name: TABLE "user_wallets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_wallets" TO "anon";
GRANT ALL ON TABLE "public"."user_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_wallets" TO "service_role";


--
-- Name: TABLE "users"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";


--
-- Name: TABLE "vote_rationales"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."vote_rationales" TO "anon";
GRANT ALL ON TABLE "public"."vote_rationales" TO "authenticated";
GRANT ALL ON TABLE "public"."vote_rationales" TO "service_role";


--
-- Name: TABLE "v_ai_summary_coverage"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_ai_summary_coverage" TO "anon";
GRANT ALL ON TABLE "public"."v_ai_summary_coverage" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ai_summary_coverage" TO "service_role";


--
-- Name: TABLE "v_api_abuse_signals"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_api_abuse_signals" TO "anon";
GRANT ALL ON TABLE "public"."v_api_abuse_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."v_api_abuse_signals" TO "service_role";


--
-- Name: TABLE "v_api_daily_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_api_daily_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_api_daily_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_api_daily_stats" TO "service_role";


--
-- Name: TABLE "v_api_hourly_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_api_hourly_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_api_hourly_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_api_hourly_stats" TO "service_role";


--
-- Name: TABLE "v_api_key_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_api_key_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_api_key_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_api_key_stats" TO "service_role";


--
-- Name: TABLE "v_canonical_summary_coverage"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_canonical_summary_coverage" TO "anon";
GRANT ALL ON TABLE "public"."v_canonical_summary_coverage" TO "authenticated";
GRANT ALL ON TABLE "public"."v_canonical_summary_coverage" TO "service_role";


--
-- Name: TABLE "v_hash_verification"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_hash_verification" TO "anon";
GRANT ALL ON TABLE "public"."v_hash_verification" TO "authenticated";
GRANT ALL ON TABLE "public"."v_hash_verification" TO "service_role";


--
-- Name: TABLE "v_metadata_verification"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_metadata_verification" TO "anon";
GRANT ALL ON TABLE "public"."v_metadata_verification" TO "authenticated";
GRANT ALL ON TABLE "public"."v_metadata_verification" TO "service_role";


--
-- Name: TABLE "v_reconciliation_status"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_reconciliation_status" TO "anon";
GRANT ALL ON TABLE "public"."v_reconciliation_status" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reconciliation_status" TO "service_role";


--
-- Name: TABLE "v_sync_health"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_sync_health" TO "anon";
GRANT ALL ON TABLE "public"."v_sync_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sync_health" TO "service_role";


--
-- Name: TABLE "v_system_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_system_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_system_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_system_stats" TO "service_role";


--
-- Name: TABLE "v_vote_power_coverage"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."v_vote_power_coverage" TO "anon";
GRANT ALL ON TABLE "public"."v_vote_power_coverage" TO "authenticated";
GRANT ALL ON TABLE "public"."v_vote_power_coverage" TO "service_role";


--
-- Name: TABLE "vote_explanations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."vote_explanations" TO "anon";
GRANT ALL ON TABLE "public"."vote_explanations" TO "authenticated";
GRANT ALL ON TABLE "public"."vote_explanations" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--



--
-- PostgreSQL database dump complete
--
