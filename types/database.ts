export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          payload: Json | null;
          target: string | null;
          user_id: string | null;
          wallet_address: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          payload?: Json | null;
          target?: string | null;
          user_id?: string | null;
          wallet_address: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          payload?: Json | null;
          target?: string | null;
          user_id?: string | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_audit_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_conversations: {
        Row: {
          context_hash: string | null;
          created_at: string;
          id: string;
          messages: Json;
          proposal_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          context_hash?: string | null;
          created_at?: string;
          id?: string;
          messages?: Json;
          proposal_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          context_hash?: string | null;
          created_at?: string;
          id?: string;
          messages?: Json;
          proposal_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_activity_log: {
        Row: {
          created_at: string;
          draft_id: string | null;
          edit_distance: number | null;
          id: string;
          input_summary: string | null;
          key_source: string;
          model_used: string;
          proposal_index: number | null;
          proposal_tx_hash: string | null;
          skill_name: string;
          stake_address: string | null;
          tokens_used: number | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          draft_id?: string | null;
          edit_distance?: number | null;
          id?: string;
          input_summary?: string | null;
          key_source?: string;
          model_used?: string;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          skill_name: string;
          stake_address?: string | null;
          tokens_used?: number | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          draft_id?: string | null;
          edit_distance?: number | null;
          id?: string;
          input_summary?: string | null;
          key_source?: string;
          model_used?: string;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          skill_name?: string;
          stake_address?: string | null;
          tokens_used?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_activity_log_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      alignment_drift_records: {
        Row: {
          alternative_dreps: Json | null;
          created_at: string | null;
          dimension_drifts: Json;
          drep_id: string;
          drift_classification: string;
          drift_score: number;
          epoch_no: number | null;
          id: number;
          user_id: string;
        };
        Insert: {
          alternative_dreps?: Json | null;
          created_at?: string | null;
          dimension_drifts?: Json;
          drep_id: string;
          drift_classification: string;
          drift_score: number;
          epoch_no?: number | null;
          id?: never;
          user_id: string;
        };
        Update: {
          alternative_dreps?: Json | null;
          created_at?: string | null;
          dimension_drifts?: Json;
          drep_id?: string;
          drift_classification?: string;
          drift_score?: number;
          epoch_no?: number | null;
          id?: never;
          user_id?: string;
        };
        Relationships: [];
      };
      alignment_snapshots: {
        Row: {
          alignment_decentralization: number | null;
          alignment_innovation: number | null;
          alignment_security: number | null;
          alignment_transparency: number | null;
          alignment_treasury_conservative: number | null;
          alignment_treasury_growth: number | null;
          drep_id: string;
          epoch: number;
          pca_coordinates: number[] | null;
          snapshot_at: string | null;
        };
        Insert: {
          alignment_decentralization?: number | null;
          alignment_innovation?: number | null;
          alignment_security?: number | null;
          alignment_transparency?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_growth?: number | null;
          drep_id: string;
          epoch: number;
          pca_coordinates?: number[] | null;
          snapshot_at?: string | null;
        };
        Update: {
          alignment_decentralization?: number | null;
          alignment_innovation?: number | null;
          alignment_security?: number | null;
          alignment_transparency?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_growth?: number | null;
          drep_id?: string;
          epoch?: number;
          pca_coordinates?: number[] | null;
          snapshot_at?: string | null;
        };
        Relationships: [];
      };
      amendment_genealogy: {
        Row: {
          action: string;
          action_by: string | null;
          action_reason: string | null;
          change_id: string;
          created_at: string | null;
          draft_id: string;
          id: string;
          parent_change_id: string | null;
          source_type: string | null;
        };
        Insert: {
          action: string;
          action_by?: string | null;
          action_reason?: string | null;
          change_id: string;
          created_at?: string | null;
          draft_id: string;
          id?: string;
          parent_change_id?: string | null;
          source_type?: string | null;
        };
        Update: {
          action?: string;
          action_by?: string | null;
          action_reason?: string | null;
          change_id?: string;
          created_at?: string | null;
          draft_id?: string;
          id?: string;
          parent_change_id?: string | null;
          source_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'amendment_genealogy_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      amendment_section_sentiment: {
        Row: {
          comment: string | null;
          created_at: string | null;
          draft_id: string;
          id: string;
          section_id: string;
          sentiment: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string | null;
          draft_id: string;
          id?: string;
          section_id: string;
          sentiment: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string | null;
          draft_id?: string;
          id?: string;
          section_id?: string;
          sentiment?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'amendment_section_sentiment_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      api_keys: {
        Row: {
          created_at: string;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          metadata: Json;
          name: string;
          owner_wallet: string | null;
          rate_limit: number;
          rate_window: string;
          revoked_at: string | null;
          tier: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          metadata?: Json;
          name: string;
          owner_wallet?: string | null;
          rate_limit?: number;
          rate_window?: string;
          revoked_at?: string | null;
          tier?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          metadata?: Json;
          name?: string;
          owner_wallet?: string | null;
          rate_limit?: number;
          rate_window?: string;
          revoked_at?: string | null;
          tier?: string;
        };
        Relationships: [];
      };
      api_usage_log: {
        Row: {
          created_at: string;
          data_age_s: number | null;
          endpoint: string;
          error_code: string | null;
          id: number;
          ip_hash: string | null;
          key_id: string | null;
          key_prefix: string | null;
          method: string;
          response_ms: number | null;
          status_code: number;
          tier: string;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          data_age_s?: number | null;
          endpoint: string;
          error_code?: string | null;
          id?: never;
          ip_hash?: string | null;
          key_id?: string | null;
          key_prefix?: string | null;
          method?: string;
          response_ms?: number | null;
          status_code: number;
          tier?: string;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          data_age_s?: number | null;
          endpoint?: string;
          error_code?: string | null;
          id?: never;
          ip_hash?: string | null;
          key_id?: string | null;
          key_prefix?: string | null;
          method?: string;
          response_ms?: number | null;
          status_code?: number;
          tier?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'api_usage_log_key_id_fkey';
            columns: ['key_id'];
            isOneToOne: false;
            referencedRelation: 'api_keys';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'api_usage_log_key_id_fkey';
            columns: ['key_id'];
            isOneToOne: false;
            referencedRelation: 'v_api_key_stats';
            referencedColumns: ['key_id'];
          },
        ];
      };
      catalyst_campaigns: {
        Row: {
          amount: number | null;
          awarded_at: string | null;
          excerpt: string | null;
          fund_id: string | null;
          id: string;
          launched_at: string | null;
          slug: string | null;
          synced_at: string;
          title: string;
        };
        Insert: {
          amount?: number | null;
          awarded_at?: string | null;
          excerpt?: string | null;
          fund_id?: string | null;
          id: string;
          launched_at?: string | null;
          slug?: string | null;
          synced_at?: string;
          title: string;
        };
        Update: {
          amount?: number | null;
          awarded_at?: string | null;
          excerpt?: string | null;
          fund_id?: string | null;
          id?: string;
          launched_at?: string | null;
          slug?: string | null;
          synced_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalyst_campaigns_fund_id_fkey';
            columns: ['fund_id'];
            isOneToOne: false;
            referencedRelation: 'catalyst_funds';
            referencedColumns: ['id'];
          },
        ];
      };
      catalyst_funds: {
        Row: {
          amount: number | null;
          awarded_at: string | null;
          banner_img_url: string | null;
          completed_count: number | null;
          currency: string | null;
          currency_symbol: string | null;
          funded_count: number | null;
          hero_img_url: string | null;
          id: string;
          launched_at: string | null;
          proposals_count: number | null;
          slug: string | null;
          status: string | null;
          synced_at: string;
          title: string;
        };
        Insert: {
          amount?: number | null;
          awarded_at?: string | null;
          banner_img_url?: string | null;
          completed_count?: number | null;
          currency?: string | null;
          currency_symbol?: string | null;
          funded_count?: number | null;
          hero_img_url?: string | null;
          id: string;
          launched_at?: string | null;
          proposals_count?: number | null;
          slug?: string | null;
          status?: string | null;
          synced_at?: string;
          title: string;
        };
        Update: {
          amount?: number | null;
          awarded_at?: string | null;
          banner_img_url?: string | null;
          completed_count?: number | null;
          currency?: string | null;
          currency_symbol?: string | null;
          funded_count?: number | null;
          hero_img_url?: string | null;
          id?: string;
          launched_at?: string | null;
          proposals_count?: number | null;
          slug?: string | null;
          status?: string | null;
          synced_at?: string;
          title?: string;
        };
        Relationships: [];
      };
      catalyst_proposal_team: {
        Row: {
          proposal_id: string;
          team_member_id: string;
        };
        Insert: {
          proposal_id: string;
          team_member_id: string;
        };
        Update: {
          proposal_id?: string;
          team_member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalyst_proposal_team_proposal_id_fkey';
            columns: ['proposal_id'];
            isOneToOne: false;
            referencedRelation: 'catalyst_proposals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'catalyst_proposal_team_team_member_id_fkey';
            columns: ['team_member_id'];
            isOneToOne: false;
            referencedRelation: 'catalyst_team_members';
            referencedColumns: ['id'];
          },
        ];
      };
      catalyst_proposals: {
        Row: {
          abstain_votes_count: number | null;
          alignment_score: number | null;
          amount_received: number | null;
          amount_requested: number | null;
          auditability_score: number | null;
          campaign_id: string | null;
          chain_proposal_id: string | null;
          chain_proposal_index: number | null;
          currency: string | null;
          experience: string | null;
          feasibility_score: number | null;
          fund_id: string | null;
          funded_at: string | null;
          funding_status: string | null;
          id: string;
          ideascale_id: string | null;
          link: string | null;
          no_votes_count: number | null;
          no_wallets: number | null;
          opensource: boolean | null;
          problem: string | null;
          project_details: Json | null;
          project_length: string | null;
          slug: string | null;
          solution: string | null;
          status: string | null;
          synced_at: string;
          title: string;
          unique_wallets: number | null;
          website: string | null;
          yes_votes_count: number | null;
          yes_wallets: number | null;
        };
        Insert: {
          abstain_votes_count?: number | null;
          alignment_score?: number | null;
          amount_received?: number | null;
          amount_requested?: number | null;
          auditability_score?: number | null;
          campaign_id?: string | null;
          chain_proposal_id?: string | null;
          chain_proposal_index?: number | null;
          currency?: string | null;
          experience?: string | null;
          feasibility_score?: number | null;
          fund_id?: string | null;
          funded_at?: string | null;
          funding_status?: string | null;
          id: string;
          ideascale_id?: string | null;
          link?: string | null;
          no_votes_count?: number | null;
          no_wallets?: number | null;
          opensource?: boolean | null;
          problem?: string | null;
          project_details?: Json | null;
          project_length?: string | null;
          slug?: string | null;
          solution?: string | null;
          status?: string | null;
          synced_at?: string;
          title: string;
          unique_wallets?: number | null;
          website?: string | null;
          yes_votes_count?: number | null;
          yes_wallets?: number | null;
        };
        Update: {
          abstain_votes_count?: number | null;
          alignment_score?: number | null;
          amount_received?: number | null;
          amount_requested?: number | null;
          auditability_score?: number | null;
          campaign_id?: string | null;
          chain_proposal_id?: string | null;
          chain_proposal_index?: number | null;
          currency?: string | null;
          experience?: string | null;
          feasibility_score?: number | null;
          fund_id?: string | null;
          funded_at?: string | null;
          funding_status?: string | null;
          id?: string;
          ideascale_id?: string | null;
          link?: string | null;
          no_votes_count?: number | null;
          no_wallets?: number | null;
          opensource?: boolean | null;
          problem?: string | null;
          project_details?: Json | null;
          project_length?: string | null;
          slug?: string | null;
          solution?: string | null;
          status?: string | null;
          synced_at?: string;
          title?: string;
          unique_wallets?: number | null;
          website?: string | null;
          yes_votes_count?: number | null;
          yes_wallets?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'catalyst_proposals_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'catalyst_campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'catalyst_proposals_fund_id_fkey';
            columns: ['fund_id'];
            isOneToOne: false;
            referencedRelation: 'catalyst_funds';
            referencedColumns: ['id'];
          },
        ];
      };
      catalyst_team_members: {
        Row: {
          bio: string | null;
          completed_proposals: number | null;
          discord: string | null;
          funded_proposals: number | null;
          hero_img_url: string | null;
          id: string;
          ideascale: string | null;
          linkedin: string | null;
          name: string | null;
          submitted_proposals: number | null;
          synced_at: string;
          telegram: string | null;
          twitter: string | null;
          username: string | null;
        };
        Insert: {
          bio?: string | null;
          completed_proposals?: number | null;
          discord?: string | null;
          funded_proposals?: number | null;
          hero_img_url?: string | null;
          id: string;
          ideascale?: string | null;
          linkedin?: string | null;
          name?: string | null;
          submitted_proposals?: number | null;
          synced_at?: string;
          telegram?: string | null;
          twitter?: string | null;
          username?: string | null;
        };
        Update: {
          bio?: string | null;
          completed_proposals?: number | null;
          discord?: string | null;
          funded_proposals?: number | null;
          hero_img_url?: string | null;
          id?: string;
          ideascale?: string | null;
          linkedin?: string | null;
          name?: string | null;
          submitted_proposals?: number | null;
          synced_at?: string;
          telegram?: string | null;
          twitter?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      cc_agreement_matrix: {
        Row: {
          agreed_count: number | null;
          agreement_pct: number | null;
          computed_at: string | null;
          disagreed_count: number | null;
          last_disagreement_index: number | null;
          last_disagreement_proposal: string | null;
          member_a: string;
          member_b: string;
          reasoning_similarity_pct: number | null;
          shared_articles_count: number | null;
          total_articles_union: number | null;
          total_shared_proposals: number | null;
        };
        Insert: {
          agreed_count?: number | null;
          agreement_pct?: number | null;
          computed_at?: string | null;
          disagreed_count?: number | null;
          last_disagreement_index?: number | null;
          last_disagreement_proposal?: string | null;
          member_a: string;
          member_b: string;
          reasoning_similarity_pct?: number | null;
          shared_articles_count?: number | null;
          total_articles_union?: number | null;
          total_shared_proposals?: number | null;
        };
        Update: {
          agreed_count?: number | null;
          agreement_pct?: number | null;
          computed_at?: string | null;
          disagreed_count?: number | null;
          last_disagreement_index?: number | null;
          last_disagreement_proposal?: string | null;
          member_a?: string;
          member_b?: string;
          reasoning_similarity_pct?: number | null;
          shared_articles_count?: number | null;
          total_articles_union?: number | null;
          total_shared_proposals?: number | null;
        };
        Relationships: [];
      };
      cc_bloc_assignments: {
        Row: {
          bloc_label: string;
          cc_hot_id: string;
          computed_at: string | null;
          id: string;
          internal_agreement_pct: number | null;
          member_count: number | null;
        };
        Insert: {
          bloc_label: string;
          cc_hot_id: string;
          computed_at?: string | null;
          id?: string;
          internal_agreement_pct?: number | null;
          member_count?: number | null;
        };
        Update: {
          bloc_label?: string;
          cc_hot_id?: string;
          computed_at?: string | null;
          id?: string;
          internal_agreement_pct?: number | null;
          member_count?: number | null;
        };
        Relationships: [];
      };
      cc_fidelity_proposal_snapshots: {
        Row: {
          cc_hot_id: string;
          constitutional_grounding_score: number | null;
          eligible_proposals: number | null;
          fidelity_score: number | null;
          participation_score: number | null;
          proposal_epoch: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_quality_score: number | null;
          snapshot_at: string | null;
          votes_cast: number | null;
        };
        Insert: {
          cc_hot_id: string;
          constitutional_grounding_score?: number | null;
          eligible_proposals?: number | null;
          fidelity_score?: number | null;
          participation_score?: number | null;
          proposal_epoch?: number | null;
          proposal_index?: number;
          proposal_tx_hash: string;
          rationale_quality_score?: number | null;
          snapshot_at?: string | null;
          votes_cast?: number | null;
        };
        Update: {
          cc_hot_id?: string;
          constitutional_grounding_score?: number | null;
          eligible_proposals?: number | null;
          fidelity_score?: number | null;
          participation_score?: number | null;
          proposal_epoch?: number | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationale_quality_score?: number | null;
          snapshot_at?: string | null;
          votes_cast?: number | null;
        };
        Relationships: [];
      };
      cc_fidelity_snapshots: {
        Row: {
          cc_hot_id: string;
          constitutional_grounding_score: number | null;
          eligible_proposals: number | null;
          epoch_no: number;
          fidelity_score: number | null;
          participation_score: number | null;
          rationale_quality_score: number | null;
          snapshot_at: string | null;
          votes_cast: number | null;
        };
        Insert: {
          cc_hot_id: string;
          constitutional_grounding_score?: number | null;
          eligible_proposals?: number | null;
          epoch_no: number;
          fidelity_score?: number | null;
          participation_score?: number | null;
          rationale_quality_score?: number | null;
          snapshot_at?: string | null;
          votes_cast?: number | null;
        };
        Update: {
          cc_hot_id?: string;
          constitutional_grounding_score?: number | null;
          eligible_proposals?: number | null;
          epoch_no?: number;
          fidelity_score?: number | null;
          participation_score?: number | null;
          rationale_quality_score?: number | null;
          snapshot_at?: string | null;
          votes_cast?: number | null;
        };
        Relationships: [];
      };
      cc_intelligence_briefs: {
        Row: {
          brief_type: string;
          citations: Json | null;
          executive_summary: string | null;
          expires_at: string | null;
          full_narrative: string | null;
          generated_at: string | null;
          headline: string | null;
          id: string;
          input_hash: string | null;
          key_findings: Json | null;
          model_version: string;
          persona_variant: string | null;
          reference_id: string;
          what_changed: string | null;
        };
        Insert: {
          brief_type: string;
          citations?: Json | null;
          executive_summary?: string | null;
          expires_at?: string | null;
          full_narrative?: string | null;
          generated_at?: string | null;
          headline?: string | null;
          id?: string;
          input_hash?: string | null;
          key_findings?: Json | null;
          model_version: string;
          persona_variant?: string | null;
          reference_id: string;
          what_changed?: string | null;
        };
        Update: {
          brief_type?: string;
          citations?: Json | null;
          executive_summary?: string | null;
          expires_at?: string | null;
          full_narrative?: string | null;
          generated_at?: string | null;
          headline?: string | null;
          id?: string;
          input_hash?: string | null;
          key_findings?: Json | null;
          model_version?: string;
          persona_variant?: string | null;
          reference_id?: string;
          what_changed?: string | null;
        };
        Relationships: [];
      };
      cc_interpretation_history: {
        Row: {
          article: string;
          cc_hot_id: string;
          consistent_with_prior: boolean | null;
          created_at: string | null;
          drift_note: string | null;
          epoch: number | null;
          id: string;
          interpretation_stance: string | null;
          interpretation_summary: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Insert: {
          article: string;
          cc_hot_id: string;
          consistent_with_prior?: boolean | null;
          created_at?: string | null;
          drift_note?: string | null;
          epoch?: number | null;
          id?: string;
          interpretation_stance?: string | null;
          interpretation_summary?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Update: {
          article?: string;
          cc_hot_id?: string;
          consistent_with_prior?: boolean | null;
          created_at?: string | null;
          drift_note?: string | null;
          epoch?: number | null;
          id?: string;
          interpretation_stance?: string | null;
          interpretation_summary?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
        };
        Relationships: [];
      };
      cc_member_archetypes: {
        Row: {
          archetype_description: string | null;
          archetype_label: string;
          cc_hot_id: string;
          computed_at: string | null;
          independence_profile: string | null;
          most_aligned_member: string | null;
          most_aligned_pct: number | null;
          most_divergent_member: string | null;
          most_divergent_pct: number | null;
          sole_dissenter_count: number | null;
          sole_dissenter_proposals: Json | null;
          specialization: Json | null;
          strictness_score: number | null;
        };
        Insert: {
          archetype_description?: string | null;
          archetype_label: string;
          cc_hot_id: string;
          computed_at?: string | null;
          independence_profile?: string | null;
          most_aligned_member?: string | null;
          most_aligned_pct?: number | null;
          most_divergent_member?: string | null;
          most_divergent_pct?: number | null;
          sole_dissenter_count?: number | null;
          sole_dissenter_proposals?: Json | null;
          specialization?: Json | null;
          strictness_score?: number | null;
        };
        Update: {
          archetype_description?: string | null;
          archetype_label?: string;
          cc_hot_id?: string;
          computed_at?: string | null;
          independence_profile?: string | null;
          most_aligned_member?: string | null;
          most_aligned_pct?: number | null;
          most_divergent_member?: string | null;
          most_divergent_pct?: number | null;
          sole_dissenter_count?: number | null;
          sole_dissenter_proposals?: Json | null;
          specialization?: Json | null;
          strictness_score?: number | null;
        };
        Relationships: [];
      };
      cc_members: {
        Row: {
          author_name: string | null;
          authorization_epoch: number | null;
          avg_article_coverage: number | null;
          avg_reasoning_quality: number | null;
          cc_cold_id: string | null;
          cc_hot_id: string;
          consistency_score: number | null;
          constitutional_grounding_score: number | null;
          eligible_proposals: number | null;
          expiration_epoch: number | null;
          fidelity_grade: string | null;
          fidelity_score: number | null;
          has_script: boolean | null;
          participation_score: number | null;
          rationale_provision_rate: number | null;
          rationale_quality_score: number | null;
          status: string | null;
          updated_at: string | null;
          votes_cast: number | null;
        };
        Insert: {
          author_name?: string | null;
          authorization_epoch?: number | null;
          avg_article_coverage?: number | null;
          avg_reasoning_quality?: number | null;
          cc_cold_id?: string | null;
          cc_hot_id: string;
          consistency_score?: number | null;
          constitutional_grounding_score?: number | null;
          eligible_proposals?: number | null;
          expiration_epoch?: number | null;
          fidelity_grade?: string | null;
          fidelity_score?: number | null;
          has_script?: boolean | null;
          participation_score?: number | null;
          rationale_provision_rate?: number | null;
          rationale_quality_score?: number | null;
          status?: string | null;
          updated_at?: string | null;
          votes_cast?: number | null;
        };
        Update: {
          author_name?: string | null;
          authorization_epoch?: number | null;
          avg_article_coverage?: number | null;
          avg_reasoning_quality?: number | null;
          cc_cold_id?: string | null;
          cc_hot_id?: string;
          consistency_score?: number | null;
          constitutional_grounding_score?: number | null;
          eligible_proposals?: number | null;
          expiration_epoch?: number | null;
          fidelity_grade?: string | null;
          fidelity_score?: number | null;
          has_script?: boolean | null;
          participation_score?: number | null;
          rationale_provision_rate?: number | null;
          rationale_quality_score?: number | null;
          status?: string | null;
          updated_at?: string | null;
          votes_cast?: number | null;
        };
        Relationships: [];
      };
      cc_precedent_links: {
        Row: {
          created_at: string | null;
          explanation: string | null;
          id: string;
          relationship: string;
          shared_articles: Json | null;
          source_index: number;
          source_tx_hash: string;
          target_index: number;
          target_tx_hash: string;
        };
        Insert: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string;
          relationship: string;
          shared_articles?: Json | null;
          source_index: number;
          source_tx_hash: string;
          target_index: number;
          target_tx_hash: string;
        };
        Update: {
          created_at?: string | null;
          explanation?: string | null;
          id?: string;
          relationship?: string;
          shared_articles?: Json | null;
          source_index?: number;
          source_tx_hash?: string;
          target_index?: number;
          target_tx_hash?: string;
        };
        Relationships: [];
      };
      cc_predictive_signals: {
        Row: {
          actual_outcome: string | null;
          confidence: number | null;
          id: string;
          key_article: string | null;
          model_version: string;
          predicted_at: string | null;
          predicted_outcome: string | null;
          predicted_split: Json | null;
          prediction_accurate: boolean | null;
          proposal_index: number;
          proposal_tx_hash: string;
          reasoning: string | null;
          tension_flag: boolean | null;
        };
        Insert: {
          actual_outcome?: string | null;
          confidence?: number | null;
          id?: string;
          key_article?: string | null;
          model_version: string;
          predicted_at?: string | null;
          predicted_outcome?: string | null;
          predicted_split?: Json | null;
          prediction_accurate?: boolean | null;
          proposal_index: number;
          proposal_tx_hash: string;
          reasoning?: string | null;
          tension_flag?: boolean | null;
        };
        Update: {
          actual_outcome?: string | null;
          confidence?: number | null;
          id?: string;
          key_article?: string | null;
          model_version?: string;
          predicted_at?: string | null;
          predicted_outcome?: string | null;
          predicted_split?: Json | null;
          prediction_accurate?: boolean | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          reasoning?: string | null;
          tension_flag?: boolean | null;
        };
        Relationships: [];
      };
      cc_rationale_analysis: {
        Row: {
          analyzed_at: string | null;
          articles_analyzed: Json | null;
          boilerplate_score: number | null;
          cc_hot_id: string;
          clarity_score: number | null;
          confidence: number | null;
          contradicts_own_precedent: boolean | null;
          deliberation_quality: number | null;
          finding_severity: string | null;
          id: string;
          interpretation_stance: string | null;
          key_arguments: Json | null;
          logical_structure: string | null;
          model_version: string;
          notable_finding: string | null;
          novel_interpretation: boolean | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationality_score: number | null;
          reciprocity_score: number | null;
        };
        Insert: {
          analyzed_at?: string | null;
          articles_analyzed?: Json | null;
          boilerplate_score?: number | null;
          cc_hot_id: string;
          clarity_score?: number | null;
          confidence?: number | null;
          contradicts_own_precedent?: boolean | null;
          deliberation_quality?: number | null;
          finding_severity?: string | null;
          id?: string;
          interpretation_stance?: string | null;
          key_arguments?: Json | null;
          logical_structure?: string | null;
          model_version: string;
          notable_finding?: string | null;
          novel_interpretation?: boolean | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationality_score?: number | null;
          reciprocity_score?: number | null;
        };
        Update: {
          analyzed_at?: string | null;
          articles_analyzed?: Json | null;
          boilerplate_score?: number | null;
          cc_hot_id?: string;
          clarity_score?: number | null;
          confidence?: number | null;
          contradicts_own_precedent?: boolean | null;
          deliberation_quality?: number | null;
          finding_severity?: string | null;
          id?: string;
          interpretation_stance?: string | null;
          key_arguments?: Json | null;
          logical_structure?: string | null;
          model_version?: string;
          notable_finding?: string | null;
          novel_interpretation?: boolean | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationality_score?: number | null;
          reciprocity_score?: number | null;
        };
        Relationships: [];
      };
      cc_rationales: {
        Row: {
          article_coverage_score: number | null;
          author_name: string | null;
          cc_hot_id: string;
          cited_articles: Json | null;
          conclusion: string | null;
          counterargument_discussion: string | null;
          fetched_at: string | null;
          fidelity_score: number | null;
          internal_vote: Json | null;
          meta_hash: string | null;
          meta_url: string;
          precedent_discussion: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_statement: string | null;
          raw_json: Json | null;
          reasoning_quality_score: number | null;
          scored_at: string | null;
          summary: string | null;
        };
        Insert: {
          article_coverage_score?: number | null;
          author_name?: string | null;
          cc_hot_id: string;
          cited_articles?: Json | null;
          conclusion?: string | null;
          counterargument_discussion?: string | null;
          fetched_at?: string | null;
          fidelity_score?: number | null;
          internal_vote?: Json | null;
          meta_hash?: string | null;
          meta_url: string;
          precedent_discussion?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_statement?: string | null;
          raw_json?: Json | null;
          reasoning_quality_score?: number | null;
          scored_at?: string | null;
          summary?: string | null;
        };
        Update: {
          article_coverage_score?: number | null;
          author_name?: string | null;
          cc_hot_id?: string;
          cited_articles?: Json | null;
          conclusion?: string | null;
          counterargument_discussion?: string | null;
          fetched_at?: string | null;
          fidelity_score?: number | null;
          internal_vote?: Json | null;
          meta_hash?: string | null;
          meta_url?: string;
          precedent_discussion?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationale_statement?: string | null;
          raw_json?: Json | null;
          reasoning_quality_score?: number | null;
          scored_at?: string | null;
          summary?: string | null;
        };
        Relationships: [];
      };
      cc_votes: {
        Row: {
          block_time: number;
          cc_cold_id: string | null;
          cc_hot_id: string;
          epoch: number;
          meta_hash: string | null;
          meta_url: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          tx_hash: string;
          vote: string;
        };
        Insert: {
          block_time: number;
          cc_cold_id?: string | null;
          cc_hot_id: string;
          epoch: number;
          meta_hash?: string | null;
          meta_url?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          tx_hash: string;
          vote: string;
        };
        Update: {
          block_time?: number;
          cc_cold_id?: string | null;
          cc_hot_id?: string;
          epoch?: number;
          meta_hash?: string | null;
          meta_url?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          tx_hash?: string;
          vote?: string;
        };
        Relationships: [];
      };
      cip108_documents: {
        Row: {
          content_hash: string;
          created_at: string;
          document: Json;
          draft_id: string;
          owner_stake_address: string;
        };
        Insert: {
          content_hash: string;
          created_at?: string;
          document: Json;
          draft_id: string;
          owner_stake_address: string;
        };
        Update: {
          content_hash?: string;
          created_at?: string;
          document?: Json;
          draft_id?: string;
          owner_stake_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cip108_documents_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      citizen_assemblies: {
        Row: {
          ai_context: Json | null;
          closes_at: string;
          created_at: string | null;
          description: string | null;
          epoch: number;
          id: string;
          opens_at: string;
          options: Json;
          question: string;
          quorum_threshold: number;
          results: Json | null;
          source: string;
          status: string;
          title: string;
          total_votes: number | null;
          updated_at: string | null;
        };
        Insert: {
          ai_context?: Json | null;
          closes_at: string;
          created_at?: string | null;
          description?: string | null;
          epoch: number;
          id?: string;
          opens_at: string;
          options: Json;
          question: string;
          quorum_threshold?: number;
          results?: Json | null;
          source?: string;
          status?: string;
          title: string;
          total_votes?: number | null;
          updated_at?: string | null;
        };
        Update: {
          ai_context?: Json | null;
          closes_at?: string;
          created_at?: string | null;
          description?: string | null;
          epoch?: number;
          id?: string;
          opens_at?: string;
          options?: Json;
          question?: string;
          quorum_threshold?: number;
          results?: Json | null;
          source?: string;
          status?: string;
          title?: string;
          total_votes?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      citizen_assembly_responses: {
        Row: {
          assembly_id: string;
          created_at: string | null;
          id: string;
          selected_option: string;
          stake_address: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          assembly_id: string;
          created_at?: string | null;
          id?: string;
          selected_option: string;
          stake_address?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          assembly_id?: string;
          created_at?: string | null;
          id?: string;
          selected_option?: string;
          stake_address?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'citizen_assembly_responses_assembly_id_fkey';
            columns: ['assembly_id'];
            isOneToOne: false;
            referencedRelation: 'citizen_assemblies';
            referencedColumns: ['id'];
          },
        ];
      };
      citizen_concern_flags: {
        Row: {
          created_at: string | null;
          flag_type: string;
          id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          stake_address: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          created_at?: string | null;
          flag_type: string;
          id?: string;
          proposal_index: number;
          proposal_tx_hash: string;
          stake_address?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          created_at?: string | null;
          flag_type?: string;
          id?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          stake_address?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      citizen_endorsements: {
        Row: {
          created_at: string;
          endorsement_type: string;
          entity_id: string;
          entity_type: string;
          id: string;
          stake_address: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          created_at?: string;
          endorsement_type: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          stake_address?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          created_at?: string;
          endorsement_type?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          stake_address?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      citizen_epoch_summaries: {
        Row: {
          alignment_drift_score: number | null;
          created_at: string | null;
          delegated_drep_id: string | null;
          delegated_pool_id: string | null;
          drep_score_at_epoch: number | null;
          drep_tier_at_epoch: string | null;
          drep_votes_cast: number | null;
          epoch_no: number;
          id: number;
          proposals_voted_on: number | null;
          spo_score_at_epoch: number | null;
          spo_votes_cast: number | null;
          summary_json: Json | null;
          treasury_allocated_lovelace: number | null;
          user_id: string;
        };
        Insert: {
          alignment_drift_score?: number | null;
          created_at?: string | null;
          delegated_drep_id?: string | null;
          delegated_pool_id?: string | null;
          drep_score_at_epoch?: number | null;
          drep_tier_at_epoch?: string | null;
          drep_votes_cast?: number | null;
          epoch_no: number;
          id?: never;
          proposals_voted_on?: number | null;
          spo_score_at_epoch?: number | null;
          spo_votes_cast?: number | null;
          summary_json?: Json | null;
          treasury_allocated_lovelace?: number | null;
          user_id: string;
        };
        Update: {
          alignment_drift_score?: number | null;
          created_at?: string | null;
          delegated_drep_id?: string | null;
          delegated_pool_id?: string | null;
          drep_score_at_epoch?: number | null;
          drep_tier_at_epoch?: string | null;
          drep_votes_cast?: number | null;
          epoch_no?: number;
          id?: never;
          proposals_voted_on?: number | null;
          spo_score_at_epoch?: number | null;
          spo_votes_cast?: number | null;
          summary_json?: Json | null;
          treasury_allocated_lovelace?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      citizen_impact_scores: {
        Row: {
          coverage_score: number;
          delegation_tenure_score: number;
          engagement_depth_score: number;
          rep_activity_score: number;
          score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          coverage_score?: number;
          delegation_tenure_score?: number;
          engagement_depth_score?: number;
          rep_activity_score?: number;
          score?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          coverage_score?: number;
          delegation_tenure_score?: number;
          engagement_depth_score?: number;
          rep_activity_score?: number;
          score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      citizen_impact_tags: {
        Row: {
          awareness: string;
          comment: string | null;
          created_at: string | null;
          id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          rating: string;
          stake_address: string | null;
          updated_at: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          awareness: string;
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          proposal_index: number;
          proposal_tx_hash: string;
          rating: string;
          stake_address?: string | null;
          updated_at?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          awareness?: string;
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rating?: string;
          stake_address?: string | null;
          updated_at?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      citizen_milestones: {
        Row: {
          achieved_at: string;
          epoch: number | null;
          id: string;
          metadata: Json | null;
          milestone_key: string;
          milestone_label: string | null;
          user_id: string;
        };
        Insert: {
          achieved_at?: string;
          epoch?: number | null;
          id?: string;
          metadata?: Json | null;
          milestone_key: string;
          milestone_label?: string | null;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          epoch?: number | null;
          id?: string;
          metadata?: Json | null;
          milestone_key?: string;
          milestone_label?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      citizen_priority_rankings: {
        Row: {
          computed_at: string | null;
          epoch: number;
          id: string;
          rankings: Json;
          total_voters: number;
        };
        Insert: {
          computed_at?: string | null;
          epoch: number;
          id?: string;
          rankings: Json;
          total_voters?: number;
        };
        Update: {
          computed_at?: string | null;
          epoch?: number;
          id?: string;
          rankings?: Json;
          total_voters?: number;
        };
        Relationships: [];
      };
      citizen_priority_signals: {
        Row: {
          created_at: string | null;
          epoch: number;
          id: string;
          ranked_priorities: string[];
          stake_address: string | null;
          updated_at: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          created_at?: string | null;
          epoch: number;
          id?: string;
          ranked_priorities: string[];
          stake_address?: string | null;
          updated_at?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          created_at?: string | null;
          epoch?: number;
          id?: string;
          ranked_priorities?: string[];
          stake_address?: string | null;
          updated_at?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      citizen_proposal_followups: {
        Row: {
          created_at: string;
          id: string;
          notified: boolean;
          outcome: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          sentiment: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notified?: boolean;
          outcome?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          sentiment: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notified?: boolean;
          outcome?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          sentiment?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'citizen_proposal_followups_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      citizen_ring_snapshots: {
        Row: {
          coverage_ring: number;
          created_at: string | null;
          delegation_ring: number;
          engagement_ring: number;
          epoch: number;
          id: string;
          pulse: number;
          user_id: string;
        };
        Insert: {
          coverage_ring: number;
          created_at?: string | null;
          delegation_ring: number;
          engagement_ring: number;
          epoch: number;
          id?: string;
          pulse: number;
          user_id: string;
        };
        Update: {
          coverage_ring?: number;
          created_at?: string | null;
          delegation_ring?: number;
          engagement_ring?: number;
          epoch?: number;
          id?: string;
          pulse?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      citizen_sentiment: {
        Row: {
          created_at: string | null;
          delegated_drep_id: string | null;
          id: string;
          initial_sentiment: string;
          proposal_index: number;
          proposal_tx_hash: string;
          sentiment: string;
          stake_address: string | null;
          updated_at: string | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          created_at?: string | null;
          delegated_drep_id?: string | null;
          id?: string;
          initial_sentiment: string;
          proposal_index: number;
          proposal_tx_hash: string;
          sentiment: string;
          stake_address?: string | null;
          updated_at?: string | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          created_at?: string | null;
          delegated_drep_id?: string | null;
          id?: string;
          initial_sentiment?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          sentiment?: string;
          stake_address?: string | null;
          updated_at?: string | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
      classification_history: {
        Row: {
          classified_at: string;
          classifier_version: string;
          dim_decentralization: number;
          dim_innovation: number;
          dim_security: number;
          dim_transparency: number;
          dim_treasury_conservative: number;
          dim_treasury_growth: number;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Insert: {
          classified_at?: string;
          classifier_version?: string;
          dim_decentralization: number;
          dim_innovation: number;
          dim_security: number;
          dim_transparency: number;
          dim_treasury_conservative: number;
          dim_treasury_growth: number;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Update: {
          classified_at?: string;
          classifier_version?: string;
          dim_decentralization?: number;
          dim_innovation?: number;
          dim_security?: number;
          dim_transparency?: number;
          dim_treasury_conservative?: number;
          dim_treasury_growth?: number;
          proposal_index?: number;
          proposal_tx_hash?: string;
        };
        Relationships: [];
      };
      committee_members: {
        Row: {
          anchor_hash: string | null;
          anchor_url: string | null;
          cc_cold_id: string | null;
          cc_hot_id: string;
          expiration_epoch: number | null;
          last_synced_at: string;
          start_epoch: number | null;
          status: string;
        };
        Insert: {
          anchor_hash?: string | null;
          anchor_url?: string | null;
          cc_cold_id?: string | null;
          cc_hot_id: string;
          expiration_epoch?: number | null;
          last_synced_at?: string;
          start_epoch?: number | null;
          status?: string;
        };
        Update: {
          anchor_hash?: string | null;
          anchor_url?: string | null;
          cc_cold_id?: string | null;
          cc_hot_id?: string;
          expiration_epoch?: number | null;
          last_synced_at?: string;
          start_epoch?: number | null;
          status?: string;
        };
        Relationships: [];
      };
      community_intelligence_snapshots: {
        Row: {
          computed_at: string;
          data: Json;
          epoch: number;
          id: number;
          snapshot_type: string;
        };
        Insert: {
          computed_at?: string;
          data?: Json;
          epoch: number;
          id?: number;
          snapshot_type: string;
        };
        Update: {
          computed_at?: string;
          data?: Json;
          epoch?: number;
          id?: number;
          snapshot_type?: string;
        };
        Relationships: [];
      };
      decentralization_snapshots: {
        Row: {
          active_drep_count: number | null;
          composite_score: number;
          concentration_ratio: number;
          epoch_no: number;
          gini: number;
          hhi: number;
          nakamoto_coefficient: number;
          shannon_entropy: number;
          snapshot_at: string | null;
          tau_decentralization: number;
          theil_index: number;
          total_delegated_ada: number | null;
        };
        Insert: {
          active_drep_count?: number | null;
          composite_score: number;
          concentration_ratio: number;
          epoch_no: number;
          gini: number;
          hhi: number;
          nakamoto_coefficient: number;
          shannon_entropy: number;
          snapshot_at?: string | null;
          tau_decentralization: number;
          theil_index: number;
          total_delegated_ada?: number | null;
        };
        Update: {
          active_drep_count?: number | null;
          composite_score?: number;
          concentration_ratio?: number;
          epoch_no?: number;
          gini?: number;
          hhi?: number;
          nakamoto_coefficient?: number;
          shannon_entropy?: number;
          snapshot_at?: string | null;
          tau_decentralization?: number;
          theil_index?: number;
          total_delegated_ada?: number | null;
        };
        Relationships: [];
      };
      decision_journal_entries: {
        Row: {
          confidence: number;
          created_at: string;
          id: string;
          key_assumptions: string;
          position: string;
          position_history: Json;
          proposal_index: number;
          proposal_tx_hash: string;
          steelman_text: string;
          updated_at: string;
          user_id: string;
          what_would_change_mind: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          id?: string;
          key_assumptions?: string;
          position?: string;
          position_history?: Json;
          proposal_index: number;
          proposal_tx_hash: string;
          steelman_text?: string;
          updated_at?: string;
          user_id: string;
          what_would_change_mind?: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          id?: string;
          key_assumptions?: string;
          position?: string;
          position_history?: Json;
          proposal_index?: number;
          proposal_tx_hash?: string;
          steelman_text?: string;
          updated_at?: string;
          user_id?: string;
          what_would_change_mind?: string;
        };
        Relationships: [];
      };
      delegation_snapshots: {
        Row: {
          delegator_count: number;
          drep_id: string;
          epoch: number;
          lost_delegators: number | null;
          new_delegators: number | null;
          snapshot_at: string;
          top_10_delegator_pct: number | null;
          total_power_lovelace: number;
        };
        Insert: {
          delegator_count: number;
          drep_id: string;
          epoch: number;
          lost_delegators?: number | null;
          new_delegators?: number | null;
          snapshot_at?: string;
          top_10_delegator_pct?: number | null;
          total_power_lovelace: number;
        };
        Update: {
          delegator_count?: number;
          drep_id?: string;
          epoch?: number;
          lost_delegators?: number | null;
          new_delegators?: number | null;
          snapshot_at?: string;
          top_10_delegator_pct?: number | null;
          total_power_lovelace?: number;
        };
        Relationships: [];
      };
      draft_review_responses: {
        Row: {
          created_at: string;
          id: string;
          response_text: string;
          response_type: string;
          review_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          response_text?: string;
          response_type: string;
          review_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          response_text?: string;
          response_type?: string;
          review_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'draft_review_responses_review_id_fkey';
            columns: ['review_id'];
            isOneToOne: false;
            referencedRelation: 'draft_reviews';
            referencedColumns: ['id'];
          },
        ];
      };
      draft_reviews: {
        Row: {
          constitutional_score: number | null;
          created_at: string;
          draft_id: string;
          feasibility_score: number | null;
          feedback_text: string;
          feedback_themes: string[];
          id: string;
          impact_score: number | null;
          reviewed_at_version: number | null;
          reviewer_stake_address: string;
          reviewer_user_id: string | null;
          value_score: number | null;
        };
        Insert: {
          constitutional_score?: number | null;
          created_at?: string;
          draft_id: string;
          feasibility_score?: number | null;
          feedback_text?: string;
          feedback_themes?: string[];
          id?: string;
          impact_score?: number | null;
          reviewed_at_version?: number | null;
          reviewer_stake_address: string;
          reviewer_user_id?: string | null;
          value_score?: number | null;
        };
        Update: {
          constitutional_score?: number | null;
          created_at?: string;
          draft_id?: string;
          feasibility_score?: number | null;
          feedback_text?: string;
          feedback_themes?: string[];
          id?: string;
          impact_score?: number | null;
          reviewed_at_version?: number | null;
          reviewer_stake_address?: string;
          reviewer_user_id?: string | null;
          value_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'draft_reviews_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      drep_delegator_snapshots: {
        Row: {
          amount_lovelace: number;
          drep_id: string;
          epoch_no: number;
          id: number;
          snapshot_at: string;
          stake_address: string;
        };
        Insert: {
          amount_lovelace?: number;
          drep_id: string;
          epoch_no: number;
          id?: never;
          snapshot_at?: string;
          stake_address: string;
        };
        Update: {
          amount_lovelace?: number;
          drep_id?: string;
          epoch_no?: number;
          id?: never;
          snapshot_at?: string;
          stake_address?: string;
        };
        Relationships: [];
      };
      drep_epoch_updates: {
        Row: {
          drep_id: string;
          epoch: number;
          generated_at: string;
          proposals_voted: Json | null;
          rationale_count: number;
          update_text: string;
          vote_count: number;
        };
        Insert: {
          drep_id: string;
          epoch: number;
          generated_at?: string;
          proposals_voted?: Json | null;
          rationale_count?: number;
          update_text: string;
          vote_count?: number;
        };
        Update: {
          drep_id?: string;
          epoch?: number;
          generated_at?: string;
          proposals_voted?: Json | null;
          rationale_count?: number;
          update_text?: string;
          vote_count?: number;
        };
        Relationships: [];
      };
      drep_lifecycle_events: {
        Row: {
          action: string;
          anchor_hash: string | null;
          anchor_url: string | null;
          block_time: number | null;
          created_at: string;
          deposit: string | null;
          drep_id: string;
          epoch_no: number;
          id: number;
          tx_hash: string;
        };
        Insert: {
          action: string;
          anchor_hash?: string | null;
          anchor_url?: string | null;
          block_time?: number | null;
          created_at?: string;
          deposit?: string | null;
          drep_id: string;
          epoch_no: number;
          id?: never;
          tx_hash: string;
        };
        Update: {
          action?: string;
          anchor_hash?: string | null;
          anchor_url?: string | null;
          block_time?: number | null;
          created_at?: string;
          deposit?: string | null;
          drep_id?: string;
          epoch_no?: number;
          id?: never;
          tx_hash?: string;
        };
        Relationships: [];
      };
      drep_milestones: {
        Row: {
          achieved_at: string;
          drep_id: string;
          milestone_key: string;
        };
        Insert: {
          achieved_at?: string;
          drep_id: string;
          milestone_key: string;
        };
        Update: {
          achieved_at?: string;
          drep_id?: string;
          milestone_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drep_milestones_drep_id_fkey';
            columns: ['drep_id'];
            isOneToOne: false;
            referencedRelation: 'dreps';
            referencedColumns: ['id'];
          },
        ];
      };
      drep_pca_coordinates: {
        Row: {
          coordinates: number[];
          drep_id: string;
          run_id: string;
          updated_at: string | null;
        };
        Insert: {
          coordinates: number[];
          drep_id: string;
          run_id: string;
          updated_at?: string | null;
        };
        Update: {
          coordinates?: number[];
          drep_id?: string;
          run_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'drep_pca_coordinates_run_id_fkey';
            columns: ['run_id'];
            isOneToOne: false;
            referencedRelation: 'pca_results';
            referencedColumns: ['run_id'];
          },
        ];
      };
      drep_power_snapshots: {
        Row: {
          amount_lovelace: number;
          created_at: string | null;
          delegator_count: number | null;
          drep_id: string;
          epoch_no: number;
        };
        Insert: {
          amount_lovelace: number;
          created_at?: string | null;
          delegator_count?: number | null;
          drep_id: string;
          epoch_no: number;
        };
        Update: {
          amount_lovelace?: number;
          created_at?: string | null;
          delegator_count?: number | null;
          drep_id?: string;
          epoch_no?: number;
        };
        Relationships: [];
      };
      drep_questions: {
        Row: {
          asker_wallet: string;
          created_at: string | null;
          drep_id: string;
          id: string;
          proposal_index: number | null;
          proposal_tx_hash: string | null;
          question_text: string;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          asker_wallet: string;
          created_at?: string | null;
          drep_id: string;
          id?: string;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          question_text: string;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          asker_wallet?: string;
          created_at?: string | null;
          drep_id?: string;
          id?: string;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          question_text?: string;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      drep_responses: {
        Row: {
          created_at: string | null;
          drep_id: string;
          id: string;
          question_id: string | null;
          response_text: string;
        };
        Insert: {
          created_at?: string | null;
          drep_id: string;
          id?: string;
          question_id?: string | null;
          response_text: string;
        };
        Update: {
          created_at?: string | null;
          drep_id?: string;
          id?: string;
          question_id?: string | null;
          response_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drep_responses_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'drep_questions';
            referencedColumns: ['id'];
          },
        ];
      };
      drep_score_history: {
        Row: {
          created_at: string | null;
          drep_id: string;
          effective_participation: number;
          effective_participation_v3: number | null;
          effective_participation_v3_raw: number | null;
          engagement_quality: number | null;
          engagement_quality_raw: number | null;
          epoch_no: number | null;
          governance_identity: number | null;
          governance_identity_raw: number | null;
          id: string;
          profile_completeness: number;
          rationale_rate: number;
          reliability_score: number;
          reliability_v3: number | null;
          reliability_v3_raw: number | null;
          score: number;
          score_momentum: number | null;
          score_version: string | null;
          snapshot_date: string;
        };
        Insert: {
          created_at?: string | null;
          drep_id: string;
          effective_participation?: number;
          effective_participation_v3?: number | null;
          effective_participation_v3_raw?: number | null;
          engagement_quality?: number | null;
          engagement_quality_raw?: number | null;
          epoch_no?: number | null;
          governance_identity?: number | null;
          governance_identity_raw?: number | null;
          id?: string;
          profile_completeness?: number;
          rationale_rate?: number;
          reliability_score?: number;
          reliability_v3?: number | null;
          reliability_v3_raw?: number | null;
          score?: number;
          score_momentum?: number | null;
          score_version?: string | null;
          snapshot_date?: string;
        };
        Update: {
          created_at?: string | null;
          drep_id?: string;
          effective_participation?: number;
          effective_participation_v3?: number | null;
          effective_participation_v3_raw?: number | null;
          engagement_quality?: number | null;
          engagement_quality_raw?: number | null;
          epoch_no?: number | null;
          governance_identity?: number | null;
          governance_identity_raw?: number | null;
          id?: string;
          profile_completeness?: number;
          rationale_rate?: number;
          reliability_score?: number;
          reliability_v3?: number | null;
          reliability_v3_raw?: number | null;
          score?: number;
          score_momentum?: number | null;
          score_version?: string | null;
          snapshot_date?: string;
        };
        Relationships: [];
      };
      drep_votes: {
        Row: {
          block_time: number;
          created_at: string | null;
          drep_id: string;
          embedding_originality: number | null;
          embedding_proposal_relevance: number | null;
          epoch_no: number | null;
          meta_hash: string | null;
          meta_url: string | null;
          power_source: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_ai_summary: string | null;
          rationale_proposal_awareness: number | null;
          rationale_quality: number | null;
          rationale_reasoning_depth: number | null;
          rationale_specificity: number | null;
          vote: string;
          vote_tx_hash: string;
          voting_power_lovelace: number | null;
        };
        Insert: {
          block_time: number;
          created_at?: string | null;
          drep_id: string;
          embedding_originality?: number | null;
          embedding_proposal_relevance?: number | null;
          epoch_no?: number | null;
          meta_hash?: string | null;
          meta_url?: string | null;
          power_source?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_ai_summary?: string | null;
          rationale_proposal_awareness?: number | null;
          rationale_quality?: number | null;
          rationale_reasoning_depth?: number | null;
          rationale_specificity?: number | null;
          vote: string;
          vote_tx_hash: string;
          voting_power_lovelace?: number | null;
        };
        Update: {
          block_time?: number;
          created_at?: string | null;
          drep_id?: string;
          embedding_originality?: number | null;
          embedding_proposal_relevance?: number | null;
          epoch_no?: number | null;
          meta_hash?: string | null;
          meta_url?: string | null;
          power_source?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationale_ai_summary?: string | null;
          rationale_proposal_awareness?: number | null;
          rationale_quality?: number | null;
          rationale_reasoning_depth?: number | null;
          rationale_specificity?: number | null;
          vote?: string;
          vote_tx_hash?: string;
          voting_power_lovelace?: number | null;
        };
        Relationships: [];
      };
      dreps: {
        Row: {
          alignment_decentralization: number | null;
          alignment_decentralization_raw: number | null;
          alignment_innovation: number | null;
          alignment_innovation_raw: number | null;
          alignment_security: number | null;
          alignment_security_raw: number | null;
          alignment_transparency: number | null;
          alignment_transparency_raw: number | null;
          alignment_treasury_conservative: number | null;
          alignment_treasury_conservative_raw: number | null;
          alignment_treasury_growth: number | null;
          alignment_treasury_growth_raw: number | null;
          anchor_hash: string | null;
          anchor_url: string | null;
          confidence: number | null;
          current_tier: string | null;
          deliberation_modifier: number | null;
          effective_participation: number | null;
          effective_participation_v3: number | null;
          effective_participation_v3_raw: number | null;
          embedding_philosophy_coherence: number | null;
          engagement_quality: number | null;
          engagement_quality_raw: number | null;
          governance_identity: number | null;
          governance_identity_raw: number | null;
          id: string;
          info: Json | null;
          last_personality_label: string | null;
          last_vote_time: number | null;
          metadata: Json | null;
          metadata_hash_verified: boolean | null;
          participation_rate: number | null;
          profile_completeness: number | null;
          profile_last_changed_at: string | null;
          profile_metadata_hash: string | null;
          rationale_rate: number | null;
          reliability_longest_gap: number | null;
          reliability_recency: number | null;
          reliability_score: number | null;
          reliability_streak: number | null;
          reliability_tenure: number | null;
          reliability_v3: number | null;
          reliability_v3_raw: number | null;
          score: number | null;
          score_momentum: number | null;
          score_version: string | null;
          size_tier: string | null;
          spotlight_narrative: string | null;
          spotlight_narrative_generated_at: string | null;
          updated_at: string | null;
          votes: Json[] | null;
        };
        Insert: {
          alignment_decentralization?: number | null;
          alignment_decentralization_raw?: number | null;
          alignment_innovation?: number | null;
          alignment_innovation_raw?: number | null;
          alignment_security?: number | null;
          alignment_security_raw?: number | null;
          alignment_transparency?: number | null;
          alignment_transparency_raw?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_conservative_raw?: number | null;
          alignment_treasury_growth?: number | null;
          alignment_treasury_growth_raw?: number | null;
          anchor_hash?: string | null;
          anchor_url?: string | null;
          confidence?: number | null;
          current_tier?: string | null;
          deliberation_modifier?: number | null;
          effective_participation?: number | null;
          effective_participation_v3?: number | null;
          effective_participation_v3_raw?: number | null;
          embedding_philosophy_coherence?: number | null;
          engagement_quality?: number | null;
          engagement_quality_raw?: number | null;
          governance_identity?: number | null;
          governance_identity_raw?: number | null;
          id: string;
          info?: Json | null;
          last_personality_label?: string | null;
          last_vote_time?: number | null;
          metadata?: Json | null;
          metadata_hash_verified?: boolean | null;
          participation_rate?: number | null;
          profile_completeness?: number | null;
          profile_last_changed_at?: string | null;
          profile_metadata_hash?: string | null;
          rationale_rate?: number | null;
          reliability_longest_gap?: number | null;
          reliability_recency?: number | null;
          reliability_score?: number | null;
          reliability_streak?: number | null;
          reliability_tenure?: number | null;
          reliability_v3?: number | null;
          reliability_v3_raw?: number | null;
          score?: number | null;
          score_momentum?: number | null;
          score_version?: string | null;
          size_tier?: string | null;
          spotlight_narrative?: string | null;
          spotlight_narrative_generated_at?: string | null;
          updated_at?: string | null;
          votes?: Json[] | null;
        };
        Update: {
          alignment_decentralization?: number | null;
          alignment_decentralization_raw?: number | null;
          alignment_innovation?: number | null;
          alignment_innovation_raw?: number | null;
          alignment_security?: number | null;
          alignment_security_raw?: number | null;
          alignment_transparency?: number | null;
          alignment_transparency_raw?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_conservative_raw?: number | null;
          alignment_treasury_growth?: number | null;
          alignment_treasury_growth_raw?: number | null;
          anchor_hash?: string | null;
          anchor_url?: string | null;
          confidence?: number | null;
          current_tier?: string | null;
          deliberation_modifier?: number | null;
          effective_participation?: number | null;
          effective_participation_v3?: number | null;
          effective_participation_v3_raw?: number | null;
          embedding_philosophy_coherence?: number | null;
          engagement_quality?: number | null;
          engagement_quality_raw?: number | null;
          governance_identity?: number | null;
          governance_identity_raw?: number | null;
          id?: string;
          info?: Json | null;
          last_personality_label?: string | null;
          last_vote_time?: number | null;
          metadata?: Json | null;
          metadata_hash_verified?: boolean | null;
          participation_rate?: number | null;
          profile_completeness?: number | null;
          profile_last_changed_at?: string | null;
          profile_metadata_hash?: string | null;
          rationale_rate?: number | null;
          reliability_longest_gap?: number | null;
          reliability_recency?: number | null;
          reliability_score?: number | null;
          reliability_streak?: number | null;
          reliability_tenure?: number | null;
          reliability_v3?: number | null;
          reliability_v3_raw?: number | null;
          score?: number | null;
          score_momentum?: number | null;
          score_version?: string | null;
          size_tier?: string | null;
          spotlight_narrative?: string | null;
          spotlight_narrative_generated_at?: string | null;
          updated_at?: string | null;
          votes?: Json[] | null;
        };
        Relationships: [];
      };
      embeddings: {
        Row: {
          content_hash: string;
          created_at: string | null;
          embedding: string;
          entity_id: string;
          entity_type: string;
          id: string;
          input_token_count: number | null;
          model_used: string;
          updated_at: string | null;
        };
        Insert: {
          content_hash: string;
          created_at?: string | null;
          embedding: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          input_token_count?: number | null;
          model_used?: string;
          updated_at?: string | null;
        };
        Update: {
          content_hash?: string;
          created_at?: string | null;
          embedding?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          input_token_count?: number | null;
          model_used?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      encrypted_api_keys: {
        Row: {
          created_at: string;
          encrypted_key: string;
          id: string;
          key_prefix: string;
          provider: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          encrypted_key: string;
          id?: string;
          key_prefix?: string;
          provider?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          encrypted_key?: string;
          id?: string;
          key_prefix?: string;
          provider?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      engagement_signal_aggregations: {
        Row: {
          computed_at: string | null;
          data: Json;
          entity_id: string;
          entity_type: string;
          epoch: number | null;
          id: string;
          signal_type: string;
        };
        Insert: {
          computed_at?: string | null;
          data: Json;
          entity_id: string;
          entity_type: string;
          epoch?: number | null;
          id?: string;
          signal_type: string;
        };
        Update: {
          computed_at?: string | null;
          data?: Json;
          entity_id?: string;
          entity_type?: string;
          epoch?: number | null;
          id?: string;
          signal_type?: string;
        };
        Relationships: [];
      };
      epoch_governance_summaries: {
        Row: {
          active_dreps: number | null;
          active_stake_lovelace: number | null;
          block_count: number | null;
          epoch_no: number;
          fees_lovelace: number | null;
          snapshot_at: string;
          total_dreps: number | null;
          total_proposals: number | null;
          total_votes: number | null;
          total_voting_power_lovelace: number | null;
          tx_count: number | null;
        };
        Insert: {
          active_dreps?: number | null;
          active_stake_lovelace?: number | null;
          block_count?: number | null;
          epoch_no: number;
          fees_lovelace?: number | null;
          snapshot_at?: string;
          total_dreps?: number | null;
          total_proposals?: number | null;
          total_votes?: number | null;
          total_voting_power_lovelace?: number | null;
          tx_count?: number | null;
        };
        Update: {
          active_dreps?: number | null;
          active_stake_lovelace?: number | null;
          block_count?: number | null;
          epoch_no?: number;
          fees_lovelace?: number | null;
          snapshot_at?: string;
          total_dreps?: number | null;
          total_proposals?: number | null;
          total_votes?: number | null;
          total_voting_power_lovelace?: number | null;
          tx_count?: number | null;
        };
        Relationships: [];
      };
      epoch_recaps: {
        Row: {
          ai_narrative: string | null;
          computed_at: string | null;
          drep_participation_pct: number | null;
          epoch: number;
          proposals_dropped: number | null;
          proposals_expired: number | null;
          proposals_ratified: number | null;
          proposals_submitted: number | null;
          treasury_withdrawn_ada: number | null;
        };
        Insert: {
          ai_narrative?: string | null;
          computed_at?: string | null;
          drep_participation_pct?: number | null;
          epoch: number;
          proposals_dropped?: number | null;
          proposals_expired?: number | null;
          proposals_ratified?: number | null;
          proposals_submitted?: number | null;
          treasury_withdrawn_ada?: number | null;
        };
        Update: {
          ai_narrative?: string | null;
          computed_at?: string | null;
          drep_participation_pct?: number | null;
          epoch?: number;
          proposals_dropped?: number | null;
          proposals_expired?: number | null;
          proposals_ratified?: number | null;
          proposals_submitted?: number | null;
          treasury_withdrawn_ada?: number | null;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          category: string | null;
          created_at: string | null;
          description: string | null;
          enabled: boolean;
          key: string;
          targeting: Json | null;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          enabled?: boolean;
          key: string;
          targeting?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          enabled?: boolean;
          key?: string;
          targeting?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ghi_snapshots: {
        Row: {
          band: string;
          components: Json;
          computed_at: string | null;
          epoch_no: number;
          narrative: string | null;
          score: number;
        };
        Insert: {
          band: string;
          components: Json;
          computed_at?: string | null;
          epoch_no: number;
          narrative?: string | null;
          score: number;
        };
        Update: {
          band?: string;
          components?: Json;
          computed_at?: string | null;
          epoch_no?: number;
          narrative?: string | null;
          score?: number;
        };
        Relationships: [];
      };
      governance_benchmarks: {
        Row: {
          ai_insight: string | null;
          avg_rationale_rate: number | null;
          chain: string;
          delegate_count: number | null;
          fetched_at: string | null;
          governance_score: number | null;
          grade: string | null;
          id: string;
          participation_rate: number | null;
          period_label: string;
          proposal_count: number | null;
          proposal_throughput: number | null;
          raw_data: Json | null;
        };
        Insert: {
          ai_insight?: string | null;
          avg_rationale_rate?: number | null;
          chain: string;
          delegate_count?: number | null;
          fetched_at?: string | null;
          governance_score?: number | null;
          grade?: string | null;
          id?: string;
          participation_rate?: number | null;
          period_label: string;
          proposal_count?: number | null;
          proposal_throughput?: number | null;
          raw_data?: Json | null;
        };
        Update: {
          ai_insight?: string | null;
          avg_rationale_rate?: number | null;
          chain?: string;
          delegate_count?: number | null;
          fetched_at?: string | null;
          governance_score?: number | null;
          grade?: string | null;
          id?: string;
          participation_rate?: number | null;
          period_label?: string;
          proposal_count?: number | null;
          proposal_throughput?: number | null;
          raw_data?: Json | null;
        };
        Relationships: [];
      };
      governance_briefs: {
        Row: {
          brief_type: string;
          content_json: Json;
          created_at: string | null;
          delivered_channels: string[] | null;
          epoch: number | null;
          id: string;
          rendered_html: string | null;
          user_id: string | null;
          wallet_address: string;
        };
        Insert: {
          brief_type: string;
          content_json: Json;
          created_at?: string | null;
          delivered_channels?: string[] | null;
          epoch?: number | null;
          id?: string;
          rendered_html?: string | null;
          user_id?: string | null;
          wallet_address: string;
        };
        Update: {
          brief_type?: string;
          content_json?: Json;
          created_at?: string | null;
          delivered_channels?: string[] | null;
          epoch?: number | null;
          id?: string;
          rendered_html?: string | null;
          user_id?: string | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'governance_briefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      governance_epoch_stats: {
        Row: {
          active_dreps: number | null;
          avg_drep_score: number | null;
          computed_at: string | null;
          epoch_no: number;
          participation_rate: number | null;
          proposals_dropped: number | null;
          proposals_expired: number | null;
          proposals_ratified: number | null;
          proposals_submitted: number | null;
          rationale_rate: number | null;
          total_delegated_ada_lovelace: string | null;
          total_dreps: number | null;
          total_proposals: number | null;
        };
        Insert: {
          active_dreps?: number | null;
          avg_drep_score?: number | null;
          computed_at?: string | null;
          epoch_no: number;
          participation_rate?: number | null;
          proposals_dropped?: number | null;
          proposals_expired?: number | null;
          proposals_ratified?: number | null;
          proposals_submitted?: number | null;
          rationale_rate?: number | null;
          total_delegated_ada_lovelace?: string | null;
          total_dreps?: number | null;
          total_proposals?: number | null;
        };
        Update: {
          active_dreps?: number | null;
          avg_drep_score?: number | null;
          computed_at?: string | null;
          epoch_no?: number;
          participation_rate?: number | null;
          proposals_dropped?: number | null;
          proposals_expired?: number | null;
          proposals_ratified?: number | null;
          proposals_submitted?: number | null;
          rationale_rate?: number | null;
          total_delegated_ada_lovelace?: string | null;
          total_dreps?: number | null;
          total_proposals?: number | null;
        };
        Relationships: [];
      };
      governance_events: {
        Row: {
          created_at: string | null;
          epoch: number | null;
          event_data: Json | null;
          event_type: string;
          id: number;
          related_drep_id: string | null;
          related_proposal_index: number | null;
          related_proposal_tx_hash: string | null;
          user_id: string | null;
          wallet_address: string;
        };
        Insert: {
          created_at?: string | null;
          epoch?: number | null;
          event_data?: Json | null;
          event_type: string;
          id?: number;
          related_drep_id?: string | null;
          related_proposal_index?: number | null;
          related_proposal_tx_hash?: string | null;
          user_id?: string | null;
          wallet_address: string;
        };
        Update: {
          created_at?: string | null;
          epoch?: number | null;
          event_data?: Json | null;
          event_type?: string;
          id?: number;
          related_drep_id?: string | null;
          related_proposal_index?: number | null;
          related_proposal_tx_hash?: string | null;
          user_id?: string | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'governance_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      governance_participation_snapshots: {
        Row: {
          active_drep_count: number;
          avg_rationale_length: number | null;
          avg_vote_delay_epochs: number | null;
          epoch: number;
          participation_rate: number;
          rationale_rate: number | null;
          snapshot_at: string;
          total_drep_count: number;
          total_voting_power_lovelace: number | null;
        };
        Insert: {
          active_drep_count: number;
          avg_rationale_length?: number | null;
          avg_vote_delay_epochs?: number | null;
          epoch: number;
          participation_rate: number;
          rationale_rate?: number | null;
          snapshot_at?: string;
          total_drep_count: number;
          total_voting_power_lovelace?: number | null;
        };
        Update: {
          active_drep_count?: number;
          avg_rationale_length?: number | null;
          avg_vote_delay_epochs?: number | null;
          epoch?: number;
          participation_rate?: number;
          rationale_rate?: number | null;
          snapshot_at?: string;
          total_drep_count?: number;
          total_voting_power_lovelace?: number | null;
        };
        Relationships: [];
      };
      governance_philosophy: {
        Row: {
          anchor_hash: string | null;
          drep_id: string;
          philosophy_text: string;
          updated_at: string | null;
        };
        Insert: {
          anchor_hash?: string | null;
          drep_id: string;
          philosophy_text: string;
          updated_at?: string | null;
        };
        Update: {
          anchor_hash?: string | null;
          drep_id?: string;
          philosophy_text?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      governance_reports: {
        Row: {
          epoch: number;
          generated_at: string;
          narrative: string | null;
          report_data: Json;
        };
        Insert: {
          epoch: number;
          generated_at?: string;
          narrative?: string | null;
          report_data?: Json;
        };
        Update: {
          epoch?: number;
          generated_at?: string;
          narrative?: string | null;
          report_data?: Json;
        };
        Relationships: [];
      };
      governance_stats: {
        Row: {
          circulating_supply_lovelace: number | null;
          current_epoch: number | null;
          epoch_end_time: string | null;
          id: number;
          treasury_balance_lovelace: number | null;
          treasury_balance_updated_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          circulating_supply_lovelace?: number | null;
          current_epoch?: number | null;
          epoch_end_time?: string | null;
          id?: number;
          treasury_balance_lovelace?: number | null;
          treasury_balance_updated_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          circulating_supply_lovelace?: number | null;
          current_epoch?: number | null;
          epoch_end_time?: string | null;
          id?: number;
          treasury_balance_lovelace?: number | null;
          treasury_balance_updated_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      governance_wrapped: {
        Row: {
          data: Json;
          entity_id: string;
          entity_type: string;
          generated_at: string;
          id: string;
          period_id: string;
          period_type: string;
        };
        Insert: {
          data?: Json;
          entity_id: string;
          entity_type: string;
          generated_at?: string;
          id?: string;
          period_id: string;
          period_type: string;
        };
        Update: {
          data?: Json;
          entity_id?: string;
          entity_type?: string;
          generated_at?: string;
          id?: string;
          period_id?: string;
          period_type?: string;
        };
        Relationships: [];
      };
      integrity_snapshots: {
        Row: {
          ai_proposal_pct: number | null;
          ai_rationale_pct: number | null;
          canonical_summary_pct: number | null;
          created_at: string | null;
          hash_mismatch_rate_pct: number | null;
          id: number;
          metrics_json: Json | null;
          snapshot_date: string;
          total_dreps: number | null;
          total_proposals: number | null;
          total_rationales: number | null;
          total_votes: number | null;
          vote_power_coverage_pct: number | null;
        };
        Insert: {
          ai_proposal_pct?: number | null;
          ai_rationale_pct?: number | null;
          canonical_summary_pct?: number | null;
          created_at?: string | null;
          hash_mismatch_rate_pct?: number | null;
          id?: number;
          metrics_json?: Json | null;
          snapshot_date: string;
          total_dreps?: number | null;
          total_proposals?: number | null;
          total_rationales?: number | null;
          total_votes?: number | null;
          vote_power_coverage_pct?: number | null;
        };
        Update: {
          ai_proposal_pct?: number | null;
          ai_rationale_pct?: number | null;
          canonical_summary_pct?: number | null;
          created_at?: string | null;
          hash_mismatch_rate_pct?: number | null;
          id?: number;
          metrics_json?: Json | null;
          snapshot_date?: string;
          total_dreps?: number | null;
          total_proposals?: number | null;
          total_rationales?: number | null;
          total_votes?: number | null;
          vote_power_coverage_pct?: number | null;
        };
        Relationships: [];
      };
      inter_body_alignment: {
        Row: {
          alignment_score: number | null;
          cc_no_pct: number | null;
          cc_yes_pct: number | null;
          computed_at: string | null;
          drep_no_pct: number | null;
          drep_yes_pct: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
          spo_no_pct: number | null;
          spo_yes_pct: number | null;
        };
        Insert: {
          alignment_score?: number | null;
          cc_no_pct?: number | null;
          cc_yes_pct?: number | null;
          computed_at?: string | null;
          drep_no_pct?: number | null;
          drep_yes_pct?: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
          spo_no_pct?: number | null;
          spo_yes_pct?: number | null;
        };
        Update: {
          alignment_score?: number | null;
          cc_no_pct?: number | null;
          cc_yes_pct?: number | null;
          computed_at?: string | null;
          drep_no_pct?: number | null;
          drep_yes_pct?: number | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          spo_no_pct?: number | null;
          spo_yes_pct?: number | null;
        };
        Relationships: [];
      };
      inter_body_alignment_snapshots: {
        Row: {
          alignment_score: number;
          cc_no_pct: number;
          cc_total: number;
          cc_yes_pct: number;
          drep_no_pct: number;
          drep_total: number;
          drep_yes_pct: number;
          epoch: number;
          proposal_index: number;
          proposal_tx_hash: string;
          snapshot_at: string;
          spo_no_pct: number;
          spo_total: number;
          spo_yes_pct: number;
        };
        Insert: {
          alignment_score: number;
          cc_no_pct: number;
          cc_total: number;
          cc_yes_pct: number;
          drep_no_pct: number;
          drep_total: number;
          drep_yes_pct: number;
          epoch: number;
          proposal_index: number;
          proposal_tx_hash: string;
          snapshot_at?: string;
          spo_no_pct: number;
          spo_total: number;
          spo_yes_pct: number;
        };
        Update: {
          alignment_score?: number;
          cc_no_pct?: number;
          cc_total?: number;
          cc_yes_pct?: number;
          drep_no_pct?: number;
          drep_total?: number;
          drep_yes_pct?: number;
          epoch?: number;
          proposal_index?: number;
          proposal_tx_hash?: string;
          snapshot_at?: string;
          spo_no_pct?: number;
          spo_total?: number;
          spo_yes_pct?: number;
        };
        Relationships: [];
      };
      matching_topics: {
        Row: {
          alignment_hints: Json | null;
          created_at: string | null;
          display_text: string;
          enabled: boolean | null;
          epoch_introduced: number | null;
          id: string;
          selection_count: number | null;
          slug: string;
          source: string;
          trending: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          alignment_hints?: Json | null;
          created_at?: string | null;
          display_text: string;
          enabled?: boolean | null;
          epoch_introduced?: number | null;
          id?: string;
          selection_count?: number | null;
          slug: string;
          source?: string;
          trending?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          alignment_hints?: Json | null;
          created_at?: string | null;
          display_text?: string;
          enabled?: boolean | null;
          epoch_introduced?: number | null;
          id?: string;
          selection_count?: number | null;
          slug?: string;
          source?: string;
          trending?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      metadata_archive: {
        Row: {
          cip_standard: string | null;
          content_hash: string | null;
          entity_id: string;
          entity_type: string;
          fetch_status: string;
          fetched_at: string;
          id: number;
          meta_hash: string | null;
          meta_json: Json | null;
          meta_url: string | null;
        };
        Insert: {
          cip_standard?: string | null;
          content_hash?: string | null;
          entity_id: string;
          entity_type: string;
          fetch_status?: string;
          fetched_at?: string;
          id?: never;
          meta_hash?: string | null;
          meta_json?: Json | null;
          meta_url?: string | null;
        };
        Update: {
          cip_standard?: string | null;
          content_hash?: string | null;
          entity_id?: string;
          entity_type?: string;
          fetch_status?: string;
          fetched_at?: string;
          id?: never;
          meta_hash?: string | null;
          meta_json?: Json | null;
          meta_url?: string | null;
        };
        Relationships: [];
      };
      ncl_periods: {
        Row: {
          created_at: string;
          end_epoch: number;
          id: number;
          info_action_index: number | null;
          info_action_tx_hash: string | null;
          ncl_ada: number;
          start_epoch: number;
          status: string;
        };
        Insert: {
          created_at?: string;
          end_epoch: number;
          id?: number;
          info_action_index?: number | null;
          info_action_tx_hash?: string | null;
          ncl_ada: number;
          start_epoch: number;
          status?: string;
        };
        Update: {
          created_at?: string;
          end_epoch?: number;
          id?: number;
          info_action_index?: number | null;
          info_action_tx_hash?: string | null;
          ncl_ada?: number;
          start_epoch?: number;
          status?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          channel: string;
          event_type: string;
          id: string;
          payload: Json | null;
          sent_at: string;
          user_id: string | null;
          user_wallet: string;
        };
        Insert: {
          channel: string;
          event_type: string;
          id?: string;
          payload?: Json | null;
          sent_at?: string;
          user_id?: string | null;
          user_wallet: string;
        };
        Update: {
          channel?: string;
          event_type?: string;
          id?: string;
          payload?: Json | null;
          sent_at?: string;
          user_id?: string | null;
          user_wallet?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_log_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_preferences: {
        Row: {
          channel: string;
          enabled: boolean;
          event_type: string;
          id: string;
          user_id: string | null;
          user_wallet: string;
        };
        Insert: {
          channel: string;
          enabled?: boolean;
          event_type: string;
          id?: string;
          user_id?: string | null;
          user_wallet: string;
        };
        Update: {
          channel?: string;
          enabled?: boolean;
          event_type?: string;
          id?: string;
          user_id?: string | null;
          user_wallet?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          action_url: string | null;
          body: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          read: boolean;
          title: string;
          type: string;
          user_stake_address: string;
        };
        Insert: {
          action_url?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          read?: boolean;
          title: string;
          type: string;
          user_stake_address: string;
        };
        Update: {
          action_url?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          read?: boolean;
          title?: string;
          type?: string;
          user_stake_address?: string;
        };
        Relationships: [];
      };
      observatory_narratives: {
        Row: {
          committee: string | null;
          epoch: number;
          generated_at: string;
          health: string | null;
          id: number;
          treasury: string | null;
          unified: string | null;
        };
        Insert: {
          committee?: string | null;
          epoch: number;
          generated_at?: string;
          health?: string | null;
          id?: never;
          treasury?: string | null;
          unified?: string | null;
        };
        Update: {
          committee?: string | null;
          epoch?: number;
          generated_at?: string;
          health?: string | null;
          id?: never;
          treasury?: string | null;
          unified?: string | null;
        };
        Relationships: [];
      };
      pca_results: {
        Row: {
          components: number;
          computed_at: string | null;
          explained_variance: number[];
          is_active: boolean | null;
          loadings: Json;
          num_dreps: number;
          num_proposals: number;
          proposal_ids: string[];
          run_id: string;
          total_explained_variance: number;
        };
        Insert: {
          components: number;
          computed_at?: string | null;
          explained_variance: number[];
          is_active?: boolean | null;
          loadings: Json;
          num_dreps: number;
          num_proposals: number;
          proposal_ids: string[];
          run_id?: string;
          total_explained_variance: number;
        };
        Update: {
          components?: number;
          computed_at?: string | null;
          explained_variance?: number[];
          is_active?: boolean | null;
          loadings?: Json;
          num_dreps?: number;
          num_proposals?: number;
          proposal_ids?: string[];
          run_id?: string;
          total_explained_variance?: number;
        };
        Relationships: [];
      };
      perspective_clusters: {
        Row: {
          bridging_points: Json;
          clusters: Json;
          generated_at: string;
          id: string;
          minority_perspectives: Json;
          model_used: string;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_count: number;
        };
        Insert: {
          bridging_points?: Json;
          clusters?: Json;
          generated_at?: string;
          id?: string;
          minority_perspectives?: Json;
          model_used?: string;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_count?: number;
        };
        Update: {
          bridging_points?: Json;
          clusters?: Json;
          generated_at?: string;
          id?: string;
          minority_perspectives?: Json;
          model_used?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationale_count?: number;
        };
        Relationships: [];
      };
      poll_responses: {
        Row: {
          created_at: string | null;
          delegated_drep_id: string | null;
          id: string;
          initial_vote: string;
          proposal_index: number;
          proposal_tx_hash: string;
          source: string | null;
          stake_address: string | null;
          updated_at: string | null;
          user_id: string | null;
          vote: string;
          vote_count: number | null;
          wallet_address: string;
        };
        Insert: {
          created_at?: string | null;
          delegated_drep_id?: string | null;
          id?: string;
          initial_vote: string;
          proposal_index: number;
          proposal_tx_hash: string;
          source?: string | null;
          stake_address?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          vote: string;
          vote_count?: number | null;
          wallet_address: string;
        };
        Update: {
          created_at?: string | null;
          delegated_drep_id?: string | null;
          id?: string;
          initial_vote?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          source?: string | null;
          stake_address?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
          vote?: string;
          vote_count?: number | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'poll_responses_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      pools: {
        Row: {
          alignment_decentralization: number | null;
          alignment_innovation: number | null;
          alignment_security: number | null;
          alignment_transparency: number | null;
          alignment_treasury_conservative: number | null;
          alignment_treasury_growth: number | null;
          claimed_at: string | null;
          claimed_by: string | null;
          confidence: number | null;
          consistency_pct: number | null;
          consistency_raw: number | null;
          current_tier: string | null;
          delegator_count: number | null;
          deliberation_pct: number | null;
          deliberation_raw: number | null;
          fixed_cost_lovelace: number | null;
          governance_identity_pct: number | null;
          governance_identity_raw: number | null;
          governance_score: number | null;
          governance_statement: string | null;
          homepage_url: string | null;
          live_stake_lovelace: number | null;
          margin: number | null;
          metadata_hash_verified: boolean | null;
          narrative: string | null;
          participation_pct: number | null;
          participation_raw: number | null;
          pledge_lovelace: number | null;
          pool_id: string;
          pool_name: string | null;
          pool_status: string | null;
          relay_lat: number | null;
          relay_locations: Json | null;
          relay_lon: number | null;
          reliability_pct: number | null;
          reliability_raw: number | null;
          retiring_epoch: number | null;
          score_momentum: number | null;
          score_version: string | null;
          social_links: Json | null;
          spotlight_narrative: string | null;
          spotlight_narrative_generated_at: string | null;
          ticker: string | null;
          updated_at: string | null;
          vote_count: number | null;
        };
        Insert: {
          alignment_decentralization?: number | null;
          alignment_innovation?: number | null;
          alignment_security?: number | null;
          alignment_transparency?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_growth?: number | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          confidence?: number | null;
          consistency_pct?: number | null;
          consistency_raw?: number | null;
          current_tier?: string | null;
          delegator_count?: number | null;
          deliberation_pct?: number | null;
          deliberation_raw?: number | null;
          fixed_cost_lovelace?: number | null;
          governance_identity_pct?: number | null;
          governance_identity_raw?: number | null;
          governance_score?: number | null;
          governance_statement?: string | null;
          homepage_url?: string | null;
          live_stake_lovelace?: number | null;
          margin?: number | null;
          metadata_hash_verified?: boolean | null;
          narrative?: string | null;
          participation_pct?: number | null;
          participation_raw?: number | null;
          pledge_lovelace?: number | null;
          pool_id: string;
          pool_name?: string | null;
          pool_status?: string | null;
          relay_lat?: number | null;
          relay_locations?: Json | null;
          relay_lon?: number | null;
          reliability_pct?: number | null;
          reliability_raw?: number | null;
          retiring_epoch?: number | null;
          score_momentum?: number | null;
          score_version?: string | null;
          social_links?: Json | null;
          spotlight_narrative?: string | null;
          spotlight_narrative_generated_at?: string | null;
          ticker?: string | null;
          updated_at?: string | null;
          vote_count?: number | null;
        };
        Update: {
          alignment_decentralization?: number | null;
          alignment_innovation?: number | null;
          alignment_security?: number | null;
          alignment_transparency?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_growth?: number | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          confidence?: number | null;
          consistency_pct?: number | null;
          consistency_raw?: number | null;
          current_tier?: string | null;
          delegator_count?: number | null;
          deliberation_pct?: number | null;
          deliberation_raw?: number | null;
          fixed_cost_lovelace?: number | null;
          governance_identity_pct?: number | null;
          governance_identity_raw?: number | null;
          governance_score?: number | null;
          governance_statement?: string | null;
          homepage_url?: string | null;
          live_stake_lovelace?: number | null;
          margin?: number | null;
          metadata_hash_verified?: boolean | null;
          narrative?: string | null;
          participation_pct?: number | null;
          participation_raw?: number | null;
          pledge_lovelace?: number | null;
          pool_id?: string;
          pool_name?: string | null;
          pool_status?: string | null;
          relay_lat?: number | null;
          relay_locations?: Json | null;
          relay_lon?: number | null;
          reliability_pct?: number | null;
          reliability_raw?: number | null;
          retiring_epoch?: number | null;
          score_momentum?: number | null;
          score_version?: string | null;
          social_links?: Json | null;
          spotlight_narrative?: string | null;
          spotlight_narrative_generated_at?: string | null;
          ticker?: string | null;
          updated_at?: string | null;
          vote_count?: number | null;
        };
        Relationships: [];
      };
      position_statements: {
        Row: {
          created_at: string | null;
          drep_id: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          statement_text: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          drep_id: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          proposal_index: number;
          proposal_tx_hash: string;
          statement_text: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          drep_id?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          statement_text?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      preview_cohorts: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      preview_feedback: {
        Row: {
          created_at: string;
          id: string;
          page: string;
          persona_preset_id: string;
          session_id: string;
          text: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          page: string;
          persona_preset_id: string;
          session_id: string;
          text: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          page?: string;
          persona_preset_id?: string;
          session_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'preview_feedback_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'preview_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      preview_invites: {
        Row: {
          code: string;
          cohort_id: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          max_uses: number;
          notes: string | null;
          persona_preset_id: string;
          revoked: boolean;
          segment_overrides: Json;
          use_count: number;
        };
        Insert: {
          code: string;
          cohort_id: string;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          max_uses?: number;
          notes?: string | null;
          persona_preset_id: string;
          revoked?: boolean;
          segment_overrides?: Json;
          use_count?: number;
        };
        Update: {
          code?: string;
          cohort_id?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          notes?: string | null;
          persona_preset_id?: string;
          revoked?: boolean;
          segment_overrides?: Json;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'preview_invites_cohort_id_fkey';
            columns: ['cohort_id'];
            isOneToOne: false;
            referencedRelation: 'preview_cohorts';
            referencedColumns: ['id'];
          },
        ];
      };
      preview_sessions: {
        Row: {
          cohort_id: string;
          created_at: string;
          id: string;
          invite_id: string;
          last_active: string;
          persona_snapshot: Json;
          revoked: boolean;
          user_id: string;
        };
        Insert: {
          cohort_id: string;
          created_at?: string;
          id?: string;
          invite_id: string;
          last_active?: string;
          persona_snapshot: Json;
          revoked?: boolean;
          user_id: string;
        };
        Update: {
          cohort_id?: string;
          created_at?: string;
          id?: string;
          invite_id?: string;
          last_active?: string;
          persona_snapshot?: Json;
          revoked?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'preview_sessions_cohort_id_fkey';
            columns: ['cohort_id'];
            isOneToOne: false;
            referencedRelation: 'preview_cohorts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'preview_sessions_invite_id_fkey';
            columns: ['invite_id'];
            isOneToOne: false;
            referencedRelation: 'preview_invites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'preview_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_views: {
        Row: {
          drep_id: string;
          id: string;
          viewed_at: string;
          viewer_wallet: string | null;
        };
        Insert: {
          drep_id: string;
          id?: string;
          viewed_at?: string;
          viewer_wallet?: string | null;
        };
        Update: {
          drep_id?: string;
          id?: string;
          viewed_at?: string;
          viewer_wallet?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_views_drep_id_fkey';
            columns: ['drep_id'];
            isOneToOne: false;
            referencedRelation: 'dreps';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_annotations: {
        Row: {
          anchor_end: number;
          anchor_field: string;
          anchor_start: number;
          annotation_text: string;
          annotation_type: string;
          color: string | null;
          created_at: string;
          id: string;
          is_public: boolean;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at: string;
          upvote_count: number;
          user_id: string;
        };
        Insert: {
          anchor_end: number;
          anchor_field?: string;
          anchor_start: number;
          annotation_text: string;
          annotation_type?: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at?: string;
          upvote_count?: number;
          user_id: string;
        };
        Update: {
          anchor_end?: number;
          anchor_field?: string;
          anchor_start?: number;
          annotation_text?: string;
          annotation_type?: string;
          color?: string | null;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          proposal_index?: number;
          proposal_tx_hash?: string;
          updated_at?: string;
          upvote_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      proposal_brief_feedback: {
        Row: {
          brief_id: string;
          created_at: string;
          helpful: boolean;
          id: string;
          user_id: string;
        };
        Insert: {
          brief_id: string;
          created_at?: string;
          helpful: boolean;
          id?: string;
          user_id: string;
        };
        Update: {
          brief_id?: string;
          created_at?: string;
          helpful?: boolean;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_brief_feedback_brief_id_fkey';
            columns: ['brief_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_briefs';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_briefs: {
        Row: {
          content: Json;
          conviction_score: number;
          created_at: string;
          generation_time_ms: number | null;
          helpful_count: number;
          id: string;
          model_used: string | null;
          not_helpful_count: number;
          polarization_score: number;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_count: number;
          rationale_hash: string | null;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          conviction_score?: number;
          created_at?: string;
          generation_time_ms?: number | null;
          helpful_count?: number;
          id?: string;
          model_used?: string | null;
          not_helpful_count?: number;
          polarization_score?: number;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_count?: number;
          rationale_hash?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          conviction_score?: number;
          created_at?: string;
          generation_time_ms?: number | null;
          helpful_count?: number;
          id?: string;
          model_used?: string | null;
          not_helpful_count?: number;
          polarization_score?: number;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationale_count?: number;
          rationale_hash?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposal_classifications: {
        Row: {
          ai_summary: string | null;
          classified_at: string | null;
          constitutional_analysis: Json | null;
          dim_decentralization: number | null;
          dim_innovation: number | null;
          dim_security: number | null;
          dim_transparency: number | null;
          dim_treasury_conservative: number | null;
          dim_treasury_growth: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Insert: {
          ai_summary?: string | null;
          classified_at?: string | null;
          constitutional_analysis?: Json | null;
          dim_decentralization?: number | null;
          dim_innovation?: number | null;
          dim_security?: number | null;
          dim_transparency?: number | null;
          dim_treasury_conservative?: number | null;
          dim_treasury_growth?: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Update: {
          ai_summary?: string | null;
          classified_at?: string | null;
          constitutional_analysis?: Json | null;
          dim_decentralization?: number | null;
          dim_innovation?: number | null;
          dim_security?: number | null;
          dim_transparency?: number | null;
          dim_treasury_conservative?: number | null;
          dim_treasury_growth?: number | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
        };
        Relationships: [];
      };
      proposal_draft_versions: {
        Row: {
          change_justifications: Json | null;
          constitutional_check: Json | null;
          content: Json;
          created_at: string;
          draft_id: string;
          edit_summary: string;
          id: string;
          version_name: string;
          version_number: number;
        };
        Insert: {
          change_justifications?: Json | null;
          constitutional_check?: Json | null;
          content: Json;
          created_at?: string;
          draft_id: string;
          edit_summary?: string;
          id?: string;
          version_name?: string;
          version_number: number;
        };
        Update: {
          change_justifications?: Json | null;
          constitutional_check?: Json | null;
          content?: Json;
          created_at?: string;
          draft_id?: string;
          edit_summary?: string;
          id?: string;
          version_name?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_draft_versions_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_drafts: {
        Row: {
          abstract: string;
          ai_influence_score: number | null;
          ai_originality_score: number | null;
          community_review_started_at: string | null;
          created_at: string;
          current_version: number;
          fcp_started_at: string | null;
          id: string;
          last_constitutional_check: Json | null;
          last_constitutional_check_at: string | null;
          motivation: string;
          owner_stake_address: string;
          preview_cohort_id: string | null;
          proposal_type: string;
          rationale: string;
          stage_entered_at: string | null;
          status: string;
          submitted_anchor_hash: string | null;
          submitted_anchor_url: string | null;
          submitted_at: string | null;
          submitted_tx_hash: string | null;
          supersedes_id: string | null;
          title: string;
          type_specific: Json;
          updated_at: string;
        };
        Insert: {
          abstract?: string;
          ai_influence_score?: number | null;
          ai_originality_score?: number | null;
          community_review_started_at?: string | null;
          created_at?: string;
          current_version?: number;
          fcp_started_at?: string | null;
          id?: string;
          last_constitutional_check?: Json | null;
          last_constitutional_check_at?: string | null;
          motivation?: string;
          owner_stake_address: string;
          preview_cohort_id?: string | null;
          proposal_type?: string;
          rationale?: string;
          stage_entered_at?: string | null;
          status?: string;
          submitted_anchor_hash?: string | null;
          submitted_anchor_url?: string | null;
          submitted_at?: string | null;
          submitted_tx_hash?: string | null;
          supersedes_id?: string | null;
          title?: string;
          type_specific?: Json;
          updated_at?: string;
        };
        Update: {
          abstract?: string;
          ai_influence_score?: number | null;
          ai_originality_score?: number | null;
          community_review_started_at?: string | null;
          created_at?: string;
          current_version?: number;
          fcp_started_at?: string | null;
          id?: string;
          last_constitutional_check?: Json | null;
          last_constitutional_check_at?: string | null;
          motivation?: string;
          owner_stake_address?: string;
          preview_cohort_id?: string | null;
          proposal_type?: string;
          rationale?: string;
          stage_entered_at?: string | null;
          status?: string;
          submitted_anchor_hash?: string | null;
          submitted_anchor_url?: string | null;
          submitted_at?: string | null;
          submitted_tx_hash?: string | null;
          supersedes_id?: string | null;
          title?: string;
          type_specific?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_drafts_preview_cohort_id_fkey';
            columns: ['preview_cohort_id'];
            isOneToOne: false;
            referencedRelation: 'preview_cohorts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_drafts_supersedes_id_fkey';
            columns: ['supersedes_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_engagement_events: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          event_type: string;
          id: number;
          proposal_index: number;
          proposal_tx_hash: string;
          section: string | null;
          user_id: string | null;
          user_segment: string | null;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          event_type: string;
          id?: never;
          proposal_index: number;
          proposal_tx_hash: string;
          section?: string | null;
          user_id?: string | null;
          user_segment?: string | null;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          event_type?: string;
          id?: never;
          proposal_index?: number;
          proposal_tx_hash?: string;
          section?: string | null;
          user_id?: string | null;
          user_segment?: string | null;
        };
        Relationships: [];
      };
      proposal_feedback_themes: {
        Row: {
          addressed_reason: string | null;
          addressed_status: string;
          created_at: string;
          endorsement_count: number;
          id: string;
          key_voices: Json;
          linked_annotation_ids: string[];
          novel_contributions: Json;
          proposal_index: number;
          proposal_tx_hash: string;
          theme_category: string;
          theme_summary: string;
          updated_at: string;
        };
        Insert: {
          addressed_reason?: string | null;
          addressed_status?: string;
          created_at?: string;
          endorsement_count?: number;
          id?: string;
          key_voices?: Json;
          linked_annotation_ids?: string[];
          novel_contributions?: Json;
          proposal_index: number;
          proposal_tx_hash: string;
          theme_category: string;
          theme_summary: string;
          updated_at?: string;
        };
        Update: {
          addressed_reason?: string | null;
          addressed_status?: string;
          created_at?: string;
          endorsement_count?: number;
          id?: string;
          key_voices?: Json;
          linked_annotation_ids?: string[];
          novel_contributions?: Json;
          proposal_index?: number;
          proposal_tx_hash?: string;
          theme_category?: string;
          theme_summary?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposal_notes: {
        Row: {
          created_at: string;
          highlights: Json;
          id: string;
          note_text: string;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          highlights?: Json;
          id?: string;
          note_text?: string;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          highlights?: Json;
          id?: string;
          note_text?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      proposal_outcomes: {
        Row: {
          created_at: string;
          delivered_count: number;
          delivery_score: number | null;
          delivery_status: string;
          enacted_epoch: number | null;
          epochs_since_enactment: number | null;
          last_evaluated_epoch: number | null;
          milestones_completed: number | null;
          milestones_total: number | null;
          not_delivered_count: number;
          partial_count: number;
          proposal_index: number;
          proposal_tx_hash: string;
          too_early_count: number;
          total_poll_responses: number;
          updated_at: string;
          would_approve_again_pct: number | null;
        };
        Insert: {
          created_at?: string;
          delivered_count?: number;
          delivery_score?: number | null;
          delivery_status?: string;
          enacted_epoch?: number | null;
          epochs_since_enactment?: number | null;
          last_evaluated_epoch?: number | null;
          milestones_completed?: number | null;
          milestones_total?: number | null;
          not_delivered_count?: number;
          partial_count?: number;
          proposal_index: number;
          proposal_tx_hash: string;
          too_early_count?: number;
          total_poll_responses?: number;
          updated_at?: string;
          would_approve_again_pct?: number | null;
        };
        Update: {
          created_at?: string;
          delivered_count?: number;
          delivery_score?: number | null;
          delivery_status?: string;
          enacted_epoch?: number | null;
          epochs_since_enactment?: number | null;
          last_evaluated_epoch?: number | null;
          milestones_completed?: number | null;
          milestones_total?: number | null;
          not_delivered_count?: number;
          partial_count?: number;
          proposal_index?: number;
          proposal_tx_hash?: string;
          too_early_count?: number;
          total_poll_responses?: number;
          updated_at?: string;
          would_approve_again_pct?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_proposal';
            columns: ['proposal_tx_hash', 'proposal_index'];
            isOneToOne: true;
            referencedRelation: 'proposals';
            referencedColumns: ['tx_hash', 'proposal_index'];
          },
        ];
      };
      proposal_proposers: {
        Row: {
          proposal_index: number;
          proposal_tx_hash: string;
          proposer_id: string;
        };
        Insert: {
          proposal_index: number;
          proposal_tx_hash: string;
          proposer_id: string;
        };
        Update: {
          proposal_index?: number;
          proposal_tx_hash?: string;
          proposer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_proposers_proposer_id_fkey';
            columns: ['proposer_id'];
            isOneToOne: false;
            referencedRelation: 'proposers';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_revision_notifications: {
        Row: {
          created_at: string;
          draft_id: string | null;
          id: string;
          proposal_index: number | null;
          proposal_tx_hash: string | null;
          read_at: string | null;
          recipient_type: string;
          recipient_user_id: string;
          sections_changed: string[];
          themes_addressed: string[];
          version_number: number;
        };
        Insert: {
          created_at?: string;
          draft_id?: string | null;
          id?: string;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          read_at?: string | null;
          recipient_type: string;
          recipient_user_id: string;
          sections_changed?: string[];
          themes_addressed?: string[];
          version_number: number;
        };
        Update: {
          created_at?: string;
          draft_id?: string | null;
          id?: string;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          read_at?: string | null;
          recipient_type?: string;
          recipient_user_id?: string;
          sections_changed?: string[];
          themes_addressed?: string[];
          version_number?: number;
        };
        Relationships: [];
      };
      proposal_similarity_cache: {
        Row: {
          computed_at: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          similar_index: number;
          similar_tx_hash: string;
          similarity_score: number;
        };
        Insert: {
          computed_at?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          similar_index: number;
          similar_tx_hash: string;
          similarity_score: number;
        };
        Update: {
          computed_at?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          similar_index?: number;
          similar_tx_hash?: string;
          similarity_score?: number;
        };
        Relationships: [];
      };
      proposal_team_approvals: {
        Row: {
          approved_at: string | null;
          draft_id: string;
          id: string;
          team_member_id: string;
        };
        Insert: {
          approved_at?: string | null;
          draft_id: string;
          id?: string;
          team_member_id: string;
        };
        Update: {
          approved_at?: string | null;
          draft_id?: string;
          id?: string;
          team_member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_team_approvals_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'proposal_team_approvals_team_member_id_fkey';
            columns: ['team_member_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_team_members';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_team_invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          invite_code: string;
          max_uses: number;
          role: string;
          team_id: string;
          use_count: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          invite_code: string;
          max_uses?: number;
          role?: string;
          team_id: string;
          use_count?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          invite_code?: string;
          max_uses?: number;
          role?: string;
          team_id?: string;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_team_invites_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_teams';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_team_members: {
        Row: {
          id: string;
          invited_at: string;
          joined_at: string | null;
          role: string;
          stake_address: string;
          team_id: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          invited_at?: string;
          joined_at?: string | null;
          role?: string;
          stake_address: string;
          team_id: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          invited_at?: string;
          joined_at?: string | null;
          role?: string;
          stake_address?: string;
          team_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_team_members_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_teams';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_teams: {
        Row: {
          created_at: string;
          draft_id: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          draft_id: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          draft_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_teams_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: true;
            referencedRelation: 'proposal_drafts';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_theme_endorsements: {
        Row: {
          additional_context: string | null;
          created_at: string;
          id: string;
          is_novel: boolean;
          reviewer_user_id: string;
          theme_id: string;
        };
        Insert: {
          additional_context?: string | null;
          created_at?: string;
          id?: string;
          is_novel?: boolean;
          reviewer_user_id: string;
          theme_id: string;
        };
        Update: {
          additional_context?: string | null;
          created_at?: string;
          id?: string;
          is_novel?: boolean;
          reviewer_user_id?: string;
          theme_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposal_theme_endorsements_theme_id_fkey';
            columns: ['theme_id'];
            isOneToOne: false;
            referencedRelation: 'proposal_feedback_themes';
            referencedColumns: ['id'];
          },
        ];
      };
      proposal_vote_snapshots: {
        Row: {
          cc_abstain_count: number;
          cc_no_count: number;
          cc_yes_count: number;
          drep_abstain_count: number;
          drep_no_count: number;
          drep_no_power: number;
          drep_yes_count: number;
          drep_yes_power: number;
          epoch: number;
          proposal_index: number;
          proposal_tx_hash: string;
          snapshot_at: string;
          spo_abstain_count: number;
          spo_no_count: number;
          spo_yes_count: number;
        };
        Insert: {
          cc_abstain_count: number;
          cc_no_count: number;
          cc_yes_count: number;
          drep_abstain_count: number;
          drep_no_count: number;
          drep_no_power?: number;
          drep_yes_count: number;
          drep_yes_power?: number;
          epoch: number;
          proposal_index: number;
          proposal_tx_hash: string;
          snapshot_at?: string;
          spo_abstain_count: number;
          spo_no_count: number;
          spo_yes_count: number;
        };
        Update: {
          cc_abstain_count?: number;
          cc_no_count?: number;
          cc_yes_count?: number;
          drep_abstain_count?: number;
          drep_no_count?: number;
          drep_no_power?: number;
          drep_yes_count?: number;
          drep_yes_power?: number;
          epoch?: number;
          proposal_index?: number;
          proposal_tx_hash?: string;
          snapshot_at?: string;
          spo_abstain_count?: number;
          spo_no_count?: number;
          spo_yes_count?: number;
        };
        Relationships: [];
      };
      proposal_voting_summary: {
        Row: {
          committee_abstain_votes_cast: number | null;
          committee_no_votes_cast: number | null;
          committee_yes_votes_cast: number | null;
          drep_abstain_vote_power: number | null;
          drep_abstain_votes_cast: number | null;
          drep_always_abstain_power: number | null;
          drep_always_no_confidence_power: number | null;
          drep_no_vote_power: number | null;
          drep_no_votes_cast: number | null;
          drep_yes_vote_power: number | null;
          drep_yes_votes_cast: number | null;
          epoch_no: number;
          fetched_at: string | null;
          pool_abstain_vote_power: number | null;
          pool_abstain_votes_cast: number | null;
          pool_no_vote_power: number | null;
          pool_no_votes_cast: number | null;
          pool_yes_vote_power: number | null;
          pool_yes_votes_cast: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Insert: {
          committee_abstain_votes_cast?: number | null;
          committee_no_votes_cast?: number | null;
          committee_yes_votes_cast?: number | null;
          drep_abstain_vote_power?: number | null;
          drep_abstain_votes_cast?: number | null;
          drep_always_abstain_power?: number | null;
          drep_always_no_confidence_power?: number | null;
          drep_no_vote_power?: number | null;
          drep_no_votes_cast?: number | null;
          drep_yes_vote_power?: number | null;
          drep_yes_votes_cast?: number | null;
          epoch_no: number;
          fetched_at?: string | null;
          pool_abstain_vote_power?: number | null;
          pool_abstain_votes_cast?: number | null;
          pool_no_vote_power?: number | null;
          pool_no_votes_cast?: number | null;
          pool_yes_vote_power?: number | null;
          pool_yes_votes_cast?: number | null;
          proposal_index: number;
          proposal_tx_hash: string;
        };
        Update: {
          committee_abstain_votes_cast?: number | null;
          committee_no_votes_cast?: number | null;
          committee_yes_votes_cast?: number | null;
          drep_abstain_vote_power?: number | null;
          drep_abstain_votes_cast?: number | null;
          drep_always_abstain_power?: number | null;
          drep_always_no_confidence_power?: number | null;
          drep_no_vote_power?: number | null;
          drep_no_votes_cast?: number | null;
          drep_yes_vote_power?: number | null;
          drep_yes_votes_cast?: number | null;
          epoch_no?: number;
          fetched_at?: string | null;
          pool_abstain_vote_power?: number | null;
          pool_abstain_votes_cast?: number | null;
          pool_no_vote_power?: number | null;
          pool_no_votes_cast?: number | null;
          pool_yes_vote_power?: number | null;
          pool_yes_votes_cast?: number | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
        };
        Relationships: [];
      };
      proposals: {
        Row: {
          abstract: string | null;
          ai_proposal_quality: number | null;
          ai_proposal_quality_details: Json | null;
          ai_summary: string | null;
          assessment_sealed_until: string | null;
          block_time: number | null;
          dropped_epoch: number | null;
          enacted_epoch: number | null;
          expiration_epoch: number | null;
          expired_epoch: number | null;
          meta_json: Json | null;
          param_changes: Json | null;
          proposal_id: string | null;
          proposal_index: number;
          proposal_type: string;
          proposed_epoch: number | null;
          ratified_epoch: number | null;
          relevant_prefs: string[] | null;
          title: string | null;
          treasury_tier: string | null;
          tx_hash: string;
          updated_at: string | null;
          withdrawal_amount: number | null;
        };
        Insert: {
          abstract?: string | null;
          ai_proposal_quality?: number | null;
          ai_proposal_quality_details?: Json | null;
          ai_summary?: string | null;
          assessment_sealed_until?: string | null;
          block_time?: number | null;
          dropped_epoch?: number | null;
          enacted_epoch?: number | null;
          expiration_epoch?: number | null;
          expired_epoch?: number | null;
          meta_json?: Json | null;
          param_changes?: Json | null;
          proposal_id?: string | null;
          proposal_index: number;
          proposal_type: string;
          proposed_epoch?: number | null;
          ratified_epoch?: number | null;
          relevant_prefs?: string[] | null;
          title?: string | null;
          treasury_tier?: string | null;
          tx_hash: string;
          updated_at?: string | null;
          withdrawal_amount?: number | null;
        };
        Update: {
          abstract?: string | null;
          ai_proposal_quality?: number | null;
          ai_proposal_quality_details?: Json | null;
          ai_summary?: string | null;
          assessment_sealed_until?: string | null;
          block_time?: number | null;
          dropped_epoch?: number | null;
          enacted_epoch?: number | null;
          expiration_epoch?: number | null;
          expired_epoch?: number | null;
          meta_json?: Json | null;
          param_changes?: Json | null;
          proposal_id?: string | null;
          proposal_index?: number;
          proposal_type?: string;
          proposed_epoch?: number | null;
          ratified_epoch?: number | null;
          relevant_prefs?: string[] | null;
          title?: string | null;
          treasury_tier?: string | null;
          tx_hash?: string;
          updated_at?: string | null;
          withdrawal_amount?: number | null;
        };
        Relationships: [];
      };
      proposer_aliases: {
        Row: {
          alias_key: string;
          alias_name: string;
          id: number;
          proposer_id: string;
        };
        Insert: {
          alias_key?: string;
          alias_name: string;
          id?: never;
          proposer_id: string;
        };
        Update: {
          alias_key?: string;
          alias_name?: string;
          id?: never;
          proposer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proposer_aliases_proposer_id_fkey';
            columns: ['proposer_id'];
            isOneToOne: false;
            referencedRelation: 'proposers';
            referencedColumns: ['id'];
          },
        ];
      };
      proposers: {
        Row: {
          composite_score: number | null;
          confidence: number;
          display_name: string;
          dropped_count: number;
          enacted_count: number;
          first_proposal_epoch: number | null;
          fiscal_responsibility_score: number | null;
          governance_citizenship_score: number | null;
          id: string;
          proposal_count: number;
          proposal_quality_score: number | null;
          tier: string;
          track_record_score: number | null;
          type: string;
          updated_at: string;
        };
        Insert: {
          composite_score?: number | null;
          confidence?: number;
          display_name: string;
          dropped_count?: number;
          enacted_count?: number;
          first_proposal_epoch?: number | null;
          fiscal_responsibility_score?: number | null;
          governance_citizenship_score?: number | null;
          id: string;
          proposal_count?: number;
          proposal_quality_score?: number | null;
          tier?: string;
          track_record_score?: number | null;
          type?: string;
          updated_at?: string;
        };
        Update: {
          composite_score?: number | null;
          confidence?: number;
          display_name?: string;
          dropped_count?: number;
          enacted_count?: number;
          first_proposal_epoch?: number | null;
          fiscal_responsibility_score?: number | null;
          governance_citizenship_score?: number | null;
          id?: string;
          proposal_count?: number;
          proposal_quality_score?: number | null;
          tier?: string;
          track_record_score?: number | null;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rationale_documents: {
        Row: {
          content_hash: string;
          created_at: string | null;
          document: Json;
          drep_id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_text: string;
          vote_tx_hash: string | null;
        };
        Insert: {
          content_hash: string;
          created_at?: string | null;
          document: Json;
          drep_id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          rationale_text: string;
          vote_tx_hash?: string | null;
        };
        Update: {
          content_hash?: string;
          created_at?: string | null;
          document?: Json;
          drep_id?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          rationale_text?: string;
          vote_tx_hash?: string | null;
        };
        Relationships: [];
      };
      research_conversations: {
        Row: {
          created_at: string;
          id: string;
          messages: Json;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          messages?: Json;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          messages?: Json;
          proposal_index?: number;
          proposal_tx_hash?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      review_framework_templates: {
        Row: {
          checklist: Json;
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          proposal_type: string;
        };
        Insert: {
          checklist?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          proposal_type: string;
        };
        Update: {
          checklist?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          proposal_type?: string;
        };
        Relationships: [];
      };
      revoked_sessions: {
        Row: {
          jti: string;
          revoked_at: string;
          user_id: string | null;
          wallet_address: string;
        };
        Insert: {
          jti: string;
          revoked_at?: string;
          user_id?: string | null;
          wallet_address: string;
        };
        Update: {
          jti?: string;
          revoked_at?: string;
          user_id?: string | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'revoked_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      scoring_methodology_changelog: {
        Row: {
          changes: Json;
          entity_type: string;
          id: number;
          migration_notes: string | null;
          pillar_weights: Json | null;
          released_at: string | null;
          summary: string;
          version: string;
        };
        Insert: {
          changes?: Json;
          entity_type: string;
          id?: number;
          migration_notes?: string | null;
          pillar_weights?: Json | null;
          released_at?: string | null;
          summary: string;
          version: string;
        };
        Update: {
          changes?: Json;
          entity_type?: string;
          id?: number;
          migration_notes?: string | null;
          pillar_weights?: Json | null;
          released_at?: string | null;
          summary?: string;
          version?: string;
        };
        Relationships: [];
      };
      semantic_similarity_cache: {
        Row: {
          computed_at: string | null;
          entity_id: string;
          entity_type: string;
          similar_entity_id: string;
          similar_entity_type: string;
          similarity_score: number;
        };
        Insert: {
          computed_at?: string | null;
          entity_id: string;
          entity_type: string;
          similar_entity_id: string;
          similar_entity_type: string;
          similarity_score: number;
        };
        Update: {
          computed_at?: string | null;
          entity_id?: string;
          entity_type?: string;
          similar_entity_id?: string;
          similar_entity_type?: string;
          similarity_score?: number;
        };
        Relationships: [];
      };
      snapshot_completeness_log: {
        Row: {
          coverage_pct: number | null;
          created_at: string | null;
          epoch_no: number;
          expected_count: number | null;
          id: number;
          metadata: Json | null;
          record_count: number;
          snapshot_date: string;
          snapshot_type: string;
        };
        Insert: {
          coverage_pct?: number | null;
          created_at?: string | null;
          epoch_no?: number;
          expected_count?: number | null;
          id?: number;
          metadata?: Json | null;
          record_count: number;
          snapshot_date?: string;
          snapshot_type: string;
        };
        Update: {
          coverage_pct?: number | null;
          created_at?: string | null;
          epoch_no?: number;
          expected_count?: number | null;
          id?: number;
          metadata?: Json | null;
          record_count?: number;
          snapshot_date?: string;
          snapshot_type?: string;
        };
        Relationships: [];
      };
      social_link_checks: {
        Row: {
          created_at: string | null;
          drep_id: string;
          http_status: number | null;
          id: string;
          last_checked_at: string | null;
          status: string;
          uri: string;
        };
        Insert: {
          created_at?: string | null;
          drep_id: string;
          http_status?: number | null;
          id?: string;
          last_checked_at?: string | null;
          status?: string;
          uri: string;
        };
        Update: {
          created_at?: string | null;
          drep_id?: string;
          http_status?: number | null;
          id?: string;
          last_checked_at?: string | null;
          status?: string;
          uri?: string;
        };
        Relationships: [];
      };
      spo_alignment_snapshots: {
        Row: {
          alignment_decentralization: number | null;
          alignment_innovation: number | null;
          alignment_security: number | null;
          alignment_transparency: number | null;
          alignment_treasury_conservative: number | null;
          alignment_treasury_growth: number | null;
          epoch_no: number;
          pool_id: string;
          snapshot_at: string | null;
        };
        Insert: {
          alignment_decentralization?: number | null;
          alignment_innovation?: number | null;
          alignment_security?: number | null;
          alignment_transparency?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_growth?: number | null;
          epoch_no: number;
          pool_id: string;
          snapshot_at?: string | null;
        };
        Update: {
          alignment_decentralization?: number | null;
          alignment_innovation?: number | null;
          alignment_security?: number | null;
          alignment_transparency?: number | null;
          alignment_treasury_conservative?: number | null;
          alignment_treasury_growth?: number | null;
          epoch_no?: number;
          pool_id?: string;
          snapshot_at?: string | null;
        };
        Relationships: [];
      };
      spo_power_snapshots: {
        Row: {
          delegator_count: number;
          epoch_no: number;
          id: string;
          live_stake_lovelace: number;
          pool_id: string;
          snapshot_at: string;
        };
        Insert: {
          delegator_count?: number;
          epoch_no: number;
          id?: string;
          live_stake_lovelace?: number;
          pool_id: string;
          snapshot_at?: string;
        };
        Update: {
          delegator_count?: number;
          epoch_no?: number;
          id?: string;
          live_stake_lovelace?: number;
          pool_id?: string;
          snapshot_at?: string;
        };
        Relationships: [];
      };
      spo_score_snapshots: {
        Row: {
          confidence: number | null;
          consistency_pct: number | null;
          consistency_raw: number | null;
          deliberation_pct: number | null;
          deliberation_raw: number | null;
          epoch_no: number;
          governance_identity_pct: number | null;
          governance_identity_raw: number | null;
          governance_score: number | null;
          participation_pct: number | null;
          participation_rate: number | null;
          pool_id: string;
          rationale_rate: number | null;
          reliability_pct: number | null;
          reliability_raw: number | null;
          score_momentum: number | null;
          score_version: string | null;
          snapshot_at: string | null;
          vote_count: number | null;
        };
        Insert: {
          confidence?: number | null;
          consistency_pct?: number | null;
          consistency_raw?: number | null;
          deliberation_pct?: number | null;
          deliberation_raw?: number | null;
          epoch_no: number;
          governance_identity_pct?: number | null;
          governance_identity_raw?: number | null;
          governance_score?: number | null;
          participation_pct?: number | null;
          participation_rate?: number | null;
          pool_id: string;
          rationale_rate?: number | null;
          reliability_pct?: number | null;
          reliability_raw?: number | null;
          score_momentum?: number | null;
          score_version?: string | null;
          snapshot_at?: string | null;
          vote_count?: number | null;
        };
        Update: {
          confidence?: number | null;
          consistency_pct?: number | null;
          consistency_raw?: number | null;
          deliberation_pct?: number | null;
          deliberation_raw?: number | null;
          epoch_no?: number;
          governance_identity_pct?: number | null;
          governance_identity_raw?: number | null;
          governance_score?: number | null;
          participation_pct?: number | null;
          participation_rate?: number | null;
          pool_id?: string;
          rationale_rate?: number | null;
          reliability_pct?: number | null;
          reliability_raw?: number | null;
          score_momentum?: number | null;
          score_version?: string | null;
          snapshot_at?: string | null;
          vote_count?: number | null;
        };
        Relationships: [];
      };
      spo_sybil_flags: {
        Row: {
          agreement_rate: number;
          detected_at: string | null;
          epoch_no: number;
          id: number;
          pool_a: string;
          pool_b: string;
          resolved: boolean | null;
          shared_votes: number;
        };
        Insert: {
          agreement_rate: number;
          detected_at?: string | null;
          epoch_no: number;
          id?: number;
          pool_a: string;
          pool_b: string;
          resolved?: boolean | null;
          shared_votes: number;
        };
        Update: {
          agreement_rate?: number;
          detected_at?: string | null;
          epoch_no?: number;
          id?: number;
          pool_a?: string;
          pool_b?: string;
          resolved?: boolean | null;
          shared_votes?: number;
        };
        Relationships: [];
      };
      spo_votes: {
        Row: {
          block_time: number;
          epoch: number;
          pool_id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          tx_hash: string;
          vote: string;
        };
        Insert: {
          block_time: number;
          epoch: number;
          pool_id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          tx_hash: string;
          vote: string;
        };
        Update: {
          block_time?: number;
          epoch?: number;
          pool_id?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          tx_hash?: string;
          vote?: string;
        };
        Relationships: [];
      };
      state_of_governance_reports: {
        Row: {
          epoch_no: number;
          generated_at: string | null;
          narrative_html: string | null;
          published: boolean | null;
          report_data: Json;
        };
        Insert: {
          epoch_no: number;
          generated_at?: string | null;
          narrative_html?: string | null;
          published?: boolean | null;
          report_data: Json;
        };
        Update: {
          epoch_no?: number;
          generated_at?: string | null;
          narrative_html?: string | null;
          published?: boolean | null;
          report_data?: Json;
        };
        Relationships: [];
      };
      sync_log: {
        Row: {
          created_at: string | null;
          duration_ms: number | null;
          error_message: string | null;
          finished_at: string | null;
          id: number;
          metrics: Json | null;
          started_at: string;
          success: boolean;
          sync_type: string;
        };
        Insert: {
          created_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: number;
          metrics?: Json | null;
          started_at: string;
          success?: boolean;
          sync_type: string;
        };
        Update: {
          created_at?: string | null;
          duration_ms?: number | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: number;
          metrics?: Json | null;
          started_at?: string;
          success?: boolean;
          sync_type?: string;
        };
        Relationships: [];
      };
      tier_changes: {
        Row: {
          created_at: string | null;
          entity_id: string;
          entity_type: string;
          epoch_no: number | null;
          id: number;
          new_score: number;
          new_tier: string;
          old_score: number;
          old_tier: string;
        };
        Insert: {
          created_at?: string | null;
          entity_id: string;
          entity_type: string;
          epoch_no?: number | null;
          id?: never;
          new_score: number;
          new_tier: string;
          old_score: number;
          old_tier: string;
        };
        Update: {
          created_at?: string | null;
          entity_id?: string;
          entity_type?: string;
          epoch_no?: number | null;
          id?: never;
          new_score?: number;
          new_tier?: string;
          old_score?: number;
          old_tier?: string;
        };
        Relationships: [];
      };
      treasury_accountability_polls: {
        Row: {
          closes_epoch: number;
          created_at: string | null;
          cycle_number: number;
          next_cycle_epoch: number | null;
          opened_epoch: number;
          proposal_index: number;
          proposal_tx_hash: string;
          results_summary: Json | null;
          status: string;
        };
        Insert: {
          closes_epoch: number;
          created_at?: string | null;
          cycle_number?: number;
          next_cycle_epoch?: number | null;
          opened_epoch: number;
          proposal_index: number;
          proposal_tx_hash: string;
          results_summary?: Json | null;
          status?: string;
        };
        Update: {
          closes_epoch?: number;
          created_at?: string | null;
          cycle_number?: number;
          next_cycle_epoch?: number | null;
          opened_epoch?: number;
          proposal_index?: number;
          proposal_tx_hash?: string;
          results_summary?: Json | null;
          status?: string;
        };
        Relationships: [];
      };
      treasury_accountability_responses: {
        Row: {
          created_at: string | null;
          cycle_number: number;
          delivered_rating: string;
          evidence_text: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          user_address: string;
          would_approve_again: string;
        };
        Insert: {
          created_at?: string | null;
          cycle_number: number;
          delivered_rating: string;
          evidence_text?: string | null;
          proposal_index: number;
          proposal_tx_hash: string;
          user_address: string;
          would_approve_again: string;
        };
        Update: {
          created_at?: string | null;
          cycle_number?: number;
          delivered_rating?: string;
          evidence_text?: string | null;
          proposal_index?: number;
          proposal_tx_hash?: string;
          user_address?: string;
          would_approve_again?: string;
        };
        Relationships: [];
      };
      treasury_health_snapshots: {
        Row: {
          balance_trend: number;
          burn_rate_per_epoch: number;
          epoch: number;
          health_score: number;
          income_stability: number;
          pending_count: number;
          pending_load: number;
          pending_total_ada: number;
          runway_adequacy: number;
          runway_months: number;
          snapshot_at: string;
          withdrawal_velocity: number;
        };
        Insert: {
          balance_trend: number;
          burn_rate_per_epoch: number;
          epoch: number;
          health_score: number;
          income_stability: number;
          pending_count: number;
          pending_load: number;
          pending_total_ada: number;
          runway_adequacy: number;
          runway_months: number;
          snapshot_at?: string;
          withdrawal_velocity: number;
        };
        Update: {
          balance_trend?: number;
          burn_rate_per_epoch?: number;
          epoch?: number;
          health_score?: number;
          income_stability?: number;
          pending_count?: number;
          pending_load?: number;
          pending_total_ada?: number;
          runway_adequacy?: number;
          runway_months?: number;
          snapshot_at?: string;
          withdrawal_velocity?: number;
        };
        Relationships: [];
      };
      treasury_snapshots: {
        Row: {
          balance_lovelace: number;
          epoch_no: number;
          fees_lovelace: number | null;
          reserves_income_lovelace: number | null;
          reserves_lovelace: number | null;
          snapshot_at: string | null;
          withdrawals_lovelace: number;
        };
        Insert: {
          balance_lovelace: number;
          epoch_no: number;
          fees_lovelace?: number | null;
          reserves_income_lovelace?: number | null;
          reserves_lovelace?: number | null;
          snapshot_at?: string | null;
          withdrawals_lovelace?: number;
        };
        Update: {
          balance_lovelace?: number;
          epoch_no?: number;
          fees_lovelace?: number | null;
          reserves_income_lovelace?: number | null;
          reserves_lovelace?: number | null;
          snapshot_at?: string | null;
          withdrawals_lovelace?: number;
        };
        Relationships: [];
      };
      user_channels: {
        Row: {
          channel: string;
          channel_identifier: string;
          config: Json | null;
          connected_at: string;
          id: string;
          user_id: string | null;
          user_wallet: string;
        };
        Insert: {
          channel: string;
          channel_identifier: string;
          config?: Json | null;
          connected_at?: string;
          id?: string;
          user_id?: string | null;
          user_wallet: string;
        };
        Update: {
          channel?: string;
          channel_identifier?: string;
          config?: Json | null;
          connected_at?: string;
          id?: string;
          user_id?: string | null;
          user_wallet?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_channels_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_entity_subscriptions: {
        Row: {
          created_at: string;
          entity_id: string;
          entity_type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          entity_type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_entity_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_governance_profile_history: {
        Row: {
          alignment_scores: Json | null;
          confidence: number | null;
          confidence_sources: Json | null;
          pca_coordinates: number[] | null;
          personality_label: string | null;
          snapshot_at: string;
          user_id: string;
          votes_used: number | null;
          wallet_address: string | null;
        };
        Insert: {
          alignment_scores?: Json | null;
          confidence?: number | null;
          confidence_sources?: Json | null;
          pca_coordinates?: number[] | null;
          personality_label?: string | null;
          snapshot_at?: string;
          user_id: string;
          votes_used?: number | null;
          wallet_address?: string | null;
        };
        Update: {
          alignment_scores?: Json | null;
          confidence?: number | null;
          confidence_sources?: Json | null;
          pca_coordinates?: number[] | null;
          personality_label?: string | null;
          snapshot_at?: string;
          user_id?: string;
          votes_used?: number | null;
          wallet_address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_governance_profile_history_new_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_governance_profiles: {
        Row: {
          alignment_scores: Json | null;
          confidence: number;
          confidence_sources: Json | null;
          has_quick_match: boolean;
          pca_coordinates: number[] | null;
          personality_label: string | null;
          updated_at: string | null;
          user_id: string;
          votes_used: number;
          wallet_address: string | null;
        };
        Insert: {
          alignment_scores?: Json | null;
          confidence?: number;
          confidence_sources?: Json | null;
          has_quick_match?: boolean;
          pca_coordinates?: number[] | null;
          personality_label?: string | null;
          updated_at?: string | null;
          user_id: string;
          votes_used?: number;
          wallet_address?: string | null;
        };
        Update: {
          alignment_scores?: Json | null;
          confidence?: number;
          confidence_sources?: Json | null;
          has_quick_match?: boolean;
          pca_coordinates?: number[] | null;
          personality_label?: string | null;
          updated_at?: string | null;
          user_id?: string;
          votes_used?: number;
          wallet_address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_governance_profiles_new_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_hub_checkins: {
        Row: {
          checked_in_at: string;
          epoch: number;
          id: string;
          user_stake_address: string;
        };
        Insert: {
          checked_in_at?: string;
          epoch: number;
          id?: string;
          user_stake_address: string;
        };
        Update: {
          checked_in_at?: string;
          epoch?: number;
          id?: string;
          user_stake_address?: string;
        };
        Relationships: [];
      };
      user_notification_preferences: {
        Row: {
          alert_coverage_changed: boolean;
          alert_drep_voted: boolean;
          alert_milestone_earned: boolean;
          alert_score_shifted: boolean;
          created_at: string;
          digest_frequency: string;
          email: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alert_coverage_changed?: boolean;
          alert_drep_voted?: boolean;
          alert_milestone_earned?: boolean;
          alert_score_shifted?: boolean;
          created_at?: string;
          digest_frequency?: string;
          email?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alert_coverage_changed?: boolean;
          alert_drep_voted?: boolean;
          alert_milestone_earned?: boolean;
          alert_score_shifted?: boolean;
          created_at?: string;
          digest_frequency?: string;
          email?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_wallets: {
        Row: {
          drep_id: string | null;
          label: string | null;
          last_used: string | null;
          linked_at: string | null;
          payment_address: string;
          pool_id: string | null;
          segments: string[] | null;
          stake_address: string;
          user_id: string;
        };
        Insert: {
          drep_id?: string | null;
          label?: string | null;
          last_used?: string | null;
          linked_at?: string | null;
          payment_address: string;
          pool_id?: string | null;
          segments?: string[] | null;
          stake_address: string;
          user_id: string;
        };
        Update: {
          drep_id?: string | null;
          label?: string | null;
          last_used?: string | null;
          linked_at?: string | null;
          payment_address?: string;
          pool_id?: string | null;
          segments?: string[] | null;
          stake_address?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_wallets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          claimed_drep_id: string | null;
          delegation_history: Json[] | null;
          digest_frequency: string | null;
          display_name: string | null;
          email: string | null;
          email_verified: boolean | null;
          governance_depth: string;
          governance_level: string | null;
          id: string;
          last_active: string | null;
          last_epoch_visited: number | null;
          last_push_check: string | null;
          last_visit_at: string | null;
          notification_preferences: Json | null;
          onboarding_checklist: Json | null;
          poll_count: number | null;
          prefs: Json | null;
          push_subscriptions: Json | null;
          visit_streak: number | null;
          wallet_address: string;
          watchlist: string[] | null;
        };
        Insert: {
          claimed_drep_id?: string | null;
          delegation_history?: Json[] | null;
          digest_frequency?: string | null;
          display_name?: string | null;
          email?: string | null;
          email_verified?: boolean | null;
          governance_depth?: string;
          governance_level?: string | null;
          id?: string;
          last_active?: string | null;
          last_epoch_visited?: number | null;
          last_push_check?: string | null;
          last_visit_at?: string | null;
          notification_preferences?: Json | null;
          onboarding_checklist?: Json | null;
          poll_count?: number | null;
          prefs?: Json | null;
          push_subscriptions?: Json | null;
          visit_streak?: number | null;
          wallet_address: string;
          watchlist?: string[] | null;
        };
        Update: {
          claimed_drep_id?: string | null;
          delegation_history?: Json[] | null;
          digest_frequency?: string | null;
          display_name?: string | null;
          email?: string | null;
          email_verified?: boolean | null;
          governance_depth?: string;
          governance_level?: string | null;
          id?: string;
          last_active?: string | null;
          last_epoch_visited?: number | null;
          last_push_check?: string | null;
          last_visit_at?: string | null;
          notification_preferences?: Json | null;
          onboarding_checklist?: Json | null;
          poll_count?: number | null;
          prefs?: Json | null;
          push_subscriptions?: Json | null;
          visit_streak?: number | null;
          wallet_address?: string;
          watchlist?: string[] | null;
        };
        Relationships: [];
      };
      vote_explanations: {
        Row: {
          ai_assisted: boolean | null;
          created_at: string | null;
          drep_id: string;
          explanation_text: string;
          id: string;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at: string | null;
        };
        Insert: {
          ai_assisted?: boolean | null;
          created_at?: string | null;
          drep_id: string;
          explanation_text: string;
          id?: string;
          proposal_index: number;
          proposal_tx_hash: string;
          updated_at?: string | null;
        };
        Update: {
          ai_assisted?: boolean | null;
          created_at?: string | null;
          drep_id?: string;
          explanation_text?: string;
          id?: string;
          proposal_index?: number;
          proposal_tx_hash?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      vote_rationales: {
        Row: {
          ai_summary: string | null;
          drep_id: string;
          fetched_at: string | null;
          hash_check_attempted_at: string | null;
          hash_verified: boolean | null;
          meta_url: string | null;
          proposal_index: number | null;
          proposal_tx_hash: string | null;
          rationale_text: string | null;
          vote_tx_hash: string;
        };
        Insert: {
          ai_summary?: string | null;
          drep_id: string;
          fetched_at?: string | null;
          hash_check_attempted_at?: string | null;
          hash_verified?: boolean | null;
          meta_url?: string | null;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          rationale_text?: string | null;
          vote_tx_hash: string;
        };
        Update: {
          ai_summary?: string | null;
          drep_id?: string;
          fetched_at?: string | null;
          hash_check_attempted_at?: string | null;
          hash_verified?: boolean | null;
          meta_url?: string | null;
          proposal_index?: number | null;
          proposal_tx_hash?: string | null;
          rationale_text?: string | null;
          vote_tx_hash?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_ai_summary_coverage: {
        Row: {
          proposals_with_abstract: number | null;
          proposals_with_summary: number | null;
          rationales_with_summary: number | null;
          rationales_with_text: number | null;
          total_proposals: number | null;
          total_rationales: number | null;
        };
        Relationships: [];
      };
      v_api_abuse_signals: {
        Row: {
          error_rate_pct: number | null;
          ip_hash: string | null;
          rate_limit_hits: number | null;
          requests_last_hour: number | null;
          unique_keys_used: number | null;
        };
        Relationships: [];
      };
      v_api_daily_stats: {
        Row: {
          day: string | null;
          errors_5xx: number | null;
          p95_ms: number | null;
          rate_limit_hits: number | null;
          tier: string | null;
          total_requests: number | null;
          unique_keys: number | null;
        };
        Relationships: [];
      };
      v_api_hourly_stats: {
        Row: {
          avg_data_age_s: number | null;
          endpoint: string | null;
          error_rate_pct: number | null;
          errors_5xx: number | null;
          hour: string | null;
          p50_ms: number | null;
          p95_ms: number | null;
          p99_ms: number | null;
          rate_limited: number | null;
          requests: number | null;
          tier: string | null;
        };
        Relationships: [];
      };
      v_api_key_stats: {
        Row: {
          errors_last_day: number | null;
          key_created_at: string | null;
          key_id: string | null;
          key_prefix: string | null;
          last_used_at: string | null;
          name: string | null;
          rate_limit: number | null;
          rate_limits_last_day: number | null;
          rate_window: string | null;
          requests_last_7d: number | null;
          requests_last_day: number | null;
          requests_last_hour: number | null;
          tier: string | null;
        };
        Relationships: [];
      };
      v_canonical_summary_coverage: {
        Row: {
          total_proposals: number | null;
          with_canonical_summary: number | null;
          with_proposal_id: number | null;
        };
        Relationships: [];
      };
      v_hash_verification: {
        Row: {
          mismatch_rate_pct: number | null;
          rationale_mismatch: number | null;
          rationale_pending: number | null;
          rationale_unreachable: number | null;
          rationale_verified: number | null;
        };
        Relationships: [];
      };
      v_metadata_verification: {
        Row: {
          drep_mismatch: number | null;
          drep_pending: number | null;
          drep_verified: number | null;
          drep_with_anchor_hash: number | null;
        };
        Relationships: [];
      };
      v_sync_health: {
        Row: {
          failure_count: number | null;
          last_duration_ms: number | null;
          last_error: string | null;
          last_finished: string | null;
          last_run: string | null;
          last_success: boolean | null;
          success_count: number | null;
          sync_type: string | null;
        };
        Relationships: [];
      };
      v_system_stats: {
        Row: {
          dreps_with_snapshots: number | null;
          newest_summary_fetch: string | null;
          newest_vote_time: number | null;
          total_dreps: number | null;
          total_power_snapshots: number | null;
          total_proposals: number | null;
          total_rationales: number | null;
          total_votes: number | null;
        };
        Relationships: [];
      };
      v_vote_power_coverage: {
        Row: {
          coverage_pct: number | null;
          exact_count: number | null;
          nearest_count: number | null;
          null_power: number | null;
          total_votes: number | null;
          with_power: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      embedding_similarity: {
        Args: { embedding_a: string; embedding_b: string };
        Returns: number;
      };
      match_embeddings: {
        Args: {
          match_entity_type: string;
          match_limit?: number;
          min_similarity?: number;
          query_embedding: string;
        };
        Returns: {
          entity_id: string;
          entity_type: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
