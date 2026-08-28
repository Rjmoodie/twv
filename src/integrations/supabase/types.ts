export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_cache: {
        Row: {
          cache_data: Json
          cache_key: string
          created_at: string | null
          expires_at: string
          id: string
          ttl_seconds: number
        }
        Insert: {
          cache_data: Json
          cache_key: string
          created_at?: string | null
          expires_at: string
          id?: string
          ttl_seconds?: number
        }
        Update: {
          cache_data?: Json
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ttl_seconds?: number
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          created_at: string | null
          id: number
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      brokerage_connections: {
        Row: {
          account_id: string | null
          account_type: string | null
          api_key: string
          api_secret: string
          approval_required: boolean
          autonomous_enabled: boolean
          created_at: string
          drawdown_pause_pct: number
          environment: string
          frequency: string
          id: string
          is_active: boolean
          kill_switch: boolean
          last_run_at: string | null
          max_deploy_pct_per_run: number
          max_position_pct: number
          max_trades_per_run: number
          next_run_at: string | null
          portfolio_id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_type?: string | null
          api_key: string
          api_secret: string
          approval_required?: boolean
          autonomous_enabled?: boolean
          created_at?: string
          drawdown_pause_pct?: number
          environment?: string
          frequency?: string
          id?: string
          is_active?: boolean
          kill_switch?: boolean
          last_run_at?: string | null
          max_deploy_pct_per_run?: number
          max_position_pct?: number
          max_trades_per_run?: number
          next_run_at?: string | null
          portfolio_id: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_type?: string | null
          api_key?: string
          api_secret?: string
          approval_required?: boolean
          autonomous_enabled?: boolean
          created_at?: string
          drawdown_pause_pct?: number
          environment?: string
          frequency?: string
          id?: string
          is_active?: boolean
          kill_switch?: boolean
          last_run_at?: string | null
          max_deploy_pct_per_run?: number
          max_position_pct?: number
          max_trades_per_run?: number
          next_run_at?: string | null
          portfolio_id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brokerage_connections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      brrrr_deals: {
        Row: {
          created_at: string
          deal_name: string
          id: string
          inputs: Json
          notes: string | null
          results: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_name: string
          id?: string
          inputs: Json
          notes?: string | null
          results: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_name?: string
          id?: string
          inputs?: Json
          notes?: string | null
          results?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_listings: {
        Row: {
          asking_price: number
          bor_documents: string[] | null
          bor_visibility: string | null
          business_name: string
          cash_flow: number | null
          competitive_advantages: string | null
          contact_requests_count: number | null
          created_at: string
          description: string
          documents: string[] | null
          ebitda: number
          growth_potential: string | null
          id: string
          industry: string
          key_value_drivers: string | null
          location: string
          revenue: number
          status: string
          updated_at: string
          user_id: string
          valuation_summary: Json | null
          views_count: number | null
          visibility: string
        }
        Insert: {
          asking_price: number
          bor_documents?: string[] | null
          bor_visibility?: string | null
          business_name: string
          cash_flow?: number | null
          competitive_advantages?: string | null
          contact_requests_count?: number | null
          created_at?: string
          description: string
          documents?: string[] | null
          ebitda: number
          growth_potential?: string | null
          id?: string
          industry: string
          key_value_drivers?: string | null
          location: string
          revenue: number
          status?: string
          updated_at?: string
          user_id: string
          valuation_summary?: Json | null
          views_count?: number | null
          visibility?: string
        }
        Update: {
          asking_price?: number
          bor_documents?: string[] | null
          bor_visibility?: string | null
          business_name?: string
          cash_flow?: number | null
          competitive_advantages?: string | null
          contact_requests_count?: number | null
          created_at?: string
          description?: string
          documents?: string[] | null
          ebitda?: number
          growth_potential?: string | null
          id?: string
          industry?: string
          key_value_drivers?: string | null
          location?: string
          revenue?: number
          status?: string
          updated_at?: string
          user_id?: string
          valuation_summary?: Json | null
          views_count?: number | null
          visibility?: string
        }
        Relationships: []
      }
      cache_configuration: {
        Row: {
          cache_type: string
          cleanup_interval_ms: number | null
          created_at: string | null
          default_ttl_ms: number | null
          enabled: boolean | null
          id: string
          max_size_mb: number | null
          updated_at: string | null
        }
        Insert: {
          cache_type: string
          cleanup_interval_ms?: number | null
          created_at?: string | null
          default_ttl_ms?: number | null
          enabled?: boolean | null
          id?: string
          max_size_mb?: number | null
          updated_at?: string | null
        }
        Update: {
          cache_type?: string
          cleanup_interval_ms?: number | null
          created_at?: string | null
          default_ttl_ms?: number | null
          enabled?: boolean | null
          id?: string
          max_size_mb?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cache_invalidation_logs: {
        Row: {
          cache_type: string
          created_at: string | null
          id: string
          invalidation_reason: string | null
          invalidation_type: string
          keys_affected: number | null
        }
        Insert: {
          cache_type: string
          created_at?: string | null
          id?: string
          invalidation_reason?: string | null
          invalidation_type: string
          keys_affected?: number | null
        }
        Update: {
          cache_type?: string
          created_at?: string | null
          id?: string
          invalidation_reason?: string | null
          invalidation_type?: string
          keys_affected?: number | null
        }
        Relationships: []
      }
      cache_keys: {
        Row: {
          access_count: number | null
          cache_key: string
          cache_type: string
          created_at: string | null
          data_size_bytes: number | null
          expires_at: string | null
          id: string
          last_accessed: string | null
          updated_at: string | null
        }
        Insert: {
          access_count?: number | null
          cache_key: string
          cache_type: string
          created_at?: string | null
          data_size_bytes?: number | null
          expires_at?: string | null
          id?: string
          last_accessed?: string | null
          updated_at?: string | null
        }
        Update: {
          access_count?: number | null
          cache_key?: string
          cache_type?: string
          created_at?: string | null
          data_size_bytes?: number | null
          expires_at?: string | null
          id?: string
          last_accessed?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cache_performance_logs: {
        Row: {
          cache_hit: boolean | null
          cache_type: string
          created_at: string | null
          error_message: string | null
          id: string
          operation_type: string
          response_time_ms: number
        }
        Insert: {
          cache_hit?: boolean | null
          cache_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          operation_type: string
          response_time_ms: number
        }
        Update: {
          cache_hit?: boolean | null
          cache_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          operation_type?: string
          response_time_ms?: number
        }
        Relationships: []
      }
      cache_statistics: {
        Row: {
          average_response_time_ms: number | null
          cache_hits: number | null
          cache_misses: number | null
          cache_type: string
          created_at: string | null
          hit_rate: number | null
          id: string
          last_updated: string | null
          total_cache_size_bytes: number | null
          total_items: number | null
          total_requests: number | null
        }
        Insert: {
          average_response_time_ms?: number | null
          cache_hits?: number | null
          cache_misses?: number | null
          cache_type: string
          created_at?: string | null
          hit_rate?: number | null
          id?: string
          last_updated?: string | null
          total_cache_size_bytes?: number | null
          total_items?: number | null
          total_requests?: number | null
        }
        Update: {
          average_response_time_ms?: number | null
          cache_hits?: number | null
          cache_misses?: number | null
          cache_type?: string
          created_at?: string | null
          hit_rate?: number | null
          id?: string
          last_updated?: string | null
          total_cache_size_bytes?: number | null
          total_items?: number | null
          total_requests?: number | null
        }
        Relationships: []
      }
      calendar_reminders: {
        Row: {
          channels: string[]
          created_at: string
          days_before: number
          delivery_time: string
          event_date: string
          event_key: string
          event_type: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          days_before?: number
          delivery_time?: string
          event_date: string
          event_key: string
          event_type: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          days_before?: number
          delivery_time?: string
          event_date?: string
          event_key?: string
          event_type?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tool_launch: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tool_launch?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tool_launch?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "coach_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_narrative_cache: {
        Row: {
          accession_number: string
          analysis_version: string
          claims: Json
          document_url: string
          fetched_at: string
          filing_date: string
          form: string
          report_date: string | null
          ticker: string
        }
        Insert: {
          accession_number: string
          analysis_version: string
          claims: Json
          document_url: string
          fetched_at?: string
          filing_date: string
          form: string
          report_date?: string | null
          ticker: string
        }
        Update: {
          accession_number?: string
          analysis_version?: string
          claims?: Json
          document_url?: string
          fetched_at?: string
          filing_date?: string
          form?: string
          report_date?: string | null
          ticker?: string
        }
        Relationships: []
      }
      comparable_sales: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          comp_address: string
          comp_city: string | null
          comp_state: string | null
          comp_zip: string | null
          created_at: string | null
          distance_miles: number | null
          id: string
          property_id: string | null
          sale_date: string | null
          sale_price: number | null
          similarity_score: number | null
          square_feet: number | null
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          comp_address: string
          comp_city?: string | null
          comp_state?: string | null
          comp_zip?: string | null
          created_at?: string | null
          distance_miles?: number | null
          id?: string
          property_id?: string | null
          sale_date?: string | null
          sale_price?: number | null
          similarity_score?: number | null
          square_feet?: number | null
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          comp_address?: string
          comp_city?: string | null
          comp_state?: string | null
          comp_zip?: string | null
          created_at?: string | null
          distance_miles?: number | null
          id?: string
          property_id?: string | null
          sale_date?: string | null
          sale_price?: number | null
          similarity_score?: number | null
          square_feet?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comparable_sales_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      county_assessor_data: {
        Row: {
          assessed_value: number | null
          assessor_id: string | null
          county_name: string
          created_at: string | null
          exemptions: string[] | null
          id: string
          improvement_value: number | null
          land_use: string | null
          land_value: number | null
          last_sale_date: string | null
          last_sale_price: number | null
          owner_address: string | null
          owner_city: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_state: string | null
          owner_zip: string | null
          parcel_number: string | null
          property_class: string | null
          property_id: string | null
          raw_data: Json | null
          tax_delinquent: boolean | null
          tax_delinquent_amount: number | null
          tax_year: number | null
          updated_at: string | null
          zoning: string | null
        }
        Insert: {
          assessed_value?: number | null
          assessor_id?: string | null
          county_name: string
          created_at?: string | null
          exemptions?: string[] | null
          id?: string
          improvement_value?: number | null
          land_use?: string | null
          land_value?: number | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          owner_address?: string | null
          owner_city?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_state?: string | null
          owner_zip?: string | null
          parcel_number?: string | null
          property_class?: string | null
          property_id?: string | null
          raw_data?: Json | null
          tax_delinquent?: boolean | null
          tax_delinquent_amount?: number | null
          tax_year?: number | null
          updated_at?: string | null
          zoning?: string | null
        }
        Update: {
          assessed_value?: number | null
          assessor_id?: string | null
          county_name?: string
          created_at?: string | null
          exemptions?: string[] | null
          id?: string
          improvement_value?: number | null
          land_use?: string | null
          land_value?: number | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          owner_address?: string | null
          owner_city?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_state?: string | null
          owner_zip?: string | null
          parcel_number?: string | null
          property_class?: string | null
          property_id?: string | null
          raw_data?: Json | null
          tax_delinquent?: boolean | null
          tax_delinquent_amount?: number | null
          tax_year?: number | null
          updated_at?: string | null
          zoning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "county_assessor_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      county_sync_log: {
        Row: {
          completed_at: string | null
          county_name: string
          errors: string[] | null
          id: string
          processing_time_seconds: number | null
          records_added: number
          records_processed: number
          records_skipped: number
          records_updated: number
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          county_name: string
          errors?: string[] | null
          id?: string
          processing_time_seconds?: number | null
          records_added?: number
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          started_at?: string | null
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          county_name?: string
          errors?: string[] | null
          id?: string
          processing_time_seconds?: number | null
          records_added?: number
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      dashboard_quote_cache: {
        Row: {
          fetched_at: string
          payload: Json
          symbol: string
        }
        Insert: {
          fetched_at?: string
          payload: Json
          symbol: string
        }
        Update: {
          fetched_at?: string
          payload?: Json
          symbol?: string
        }
        Relationships: []
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          expires_at: string | null
          id: string
          notes: string | null
          request_type: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      discord_links: {
        Row: {
          created_at: string | null
          discord_user_id: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          discord_user_id: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          discord_user_id?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      discord_role_jobs: {
        Row: {
          action: string
          attempts: number | null
          created_at: string | null
          id: number
          run_after: string | null
          subscription_tier: string | null
          user_id: string
        }
        Insert: {
          action: string
          attempts?: number | null
          created_at?: string | null
          id?: number
          run_after?: string | null
          subscription_tier?: string | null
          user_id: string
        }
        Update: {
          action?: string
          attempts?: number | null
          created_at?: string | null
          id?: number
          run_after?: string | null
          subscription_tier?: string | null
          user_id?: string
        }
        Relationships: []
      }
      discord_role_mappings: {
        Row: {
          created_at: string | null
          discord_role_id: string
          discord_role_name: string
          id: string
          subscription_tier: string
        }
        Insert: {
          created_at?: string | null
          discord_role_id: string
          discord_role_name: string
          id?: string
          subscription_tier: string
        }
        Update: {
          created_at?: string | null
          discord_role_id?: string
          discord_role_name?: string
          id?: string
          subscription_tier?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          donor_email: string | null
          donor_name: string | null
          id: string
          is_anonymous: boolean
          message: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "funding_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          bounced_count: number | null
          clicked_count: number | null
          created_at: string
          delivered_count: number | null
          id: string
          metadata: Json | null
          name: string
          opened_count: number | null
          scheduled_at: string | null
          segment: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string
          delivered_count?: number | null
          id?: string
          metadata?: Json | null
          name: string
          opened_count?: number | null
          scheduled_at?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          bounced_count?: number | null
          clicked_count?: number | null
          created_at?: string
          delivered_count?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          opened_count?: number | null
          scheduled_at?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_delivery_events: {
        Row: {
          created_at: string
          email: string
          event: string
          id: string
          occurred_at: string
          outbox_id: string | null
          payload: Json
          provider_message_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event: string
          id?: string
          occurred_at?: string
          outbox_id?: string | null
          payload?: Json
          provider_message_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event?: string
          id?: string
          occurred_at?: string
          outbox_id?: string | null
          payload?: Json
          provider_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_events_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          id: number
          recipient: string
          sent_at: string
        }
        Insert: {
          id?: number
          recipient: string
          sent_at?: string
        }
        Update: {
          id?: number
          recipient?: string
          sent_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          provider_event: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          provider_event?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          provider_event?: string | null
          reason?: string
        }
        Relationships: []
      }
      execution_log: {
        Row: {
          action: string
          alpaca_order_id: string | null
          approved_at: string | null
          bucket: string
          connection_id: string
          created_at: string
          error: string | null
          fill_price: number | null
          filled_at: string | null
          id: string
          notional_usd: number | null
          portfolio_id: string
          rationale: string | null
          requires_approval: boolean
          run_id: string | null
          shares: number | null
          status: string
          submitted_at: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          action: string
          alpaca_order_id?: string | null
          approved_at?: string | null
          bucket: string
          connection_id: string
          created_at?: string
          error?: string | null
          fill_price?: number | null
          filled_at?: string | null
          id?: string
          notional_usd?: number | null
          portfolio_id: string
          rationale?: string | null
          requires_approval?: boolean
          run_id?: string | null
          shares?: number | null
          status?: string
          submitted_at?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          action?: string
          alpaca_order_id?: string | null
          approved_at?: string | null
          bucket?: string
          connection_id?: string
          created_at?: string
          error?: string | null
          fill_price?: number | null
          filled_at?: string | null
          id?: string
          notional_usd?: number | null
          portfolio_id?: string
          rationale?: string | null
          requires_approval?: boolean
          run_id?: string | null
          shares?: number | null
          status?: string
          submitted_at?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "brokerage_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_log_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "execution_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_runs: {
        Row: {
          completed_at: string | null
          connection_id: string
          error: string | null
          id: string
          portfolio_id: string
          run_type: string
          started_at: string
          status: string
          summary: Json | null
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          error?: string | null
          id?: string
          portfolio_id: string
          run_type: string
          started_at?: string
          status?: string
          summary?: Json | null
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          error?: string | null
          id?: string
          portfolio_id?: string
          run_type?: string
          started_at?: string
          status?: string
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "brokerage_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_runs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_votes: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "user_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_events: {
        Row: {
          category: string
          color: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          is_completed: boolean
          journey_id: string | null
          journey_plan_id: string | null
          metadata: Json
          source_key: string | null
          source_revision: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          color?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          event_type: string
          id?: string
          is_completed?: boolean
          journey_id?: string | null
          journey_plan_id?: string | null
          metadata?: Json
          source_key?: string | null
          source_revision?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          color?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_completed?: boolean
          journey_id?: string | null
          journey_plan_id?: string | null
          metadata?: Json
          source_key?: string | null
          source_revision?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_events_journey_plan_id_fkey"
            columns: ["journey_plan_id"]
            isOneToOne: false
            referencedRelation: "journey_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_profiles: {
        Row: {
          age: number | null
          completed_intake: boolean | null
          created_at: string | null
          current_savings_range: string | null
          dependents: number | null
          employer_match_pct: number | null
          employment_type: string | null
          has_emergency_fund: boolean | null
          has_hsa_access: boolean | null
          has_retirement_account: boolean | null
          high_interest_debt: number | null
          housing_status: string | null
          id: string
          income_range: string | null
          liquid_savings: number | null
          low_interest_debt: number | null
          marital_status: string | null
          max_plaid_connections: number
          monthly_expenses: number | null
          monthly_take_home: number | null
          primary_concern: string | null
          risk_tolerance: string | null
          snapshot_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          completed_intake?: boolean | null
          created_at?: string | null
          current_savings_range?: string | null
          dependents?: number | null
          employer_match_pct?: number | null
          employment_type?: string | null
          has_emergency_fund?: boolean | null
          has_hsa_access?: boolean | null
          has_retirement_account?: boolean | null
          high_interest_debt?: number | null
          housing_status?: string | null
          id?: string
          income_range?: string | null
          liquid_savings?: number | null
          low_interest_debt?: number | null
          marital_status?: string | null
          max_plaid_connections?: number
          monthly_expenses?: number | null
          monthly_take_home?: number | null
          primary_concern?: string | null
          risk_tolerance?: string | null
          snapshot_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          completed_intake?: boolean | null
          created_at?: string | null
          current_savings_range?: string | null
          dependents?: number | null
          employer_match_pct?: number | null
          employment_type?: string | null
          has_emergency_fund?: boolean | null
          has_hsa_access?: boolean | null
          has_retirement_account?: boolean | null
          high_interest_debt?: number | null
          housing_status?: string | null
          id?: string
          income_range?: string | null
          liquid_savings?: number | null
          low_interest_debt?: number | null
          marital_status?: string | null
          max_plaid_connections?: number
          monthly_expenses?: number | null
          monthly_take_home?: number | null
          primary_concern?: string | null
          risk_tolerance?: string | null
          snapshot_completed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      funding_campaigns: {
        Row: {
          category: string
          created_at: string
          current_amount: number
          deadline: string | null
          description: string
          financial_breakdown: Json | null
          id: string
          image_url: string | null
          projection_data: Json | null
          status: string
          target_amount: number
          title: string
          updated_at: string
          url_slug: string | null
          user_id: string
          video_url: string | null
          visibility: string
        }
        Insert: {
          category: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          description: string
          financial_breakdown?: Json | null
          id?: string
          image_url?: string | null
          projection_data?: Json | null
          status?: string
          target_amount: number
          title: string
          updated_at?: string
          url_slug?: string | null
          user_id: string
          video_url?: string | null
          visibility?: string
        }
        Update: {
          category?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          description?: string
          financial_breakdown?: Json | null
          id?: string
          image_url?: string | null
          projection_data?: Json | null
          status?: string
          target_amount?: number
          title?: string
          updated_at?: string
          url_slug?: string | null
          user_id?: string
          video_url?: string | null
          visibility?: string
        }
        Relationships: []
      }
      investment_analytics: {
        Row: {
          break_even_time: number
          cap_rate: number
          cash_on_cash_return: number
          created_at: string | null
          id: string
          investment_score: number
          market_percentile: number
          property_id: string | null
          recommendations: string[] | null
          risk_score: number
          similar_properties_count: number
          total_return: number
          updated_at: string | null
        }
        Insert: {
          break_even_time?: number
          cap_rate?: number
          cash_on_cash_return?: number
          created_at?: string | null
          id?: string
          investment_score?: number
          market_percentile?: number
          property_id?: string | null
          recommendations?: string[] | null
          risk_score?: number
          similar_properties_count?: number
          total_return?: number
          updated_at?: string | null
        }
        Update: {
          break_even_time?: number
          cap_rate?: number
          cash_on_cash_return?: number
          created_at?: string | null
          id?: string
          investment_score?: number
          market_percentile?: number
          property_id?: string | null
          recommendations?: string[] | null
          risk_score?: number
          similar_properties_count?: number
          total_return?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_analytics_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_goals: {
        Row: {
          annual_contribution_growth_pct: number
          assumption_version: string
          created_at: string
          current_balance: number
          goal_type: string
          horizon_years: number
          id: string
          inflation_pct: number
          monthly_contribution: number
          projection: Json
          risk_profile: string
          status: string
          target_amount: number
          target_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_contribution_growth_pct?: number
          assumption_version: string
          created_at?: string
          current_balance?: number
          goal_type?: string
          horizon_years: number
          id?: string
          inflation_pct?: number
          monthly_contribution?: number
          projection?: Json
          risk_profile: string
          status?: string
          target_amount: number
          target_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_contribution_growth_pct?: number
          assumption_version?: string
          created_at?: string
          current_balance?: number
          goal_type?: string
          horizon_years?: number
          id?: string
          inflation_pct?: number
          monthly_contribution?: number
          projection?: Json
          risk_profile?: string
          status?: string
          target_amount?: number
          target_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journey_plan_actions: {
        Row: {
          action_key: string
          action_type: string
          amount: number | null
          cadence: string | null
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          plan_id: string
          source_revision: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key: string
          action_type: string
          amount?: number | null
          cadence?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          plan_id: string
          source_revision: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string
          action_type?: string
          amount?: number | null
          cadence?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json
          plan_id?: string
          source_revision?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_plan_actions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "journey_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_plans: {
        Row: {
          activated_analysis: Json | null
          activated_at: string | null
          activated_revision: number | null
          answers: Json
          assumptions: Json
          created_at: string
          currency_code: string
          id: string
          input_metadata: Json
          is_baseline: boolean
          journey_id: string
          locale: string
          monthly_commitment: number
          name: string
          parent_plan_id: string | null
          revision: number
          schema_version: number
          status: string
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_analysis?: Json | null
          activated_at?: string | null
          activated_revision?: number | null
          answers?: Json
          assumptions?: Json
          created_at?: string
          currency_code?: string
          id?: string
          input_metadata?: Json
          is_baseline?: boolean
          journey_id: string
          locale?: string
          monthly_commitment?: number
          name?: string
          parent_plan_id?: string | null
          revision?: number
          schema_version?: number
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_analysis?: Json | null
          activated_at?: string | null
          activated_revision?: number | null
          answers?: Json
          assumptions?: Json
          created_at?: string
          currency_code?: string
          id?: string
          input_metadata?: Json
          is_baseline?: boolean
          journey_id?: string
          locale?: string
          monthly_commitment?: number
          name?: string
          parent_plan_id?: string | null
          revision?: number
          schema_version?: number
          status?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_plans_parent_plan_id_fkey"
            columns: ["parent_plan_id"]
            isOneToOne: false
            referencedRelation: "journey_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_posts: {
        Row: {
          created_at: string
          headline: string
          id: string
          identity_mode: string
          journey_id: string
          journey_plan_id: string | null
          post_type: string
          reaction_clap: number
          reaction_fire: number
          reaction_muscle: number
          reaction_rocket: number
          show_exact_amounts: boolean
          show_percentages: boolean
          show_timeline: boolean
          source_revision: number | null
          stage_label: string | null
          status: string
          subheadline: string | null
          template_key: string
          timeline_label: string | null
          updated_at: string
          user_id: string
          verification_mode: string
          visibility: string
        }
        Insert: {
          created_at?: string
          headline: string
          id?: string
          identity_mode?: string
          journey_id: string
          journey_plan_id?: string | null
          post_type: string
          reaction_clap?: number
          reaction_fire?: number
          reaction_muscle?: number
          reaction_rocket?: number
          show_exact_amounts?: boolean
          show_percentages?: boolean
          show_timeline?: boolean
          source_revision?: number | null
          stage_label?: string | null
          status?: string
          subheadline?: string | null
          template_key: string
          timeline_label?: string | null
          updated_at?: string
          user_id: string
          verification_mode?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          headline?: string
          id?: string
          identity_mode?: string
          journey_id?: string
          journey_plan_id?: string | null
          post_type?: string
          reaction_clap?: number
          reaction_fire?: number
          reaction_muscle?: number
          reaction_rocket?: number
          show_exact_amounts?: boolean
          show_percentages?: boolean
          show_timeline?: boolean
          source_revision?: number | null
          stage_label?: string | null
          status?: string
          subheadline?: string | null
          template_key?: string
          timeline_label?: string | null
          updated_at?: string
          user_id?: string
          verification_mode?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_posts_journey_plan_id_fkey"
            columns: ["journey_plan_id"]
            isOneToOne: false
            referencedRelation: "journey_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reviews: {
        Row: {
          created_at: string
          data_source: string
          id: string
          notes: string | null
          source_record_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_source: string
          id?: string
          notes?: string | null
          source_record_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_source?: string
          id?: string
          notes?: string | null
          source_record_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lms_course_mappings: {
        Row: {
          course_id: string
          course_name: string
          course_url: string | null
          created_at: string | null
          id: string
          subscription_tier: string
        }
        Insert: {
          course_id: string
          course_name: string
          course_url?: string | null
          created_at?: string | null
          id?: string
          subscription_tier: string
        }
        Update: {
          course_id?: string
          course_name?: string
          course_url?: string | null
          created_at?: string | null
          id?: string
          subscription_tier?: string
        }
        Relationships: []
      }
      login_activity: {
        Row: {
          created_at: string
          device_type: string | null
          failure_reason: string | null
          id: string
          ip_address: unknown
          location: string | null
          login_timestamp: string
          session_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          location?: string | null
          login_timestamp?: string
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          location?: string | null
          login_timestamp?: string
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_analytics: {
        Row: {
          area_name: string
          average_days_on_market: number
          average_price: number
          average_price_per_sqft: number
          created_at: string | null
          id: string
          investment_opportunities: number
          market_activity: string | null
          market_id: string
          market_predictions: Json | null
          price_trend: string | null
          top_performing_areas: Json | null
          total_properties: number
          updated_at: string | null
        }
        Insert: {
          area_name: string
          average_days_on_market?: number
          average_price?: number
          average_price_per_sqft?: number
          created_at?: string | null
          id?: string
          investment_opportunities?: number
          market_activity?: string | null
          market_id: string
          market_predictions?: Json | null
          price_trend?: string | null
          top_performing_areas?: Json | null
          total_properties?: number
          updated_at?: string | null
        }
        Update: {
          area_name?: string
          average_days_on_market?: number
          average_price?: number
          average_price_per_sqft?: number
          created_at?: string | null
          id?: string
          investment_opportunities?: number
          market_activity?: string | null
          market_id?: string
          market_predictions?: Json | null
          price_trend?: string | null
          top_performing_areas?: Json | null
          total_properties?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      market_calendar_cache: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          payload: Json
          source: string
          source_url: string | null
        }
        Insert: {
          cache_key: string
          expires_at: string
          fetched_at?: string
          payload: Json
          source: string
          source_url?: string | null
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          payload?: Json
          source?: string
          source_url?: string | null
        }
        Relationships: []
      }
      market_insights: {
        Row: {
          confidence: number
          created_at: string | null
          data_points: Json | null
          description: string
          id: string
          impact: string
          insight_type: string
          market_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string | null
          data_points?: Json | null
          description: string
          id?: string
          impact: string
          insight_type: string
          market_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string | null
          data_points?: Json | null
          description?: string
          id?: string
          impact?: string
          insight_type?: string
          market_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      marketplace_messages: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_data_sources: {
        Row: {
          api_endpoint: string | null
          api_key_required: boolean | null
          coverage_areas: string[] | null
          created_at: string | null
          id: string
          last_sync_date: string | null
          rate_limit_requests_per_hour: number | null
          rate_limit_requests_per_minute: number | null
          source_name: string
          source_type: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key_required?: boolean | null
          coverage_areas?: string[] | null
          created_at?: string | null
          id?: string
          last_sync_date?: string | null
          rate_limit_requests_per_hour?: number | null
          rate_limit_requests_per_minute?: number | null
          source_name: string
          source_type?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key_required?: boolean | null
          coverage_areas?: string[] | null
          created_at?: string | null
          id?: string
          last_sync_date?: string | null
          rate_limit_requests_per_hour?: number | null
          rate_limit_requests_per_minute?: number | null
          source_name?: string
          source_type?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mls_listings: {
        Row: {
          annual_taxes: number | null
          appliances: string[] | null
          central_air: boolean | null
          closing_cost_estimate: number | null
          cooling_type: string | null
          created_at: string | null
          down_payment_estimate: number | null
          exterior_material: string | null
          features: string[] | null
          fireplace: boolean | null
          foundation_type: string | null
          garage_spaces: number | null
          heating_type: string | null
          hoa_fee: number | null
          hoa_frequency: string | null
          id: string
          insurance_cost: number | null
          listing_agent: string | null
          listing_date: string
          listing_office: string | null
          listing_price: number
          listing_status: string
          lot_features: string[] | null
          mls_id: string
          mls_source: string
          monthly_payment_estimate: number | null
          parking_type: string | null
          pool: boolean | null
          property_description: string | null
          property_id: string | null
          roof_type: string | null
          showing_instructions: string | null
          tax_year: number | null
          updated_at: string | null
          utilities_cost: number | null
          virtual_tour_url: string | null
        }
        Insert: {
          annual_taxes?: number | null
          appliances?: string[] | null
          central_air?: boolean | null
          closing_cost_estimate?: number | null
          cooling_type?: string | null
          created_at?: string | null
          down_payment_estimate?: number | null
          exterior_material?: string | null
          features?: string[] | null
          fireplace?: boolean | null
          foundation_type?: string | null
          garage_spaces?: number | null
          heating_type?: string | null
          hoa_fee?: number | null
          hoa_frequency?: string | null
          id?: string
          insurance_cost?: number | null
          listing_agent?: string | null
          listing_date: string
          listing_office?: string | null
          listing_price: number
          listing_status: string
          lot_features?: string[] | null
          mls_id: string
          mls_source: string
          monthly_payment_estimate?: number | null
          parking_type?: string | null
          pool?: boolean | null
          property_description?: string | null
          property_id?: string | null
          roof_type?: string | null
          showing_instructions?: string | null
          tax_year?: number | null
          updated_at?: string | null
          utilities_cost?: number | null
          virtual_tour_url?: string | null
        }
        Update: {
          annual_taxes?: number | null
          appliances?: string[] | null
          central_air?: boolean | null
          closing_cost_estimate?: number | null
          cooling_type?: string | null
          created_at?: string | null
          down_payment_estimate?: number | null
          exterior_material?: string | null
          features?: string[] | null
          fireplace?: boolean | null
          foundation_type?: string | null
          garage_spaces?: number | null
          heating_type?: string | null
          hoa_fee?: number | null
          hoa_frequency?: string | null
          id?: string
          insurance_cost?: number | null
          listing_agent?: string | null
          listing_date?: string
          listing_office?: string | null
          listing_price?: number
          listing_status?: string
          lot_features?: string[] | null
          mls_id?: string
          mls_source?: string
          monthly_payment_estimate?: number | null
          parking_type?: string | null
          pool?: boolean | null
          property_description?: string | null
          property_id?: string | null
          roof_type?: string | null
          showing_instructions?: string | null
          tax_year?: number | null
          updated_at?: string | null
          utilities_cost?: number | null
          virtual_tour_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mls_listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_open_houses: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string | null
          id: string
          mls_listing_id: string | null
          open_house_date: string
          refreshments: boolean | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          mls_listing_id?: string | null
          open_house_date: string
          refreshments?: boolean | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          mls_listing_id?: string | null
          open_house_date?: string
          refreshments?: boolean | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mls_open_houses_mls_listing_id_fkey"
            columns: ["mls_listing_id"]
            isOneToOne: false
            referencedRelation: "mls_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          mls_listing_id: string | null
          photo_type: string | null
          photo_url: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          mls_listing_id?: string | null
          photo_type?: string | null
          photo_url: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          mls_listing_id?: string | null
          photo_type?: string | null
          photo_url?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mls_photos_mls_listing_id_fkey"
            columns: ["mls_listing_id"]
            isOneToOne: false
            referencedRelation: "mls_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_price_history: {
        Row: {
          created_at: string | null
          id: string
          mls_listing_id: string | null
          new_price: number
          old_price: number | null
          price_change_date: string
          price_change_reason: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mls_listing_id?: string | null
          new_price: number
          old_price?: number | null
          price_change_date: string
          price_change_reason?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mls_listing_id?: string | null
          new_price?: number
          old_price?: number | null
          price_change_date?: string
          price_change_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mls_price_history_mls_listing_id_fkey"
            columns: ["mls_listing_id"]
            isOneToOne: false
            referencedRelation: "mls_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      mls_sync_log: {
        Row: {
          created_at: string | null
          errors: string[] | null
          id: string
          mls_source_id: string | null
          properties_added: number | null
          properties_found: number | null
          properties_processed: number | null
          properties_skipped: number | null
          properties_updated: number | null
          sync_end_time: string | null
          sync_start_time: string
          sync_status: string | null
          warnings: string[] | null
        }
        Insert: {
          created_at?: string | null
          errors?: string[] | null
          id?: string
          mls_source_id?: string | null
          properties_added?: number | null
          properties_found?: number | null
          properties_processed?: number | null
          properties_skipped?: number | null
          properties_updated?: number | null
          sync_end_time?: string | null
          sync_start_time: string
          sync_status?: string | null
          warnings?: string[] | null
        }
        Update: {
          created_at?: string | null
          errors?: string[] | null
          id?: string
          mls_source_id?: string | null
          properties_added?: number | null
          properties_found?: number | null
          properties_processed?: number | null
          properties_skipped?: number | null
          properties_updated?: number | null
          sync_end_time?: string | null
          sync_start_time?: string
          sync_status?: string | null
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "mls_sync_log_mls_source_id_fkey"
            columns: ["mls_source_id"]
            isOneToOne: false
            referencedRelation: "mls_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      model_predictions: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          model_id: string | null
          predicted_value: number
          prediction_date: string | null
          property_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string | null
          id?: string
          model_id?: string | null
          predicted_value: number
          prediction_date?: string | null
          property_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          model_id?: string | null
          predicted_value?: number
          prediction_date?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_predictions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "predictive_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_predictions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cash_flow: {
        Row: {
          clothing: number
          created_at: string
          education: number
          entertainment: number
          flow_month: string
          food: number
          healthcare: number
          housing: number
          id: string
          investment_income: number
          notes: string | null
          other_expenses: number
          other_income: number
          primary_income: number
          side_income: number
          subscriptions: number
          transport: number
          travel: number
          updated_at: string
          user_id: string
        }
        Insert: {
          clothing?: number
          created_at?: string
          education?: number
          entertainment?: number
          flow_month: string
          food?: number
          healthcare?: number
          housing?: number
          id?: string
          investment_income?: number
          notes?: string | null
          other_expenses?: number
          other_income?: number
          primary_income?: number
          side_income?: number
          subscriptions?: number
          transport?: number
          travel?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          clothing?: number
          created_at?: string
          education?: number
          entertainment?: number
          flow_month?: string
          food?: number
          healthcare?: number
          housing?: number
          id?: string
          investment_income?: number
          notes?: string | null
          other_expenses?: number
          other_income?: number
          primary_income?: number
          side_income?: number
          subscriptions?: number
          transport?: number
          travel?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          car_loans: number
          checking: number
          created_at: string
          credit_cards: number
          id: string
          investments: number
          mortgage: number
          notes: string | null
          other_assets: number
          other_liabilities: number
          real_estate: number
          savings: number
          snapshot_month: string
          student_loans: number
          updated_at: string
          user_id: string
        }
        Insert: {
          car_loans?: number
          checking?: number
          created_at?: string
          credit_cards?: number
          id?: string
          investments?: number
          mortgage?: number
          notes?: string | null
          other_assets?: number
          other_liabilities?: number
          real_estate?: number
          savings?: number
          snapshot_month: string
          student_loans?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          car_loans?: number
          checking?: number
          created_at?: string
          credit_cards?: number
          id?: string
          investments?: number
          mortgage?: number
          notes?: string | null
          other_assets?: number
          other_liabilities?: number
          real_estate?: number
          savings?: number
          snapshot_month?: string
          student_loans?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_channel_policies: {
        Row: {
          description: string
          email_mode: string
          email_preference_key: string
          email_variant: string
          event_type: string
          importance: string
          max_pushes_per_window: number | null
          push_mode: string
          rate_limit_key: string | null
          rate_window_minutes: number | null
          updated_at: string
        }
        Insert: {
          description?: string
          email_mode?: string
          email_preference_key?: string
          email_variant?: string
          event_type: string
          importance: string
          max_pushes_per_window?: number | null
          push_mode?: string
          rate_limit_key?: string | null
          rate_window_minutes?: number | null
          updated_at?: string
        }
        Update: {
          description?: string
          email_mode?: string
          email_preference_key?: string
          email_variant?: string
          event_type?: string
          importance?: string
          max_pushes_per_window?: number | null
          push_mode?: string
          rate_limit_key?: string | null
          rate_window_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          channels: string[]
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          channels?: string[]
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          delivered_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          channels?: string[]
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          category: string | null
          created_at: string
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          outbox_id: string | null
          priority: number | null
          read: boolean | null
          read_at: string | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          outbox_id?: string | null
          priority?: number | null
          read?: boolean | null
          read_at?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          outbox_id?: string | null
          priority?: number | null
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_contacts: {
        Row: {
          contact_preference: string | null
          contact_status: string | null
          created_at: string | null
          email: string | null
          id: string
          is_absentee: boolean | null
          last_contact_date: string | null
          mailing_address: string | null
          mailing_city: string | null
          mailing_state: string | null
          mailing_zip: string | null
          notes: string | null
          owner_name: string
          phone: string | null
          property_id: string | null
          updated_at: string | null
        }
        Insert: {
          contact_preference?: string | null
          contact_status?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_absentee?: boolean | null
          last_contact_date?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          notes?: string | null
          owner_name: string
          phone?: string | null
          property_id?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_preference?: string | null
          contact_status?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_absentee?: boolean | null
          last_contact_date?: string | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          notes?: string | null
          owner_name?: string
          phone?: string | null
          property_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      plaid_connections: {
        Row: {
          accounts: Json
          created_at: string
          id: string
          institution_id: string | null
          institution_name: string | null
          item_id: string
          last_synced_at: string | null
          sync_cursor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accounts?: Json
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id: string
          last_synced_at?: string | null
          sync_cursor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accounts?: Json
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id?: string
          last_synced_at?: string | null
          sync_cursor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plaid_secrets: {
        Row: {
          access_token: string
          created_at: string
          item_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          item_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          item_id?: string
        }
        Relationships: []
      }
      plaid_transactions: {
        Row: {
          account_id: string
          amount: number
          category_key: string | null
          created_at: string
          date: string
          id: string
          item_id: string
          merchant_name: string | null
          name: string
          pending: boolean
          plaid_category: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_key?: string | null
          created_at?: string
          date: string
          id?: string
          item_id: string
          merchant_name?: string | null
          name: string
          pending?: boolean
          plaid_category?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_key?: string | null
          created_at?: string
          date?: string
          id?: string
          item_id?: string
          merchant_name?: string | null
          name?: string
          pending?: boolean
          plaid_category?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      plays: {
        Row: {
          closed_at: string | null
          created_at: string | null
          entries: string | null
          expiry: string
          id: number
          main_msg_id: number | null
          message_id: string | null
          opened_at: string
          option_type: string
          pnl: string | null
          result: string | null
          source_message_id: number | null
          status: string
          strike: number
          thread_id: number | null
          ticker: string
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          entries?: string | null
          expiry: string
          id?: number
          main_msg_id?: number | null
          message_id?: string | null
          opened_at?: string
          option_type: string
          pnl?: string | null
          result?: string | null
          source_message_id?: number | null
          status?: string
          strike: number
          thread_id?: number | null
          ticker: string
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          entries?: string | null
          expiry?: string
          id?: number
          main_msg_id?: number | null
          message_id?: string | null
          opened_at?: string
          option_type?: string
          pnl?: string | null
          result?: string | null
          source_message_id?: number | null
          status?: string
          strike?: number
          thread_id?: number | null
          ticker?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      portfolio_allocations: {
        Row: {
          bucket: string
          created_at: string
          id: string
          max_pct: number
          min_pct: number
          portfolio_id: string
          target_pct: number
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          max_pct?: number
          min_pct?: number
          portfolio_id: string
          target_pct: number
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          max_pct?: number
          min_pct?: number
          portfolio_id?: string
          target_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_allocations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_holdings: {
        Row: {
          added_at: string
          bucket: string
          company_name: string | null
          cost_basis: number | null
          current_pct: number | null
          current_price: number | null
          id: string
          market_value: number | null
          notes: string | null
          portfolio_id: string
          shares: number | null
          source: string
          target_pct: number | null
          ticker: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          bucket: string
          company_name?: string | null
          cost_basis?: number | null
          current_pct?: number | null
          current_price?: number | null
          id?: string
          market_value?: number | null
          notes?: string | null
          portfolio_id: string
          shares?: number | null
          source?: string
          target_pct?: number | null
          ticker: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          bucket?: string
          company_name?: string | null
          cost_basis?: number | null
          current_pct?: number | null
          current_price?: number | null
          id?: string
          market_value?: number | null
          notes?: string | null
          portfolio_id?: string
          shares?: number | null
          source?: string
          target_pct?: number | null
          ticker?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          exclude_sectors: string[] | null
          goal: string
          horizon_years: number
          id: string
          initial_capital: number | null
          investment_goal_id: string | null
          is_default: boolean
          max_positions: number
          max_sector_concentration_pct: number
          max_single_position_pct: number
          min_conviction_score: number
          min_positions: number
          monthly_contribution: number | null
          name: string
          rebalance_threshold_pct: number
          risk_capacity: number
          risk_tolerance: number
          target_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exclude_sectors?: string[] | null
          goal: string
          horizon_years: number
          id?: string
          initial_capital?: number | null
          investment_goal_id?: string | null
          is_default?: boolean
          max_positions?: number
          max_sector_concentration_pct?: number
          max_single_position_pct?: number
          min_conviction_score?: number
          min_positions?: number
          monthly_contribution?: number | null
          name: string
          rebalance_threshold_pct?: number
          risk_capacity: number
          risk_tolerance: number
          target_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exclude_sectors?: string[] | null
          goal?: string
          horizon_years?: number
          id?: string
          initial_capital?: number | null
          investment_goal_id?: string | null
          is_default?: boolean
          max_positions?: number
          max_sector_concentration_pct?: number
          max_single_position_pct?: number
          min_conviction_score?: number
          min_positions?: number
          monthly_contribution?: number | null
          name?: string
          rebalance_threshold_pct?: number
          risk_capacity?: number
          risk_tolerance?: number
          target_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_investment_goal_id_fkey"
            columns: ["investment_goal_id"]
            isOneToOne: false
            referencedRelation: "investment_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "journey_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_journey_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_journey_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          post_id: string
          reason: string
          reporter_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          post_id: string
          reason: string
          reporter_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          post_id?: string
          reason?: string
          reporter_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "journey_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_journey_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_journey_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_models: {
        Row: {
          accuracy: number
          created_at: string | null
          features: string[]
          id: string
          last_trained: string | null
          model_id: string
          model_metadata: Json | null
          model_type: string
          updated_at: string | null
        }
        Insert: {
          accuracy?: number
          created_at?: string | null
          features?: string[]
          id?: string
          last_trained?: string | null
          model_id: string
          model_metadata?: Json | null
          model_type: string
          updated_at?: string | null
        }
        Update: {
          accuracy?: number
          created_at?: string | null
          features?: string[]
          id?: string
          last_trained?: string | null
          model_id?: string
          model_metadata?: Json | null
          model_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          backup_codes: string[] | null
          bio: string | null
          created_at: string
          email: string | null
          email_notifications_enabled: boolean | null
          email_verification_sent_at: string | null
          email_verification_token: string | null
          email_verified: boolean | null
          first_login_at: string | null
          id: string
          last_login_at: string | null
          location: string | null
          login_count: number | null
          marketing_emails_enabled: boolean | null
          onboarding_completed: boolean | null
          onboarding_progress: Json | null
          onboarding_step: number | null
          price_alerts_enabled: boolean | null
          profile_completion_score: number | null
          push_notifications_enabled: boolean | null
          theme_preference: string | null
          tutorial_completed: boolean | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
          username: string | null
          website: string | null
          weekly_summary_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          backup_codes?: string[] | null
          bio?: string | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean | null
          email_verification_sent_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          first_login_at?: string | null
          id: string
          last_login_at?: string | null
          location?: string | null
          login_count?: number | null
          marketing_emails_enabled?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          onboarding_step?: number | null
          price_alerts_enabled?: boolean | null
          profile_completion_score?: number | null
          push_notifications_enabled?: boolean | null
          theme_preference?: string | null
          tutorial_completed?: boolean | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string
          username?: string | null
          website?: string | null
          weekly_summary_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          backup_codes?: string[] | null
          bio?: string | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean | null
          email_verification_sent_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          first_login_at?: string | null
          id?: string
          last_login_at?: string | null
          location?: string | null
          login_count?: number | null
          marketing_emails_enabled?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          onboarding_step?: number | null
          price_alerts_enabled?: boolean | null
          profile_completion_score?: number | null
          push_notifications_enabled?: boolean | null
          theme_preference?: string | null
          tutorial_completed?: boolean | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string
          username?: string | null
          website?: string | null
          weekly_summary_enabled?: boolean | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          annual_taxes: number | null
          appliances: string[] | null
          arv_estimate: number | null
          assessed_value: number | null
          bathrooms: number | null
          bedrooms: number | null
          bike_score: number | null
          cap_rate: number | null
          cash_on_cash_return: number | null
          central_air: boolean | null
          city: string | null
          closing_cost_estimate: number | null
          cooling_type: string | null
          crime_rate: number | null
          current_listing_price: number | null
          data_confidence: number | null
          data_source: string | null
          days_on_market: number | null
          down_payment_estimate: number | null
          equity_percent: number | null
          estimated_value: number | null
          exterior_material: string | null
          features: string[] | null
          fireplace: boolean | null
          flood_zone: string | null
          foundation_condition: string | null
          foundation_type: string | null
          garage_spaces: number | null
          gross_rent_multiplier: number | null
          heating_type: string | null
          hoa_fee: number | null
          hoa_frequency: string | null
          hvac_condition: string | null
          id: string
          insurance_cost: number | null
          investment_score: number | null
          last_data_update: string | null
          last_sale_date: string | null
          last_sale_price: number | null
          last_updated: string | null
          latitude: number | null
          lien_status: string | null
          listing_agent: string | null
          listing_date: string | null
          listing_office: string | null
          listing_status: string | null
          longitude: number | null
          lot_features: string[] | null
          lot_shape: string | null
          lot_size: number | null
          market_value: number | null
          mls_id: string | null
          mls_source: string | null
          monthly_payment_estimate: number | null
          mortgage_status: string | null
          original_listing_price: number | null
          owner_name: string | null
          owner_type: string | null
          parking_type: string | null
          pool: boolean | null
          price_per_sqft: number | null
          price_reductions: number | null
          property_condition: string | null
          property_description: string | null
          property_type: string | null
          rehab_cost_estimate: number | null
          rental_estimate: number | null
          roof_condition: string | null
          roof_type: string | null
          school_district: string | null
          showing_instructions: string | null
          square_feet: number | null
          state: string | null
          status: string | null
          tags: string[] | null
          tax_year: number | null
          total_price_reduction: number | null
          transit_score: number | null
          utilities_cost: number | null
          virtual_tour_url: string | null
          walk_score: number | null
          year_built: number | null
          zip: string | null
          zoning: string | null
        }
        Insert: {
          address?: string | null
          annual_taxes?: number | null
          appliances?: string[] | null
          arv_estimate?: number | null
          assessed_value?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bike_score?: number | null
          cap_rate?: number | null
          cash_on_cash_return?: number | null
          central_air?: boolean | null
          city?: string | null
          closing_cost_estimate?: number | null
          cooling_type?: string | null
          crime_rate?: number | null
          current_listing_price?: number | null
          data_confidence?: number | null
          data_source?: string | null
          days_on_market?: number | null
          down_payment_estimate?: number | null
          equity_percent?: number | null
          estimated_value?: number | null
          exterior_material?: string | null
          features?: string[] | null
          fireplace?: boolean | null
          flood_zone?: string | null
          foundation_condition?: string | null
          foundation_type?: string | null
          garage_spaces?: number | null
          gross_rent_multiplier?: number | null
          heating_type?: string | null
          hoa_fee?: number | null
          hoa_frequency?: string | null
          hvac_condition?: string | null
          id?: string
          insurance_cost?: number | null
          investment_score?: number | null
          last_data_update?: string | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          last_updated?: string | null
          latitude?: number | null
          lien_status?: string | null
          listing_agent?: string | null
          listing_date?: string | null
          listing_office?: string | null
          listing_status?: string | null
          longitude?: number | null
          lot_features?: string[] | null
          lot_shape?: string | null
          lot_size?: number | null
          market_value?: number | null
          mls_id?: string | null
          mls_source?: string | null
          monthly_payment_estimate?: number | null
          mortgage_status?: string | null
          original_listing_price?: number | null
          owner_name?: string | null
          owner_type?: string | null
          parking_type?: string | null
          pool?: boolean | null
          price_per_sqft?: number | null
          price_reductions?: number | null
          property_condition?: string | null
          property_description?: string | null
          property_type?: string | null
          rehab_cost_estimate?: number | null
          rental_estimate?: number | null
          roof_condition?: string | null
          roof_type?: string | null
          school_district?: string | null
          showing_instructions?: string | null
          square_feet?: number | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          tax_year?: number | null
          total_price_reduction?: number | null
          transit_score?: number | null
          utilities_cost?: number | null
          virtual_tour_url?: string | null
          walk_score?: number | null
          year_built?: number | null
          zip?: string | null
          zoning?: string | null
        }
        Update: {
          address?: string | null
          annual_taxes?: number | null
          appliances?: string[] | null
          arv_estimate?: number | null
          assessed_value?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bike_score?: number | null
          cap_rate?: number | null
          cash_on_cash_return?: number | null
          central_air?: boolean | null
          city?: string | null
          closing_cost_estimate?: number | null
          cooling_type?: string | null
          crime_rate?: number | null
          current_listing_price?: number | null
          data_confidence?: number | null
          data_source?: string | null
          days_on_market?: number | null
          down_payment_estimate?: number | null
          equity_percent?: number | null
          estimated_value?: number | null
          exterior_material?: string | null
          features?: string[] | null
          fireplace?: boolean | null
          flood_zone?: string | null
          foundation_condition?: string | null
          foundation_type?: string | null
          garage_spaces?: number | null
          gross_rent_multiplier?: number | null
          heating_type?: string | null
          hoa_fee?: number | null
          hoa_frequency?: string | null
          hvac_condition?: string | null
          id?: string
          insurance_cost?: number | null
          investment_score?: number | null
          last_data_update?: string | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          last_updated?: string | null
          latitude?: number | null
          lien_status?: string | null
          listing_agent?: string | null
          listing_date?: string | null
          listing_office?: string | null
          listing_status?: string | null
          longitude?: number | null
          lot_features?: string[] | null
          lot_shape?: string | null
          lot_size?: number | null
          market_value?: number | null
          mls_id?: string | null
          mls_source?: string | null
          monthly_payment_estimate?: number | null
          mortgage_status?: string | null
          original_listing_price?: number | null
          owner_name?: string | null
          owner_type?: string | null
          parking_type?: string | null
          pool?: boolean | null
          price_per_sqft?: number | null
          price_reductions?: number | null
          property_condition?: string | null
          property_description?: string | null
          property_type?: string | null
          rehab_cost_estimate?: number | null
          rental_estimate?: number | null
          roof_condition?: string | null
          roof_type?: string | null
          school_district?: string | null
          showing_instructions?: string | null
          square_feet?: number | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          tax_year?: number | null
          total_price_reduction?: number | null
          transit_score?: number | null
          utilities_cost?: number | null
          virtual_tour_url?: string | null
          walk_score?: number | null
          year_built?: number | null
          zip?: string | null
          zoning?: string | null
        }
        Relationships: []
      }
      property_history: {
        Row: {
          created_at: string | null
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          new_value: string | null
          old_value: string | null
          property_id: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          property_id?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          property_id?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          photo_type: string | null
          photo_url: string
          property_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          photo_type?: string | null
          photo_url: string
          property_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          photo_type?: string | null
          photo_url?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          handle: string
          is_public: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          handle: string
          is_public?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          is_public?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      real_estate_fetch_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          data_source: string
          error_message: string | null
          id: string
          records_fetched: number | null
          records_inserted: number | null
          records_updated: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_source: string
          error_message?: string | null
          id?: string
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_source?: string
          error_message?: string | null
          id?: string
          records_fetched?: number | null
          records_inserted?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      real_estate_leads: {
        Row: {
          city: string | null
          county: string | null
          created_at: string
          data_source: string
          equity_estimate: number | null
          fetched_at: string
          id: string
          incident_date: string | null
          is_absentee: boolean | null
          is_distressed: boolean | null
          is_llc_owned: boolean | null
          last_sale_date: string | null
          latitude: number | null
          lead_type: string
          longitude: number | null
          mailing_address: string | null
          normalized_address: string | null
          owner_name: string | null
          property_address: string | null
          property_value: number | null
          severity: string | null
          source_record_id: string | null
          source_url: string | null
          state: string | null
          status: string | null
          tags: string[] | null
          tax_amount: number | null
          updated_at: string
          violation_description: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          county?: string | null
          created_at?: string
          data_source: string
          equity_estimate?: number | null
          fetched_at?: string
          id?: string
          incident_date?: string | null
          is_absentee?: boolean | null
          is_distressed?: boolean | null
          is_llc_owned?: boolean | null
          last_sale_date?: string | null
          latitude?: number | null
          lead_type: string
          longitude?: number | null
          mailing_address?: string | null
          normalized_address?: string | null
          owner_name?: string | null
          property_address?: string | null
          property_value?: number | null
          severity?: string | null
          source_record_id?: string | null
          source_url?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          tax_amount?: number | null
          updated_at?: string
          violation_description?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          county?: string | null
          created_at?: string
          data_source?: string
          equity_estimate?: number | null
          fetched_at?: string
          id?: string
          incident_date?: string | null
          is_absentee?: boolean | null
          is_distressed?: boolean | null
          is_llc_owned?: boolean | null
          last_sale_date?: string | null
          latitude?: number | null
          lead_type?: string
          longitude?: number | null
          mailing_address?: string | null
          normalized_address?: string | null
          owner_name?: string | null
          property_address?: string | null
          property_value?: number | null
          severity?: string | null
          source_record_id?: string | null
          source_url?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          tax_amount?: number | null
          updated_at?: string
          violation_description?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      research_follows: {
        Row: {
          created_at: string
          follower_id: string
          ticker: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          ticker: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          ticker?: string
        }
        Relationships: []
      }
      research_post_reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_research_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "research_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_post_reports: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          post_id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          post_id: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          post_id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_research_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "research_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_post_revisions: {
        Row: {
          author_id: string
          content: Json
          created_at: string
          id: string
          post_id: string
          revision_number: number
        }
        Insert: {
          author_id: string
          content: Json
          created_at?: string
          id?: string
          post_id: string
          revision_number: number
        }
        Update: {
          author_id?: string
          content?: Json
          created_at?: string
          id?: string
          post_id?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_post_revisions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_research_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_post_revisions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "research_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_posts: {
        Row: {
          allow_comments: boolean
          author_id: string
          author_mode: string
          company_name: string
          created_at: string
          disclosure: string
          id: string
          opportunities: string | null
          published_at: string | null
          risks: string
          search_document: unknown
          slug: string
          snapshot: Json
          sources: Json
          status: string
          summary: string
          thesis: string
          ticker: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_comments?: boolean
          author_id: string
          author_mode?: string
          company_name: string
          created_at?: string
          disclosure: string
          id?: string
          opportunities?: string | null
          published_at?: string | null
          risks: string
          search_document?: unknown
          slug: string
          snapshot?: Json
          sources?: Json
          status?: string
          summary: string
          thesis: string
          ticker: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_comments?: boolean
          author_id?: string
          author_mode?: string
          company_name?: string
          created_at?: string
          disclosure?: string
          id?: string
          opportunities?: string | null
          published_at?: string | null
          risks?: string
          search_document?: unknown
          slug?: string
          snapshot?: Json
          sources?: Json
          status?: string
          summary?: string
          thesis?: string
          ticker?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      research_results: {
        Row: {
          bucket: string | null
          composite_score: number | null
          generated_at: string
          goal_alignment_pct: number | null
          id: string
          passes_filters: boolean | null
          portfolio_id: string
          rank_in_bucket: number | null
          raw_result: Json | null
          ticker: string
        }
        Insert: {
          bucket?: string | null
          composite_score?: number | null
          generated_at?: string
          goal_alignment_pct?: number | null
          id?: string
          passes_filters?: boolean | null
          portfolio_id: string
          rank_in_bucket?: number | null
          raw_result?: Json | null
          ticker: string
        }
        Update: {
          bucket?: string | null
          composite_score?: number | null
          generated_at?: string
          goal_alignment_pct?: number | null
          id?: string
          passes_filters?: boolean | null
          portfolio_id?: string
          rank_in_bucket?: number | null
          raw_result?: Json | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_results_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      research_scores: {
        Row: {
          accruals_ratio: number | null
          cik: string | null
          company_name: string | null
          computed_at: string
          data_as_of: string | null
          dcf_upside_pct: number | null
          earnings_yield: number | null
          eq_composite: number | null
          ev_ebit: number | null
          fcf_yield: number | null
          flags: string[] | null
          growth_composite: number | null
          id: string
          industry: string | null
          moat_composite: number | null
          ocf_to_ni: number | null
          piotroski_score: number | null
          quality_composite: number | null
          raw_financials: Json | null
          return_on_capital: number | null
          revenue_cagr_3yr: number | null
          revenue_cagr_5yr: number | null
          roiic: number | null
          sector: string | null
          ticker: string
          value_composite: number | null
        }
        Insert: {
          accruals_ratio?: number | null
          cik?: string | null
          company_name?: string | null
          computed_at?: string
          data_as_of?: string | null
          dcf_upside_pct?: number | null
          earnings_yield?: number | null
          eq_composite?: number | null
          ev_ebit?: number | null
          fcf_yield?: number | null
          flags?: string[] | null
          growth_composite?: number | null
          id?: string
          industry?: string | null
          moat_composite?: number | null
          ocf_to_ni?: number | null
          piotroski_score?: number | null
          quality_composite?: number | null
          raw_financials?: Json | null
          return_on_capital?: number | null
          revenue_cagr_3yr?: number | null
          revenue_cagr_5yr?: number | null
          roiic?: number | null
          sector?: string | null
          ticker: string
          value_composite?: number | null
        }
        Update: {
          accruals_ratio?: number | null
          cik?: string | null
          company_name?: string | null
          computed_at?: string
          data_as_of?: string | null
          dcf_upside_pct?: number | null
          earnings_yield?: number | null
          eq_composite?: number | null
          ev_ebit?: number | null
          fcf_yield?: number | null
          flags?: string[] | null
          growth_composite?: number | null
          id?: string
          industry?: string | null
          moat_composite?: number | null
          ocf_to_ni?: number | null
          piotroski_score?: number | null
          quality_composite?: number | null
          raw_financials?: Json | null
          return_on_capital?: number | null
          revenue_cagr_3yr?: number | null
          revenue_cagr_5yr?: number | null
          roiic?: number | null
          sector?: string | null
          ticker?: string
          value_composite?: number | null
        }
        Relationships: []
      }
      retirement_plans: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          notes: string | null
          plan_name: string
          results: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          notes?: string | null
          plan_name: string
          results: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          notes?: string | null
          plan_name?: string
          results?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_leads: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          property_id: string
          status: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          property_id: string
          status?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          status?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_properties: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          priority: string | null
          property_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          is_active: boolean | null
          last_run: string | null
          result_count: number | null
          search_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters: Json
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          result_count?: number | null
          search_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          is_active?: boolean | null
          last_run?: string | null
          result_count?: number | null
          search_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      scenario_models: {
        Row: {
          color: string
          created_at: string
          expense_change_pct: number
          extra_monthly_savings: number
          id: string
          income_change_pct: number
          is_preset: boolean
          name: string
          one_time_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          expense_change_pct?: number
          extra_monthly_savings?: number
          id?: string
          income_change_pct?: number
          is_preset?: boolean
          name: string
          one_time_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          expense_change_pct?: number
          extra_monthly_savings?: number
          id?: string
          income_change_pct?: number
          is_preset?: boolean
          name?: string
          one_time_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_analysis_cache: {
        Row: {
          cik: string
          company_name: string
          fundamentals: Json
          fundamentals_as_of: string | null
          fundamentals_fetched_at: string
          quote: Json | null
          quote_as_of: string | null
          quote_expires_at: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          cik: string
          company_name: string
          fundamentals: Json
          fundamentals_as_of?: string | null
          fundamentals_fetched_at: string
          quote?: Json | null
          quote_as_of?: string | null
          quote_expires_at?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          cik?: string
          company_name?: string
          fundamentals?: Json
          fundamentals_as_of?: string | null
          fundamentals_fetched_at?: string
          quote?: Json | null
          quote_as_of?: string | null
          quote_expires_at?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_price_history_cache: {
        Row: {
          adjusted: boolean
          as_of: string | null
          expires_at: string
          fetched_at: string
          provider: string
          series: Json
          ticker: string
        }
        Insert: {
          adjusted?: boolean
          as_of?: string | null
          expires_at: string
          fetched_at: string
          provider: string
          series: Json
          ticker: string
        }
        Update: {
          adjusted?: boolean
          as_of?: string | null
          expires_at?: string
          fetched_at?: string
          provider?: string
          series?: Json
          ticker?: string
        }
        Relationships: []
      }
      stripe_checkout_requests: {
        Row: {
          cancel_url: string
          created_at: string | null
          id: number
          status: string
          stripe_price_id: string
          stripe_session_id: string | null
          stripe_session_url: string | null
          success_url: string
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_url: string
          created_at?: string | null
          id?: number
          status?: string
          stripe_price_id: string
          stripe_session_id?: string | null
          stripe_session_url?: string | null
          success_url: string
          tier: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_url?: string
          created_at?: string | null
          id?: number
          status?: string
          stripe_price_id?: string
          stripe_session_id?: string | null
          stripe_session_url?: string | null
          success_url?: string
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          features_enabled: Json | null
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          usage_limits: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          features_enabled?: Json | null
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          usage_limits?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          features_enabled?: Json | null
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          usage_limits?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_price_id: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_price_id: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_price_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      superinvestor_holdings: {
        Row: {
          created_at: string
          id: string
          investor: string
          position_value: number | null
          quarter: string
          sector: string
          shares: number | null
          stock: string
          ticker: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor: string
          position_value?: number | null
          quarter: string
          sector: string
          shares?: number | null
          stock: string
          ticker: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          investor?: string
          position_value?: number | null
          quarter?: string
          sector?: string
          shares?: number | null
          stock?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          dashboard_layout: Json | null
          id: string
          notification_preferences: Json | null
          theme: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          dashboard_layout?: Json | null
          id?: string
          notification_preferences?: Json | null
          theme?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          dashboard_layout?: Json | null
          id?: string
          notification_preferences?: Json | null
          theme?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      thesis_reviews: {
        Row: {
          created_at: string
          id: string
          note: string | null
          snapshot_id: string
          thesis_invalidation_at_review: string | null
          user_id: string
          verdict: string
          watchlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          snapshot_id: string
          thesis_invalidation_at_review?: string | null
          user_id: string
          verdict: string
          watchlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          snapshot_id?: string
          thesis_invalidation_at_review?: string | null
          user_id?: string
          verdict?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thesis_reviews_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: true
            referencedRelation: "watchlist_story_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thesis_reviews_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlist"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_sessions: {
        Row: {
          created_at: string
          id: string
          key_outputs: Json
          summary: string
          tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_outputs?: Json
          summary: string
          tool: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_outputs?: Json
          summary?: string
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          alpaca_order_id: string
          filled_at: string | null
          filled_avg_price: number | null
          id: string
          notional: number | null
          qty: number
          side: string
          strategy: string | null
          synced_at: string
          ticker: string
          user_id: string
        }
        Insert: {
          alpaca_order_id: string
          filled_at?: string | null
          filled_avg_price?: number | null
          id?: string
          notional?: number | null
          qty: number
          side: string
          strategy?: string | null
          synced_at?: string
          ticker: string
          user_id: string
        }
        Update: {
          alpaca_order_id?: string
          filled_at?: string | null
          filled_avg_price?: number | null
          id?: string
          notional?: number | null
          qty?: number
          side?: string
          strategy?: string | null
          synced_at?: string
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          created_at: string
          feature_type: string
          id: string
          month_year: string
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feature_type: string
          id?: string
          month_year?: string
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feature_type?: string
          id?: string
          month_year?: string
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_alpaca_keys: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string
          environment: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string
          environment?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string
          environment?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_preferences: {
        Row: {
          created_at: string
          digest_enabled: boolean
          marketing_enabled: boolean
          reminders_enabled: boolean
          transactional_enabled: boolean
          unsubscribe_token: string
          unsubscribed: boolean
          unsubscribed_at: string | null
          updated_at: string
          updates_enabled: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_enabled?: boolean
          marketing_enabled?: boolean
          reminders_enabled?: boolean
          transactional_enabled?: boolean
          unsubscribe_token?: string
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          updates_enabled?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          digest_enabled?: boolean
          marketing_enabled?: boolean
          reminders_enabled?: boolean
          transactional_enabled?: boolean
          unsubscribe_token?: string
          unsubscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          updates_enabled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          admin_response: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          priority: number | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
          votes_count: number | null
        }
        Insert: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          priority?: number | null
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
          votes_count?: number | null
        }
        Update: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          priority?: number | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          votes_count?: number | null
        }
        Relationships: []
      }
      user_milestones: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          milestone_id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          milestone_id: string
          notes?: string | null
          status: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          milestone_id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          discord_id: string | null
          discord_username: string | null
          email: string
          id: string
          name: string | null
          role: string
          stripe_customer_id: string | null
          subscription_ends_at: string | null
          subscription_status: string | null
          subscription_tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discord_id?: string | null
          discord_username?: string | null
          email: string
          id: string
          name?: string | null
          role?: string
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discord_id?: string | null
          discord_username?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_research_preferences: {
        Row: {
          created_at: string
          default_tickers: string[]
          id: string
          preferred_goal: string | null
          preferred_horizon: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_tickers?: string[]
          id?: string
          preferred_goal?: string | null
          preferred_horizon?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_tickers?: string[]
          id?: string
          preferred_goal?: string | null
          preferred_horizon?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          company_name: string | null
          current_price: number | null
          dcf_intrinsic_value: number | null
          dcf_scenario: string
          dcf_upside_percentage: number | null
          id: string
          market_cap: number | null
          notes: string | null
          pe_ratio: number | null
          recommendation: string | null
          score: number | null
          story_last_viewed_at: string | null
          story_summary: string | null
          story_updated_at: string | null
          thesis_invalidation: string | null
          thesis_summary: string | null
          ticker: string
          tracking_mode: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          added_at?: string
          company_name?: string | null
          current_price?: number | null
          dcf_intrinsic_value?: number | null
          dcf_scenario: string
          dcf_upside_percentage?: number | null
          id?: string
          market_cap?: number | null
          notes?: string | null
          pe_ratio?: number | null
          recommendation?: string | null
          score?: number | null
          story_last_viewed_at?: string | null
          story_summary?: string | null
          story_updated_at?: string | null
          thesis_invalidation?: string | null
          thesis_summary?: string | null
          ticker: string
          tracking_mode?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          added_at?: string
          company_name?: string | null
          current_price?: number | null
          dcf_intrinsic_value?: number | null
          dcf_scenario?: string
          dcf_upside_percentage?: number | null
          id?: string
          market_cap?: number | null
          notes?: string | null
          pe_ratio?: number | null
          recommendation?: string | null
          score?: number | null
          story_last_viewed_at?: string | null
          story_summary?: string | null
          story_updated_at?: string | null
          thesis_invalidation?: string | null
          thesis_summary?: string | null
          ticker?: string
          tracking_mode?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      watchlist_story_poll_state: {
        Row: {
          consecutive_failures: number
          last_accession: string | null
          last_checked_at: string
          last_error: string | null
          last_filing_date: string | null
          ticker: string
        }
        Insert: {
          consecutive_failures?: number
          last_accession?: string | null
          last_checked_at?: string
          last_error?: string | null
          last_filing_date?: string | null
          ticker: string
        }
        Update: {
          consecutive_failures?: number
          last_accession?: string | null
          last_checked_at?: string
          last_error?: string | null
          last_filing_date?: string | null
          ticker?: string
        }
        Relationships: []
      }
      watchlist_story_snapshots: {
        Row: {
          analysis_version: string
          created_at: string
          id: string
          payload: Json
          reporting_period: string | null
          source_as_of: string
          summary: string
          ticker: string
          user_id: string
          watchlist_id: string
        }
        Insert: {
          analysis_version: string
          created_at?: string
          id?: string
          payload: Json
          reporting_period?: string | null
          source_as_of: string
          summary: string
          ticker: string
          user_id: string
          watchlist_id: string
        }
        Update: {
          analysis_version?: string
          created_at?: string
          id?: string
          payload?: Json
          reporting_period?: string | null
          source_as_of?: string
          summary?: string
          ticker?: string
          user_id?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_story_snapshots_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlist"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_journey_posts: {
        Row: {
          created_at: string | null
          headline: string | null
          id: string | null
          identity_mode: string | null
          journey_id: string | null
          post_type: string | null
          reaction_clap: number | null
          reaction_fire: number | null
          reaction_muscle: number | null
          reaction_rocket: number | null
          show_exact_amounts: boolean | null
          show_percentages: boolean | null
          show_timeline: boolean | null
          stage_label: string | null
          status: string | null
          subheadline: string | null
          template_key: string | null
          timeline_label: string | null
          updated_at: string | null
          user_id: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          headline?: string | null
          id?: string | null
          identity_mode?: string | null
          journey_id?: string | null
          post_type?: string | null
          reaction_clap?: number | null
          reaction_fire?: number | null
          reaction_muscle?: number | null
          reaction_rocket?: number | null
          show_exact_amounts?: boolean | null
          show_percentages?: boolean | null
          show_timeline?: boolean | null
          stage_label?: string | null
          status?: string | null
          subheadline?: string | null
          template_key?: string | null
          timeline_label?: string | null
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          headline?: string | null
          id?: string | null
          identity_mode?: string | null
          journey_id?: string | null
          post_type?: string | null
          reaction_clap?: number | null
          reaction_fire?: number | null
          reaction_muscle?: number | null
          reaction_rocket?: number | null
          show_exact_amounts?: boolean | null
          show_percentages?: boolean | null
          show_timeline?: boolean | null
          stage_label?: string | null
          status?: string | null
          subheadline?: string | null
          template_key?: string | null
          timeline_label?: string | null
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      my_post_reactions: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string | null
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string | null
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string | null
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "journey_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_journey_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_journey_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      options_plays_dashboard: {
        Row: {
          closed_at: string | null
          entries: string | null
          expiry: string | null
          opened_at: string | null
          option_type: string | null
          pnl: string | null
          result: string | null
          status: string | null
          strike: number | null
          ticker: string | null
        }
        Insert: {
          closed_at?: string | null
          entries?: string | null
          expiry?: string | null
          opened_at?: string | null
          option_type?: string | null
          pnl?: string | null
          result?: never
          status?: string | null
          strike?: number | null
          ticker?: string | null
        }
        Update: {
          closed_at?: string | null
          entries?: string | null
          expiry?: string | null
          opened_at?: string | null
          option_type?: string | null
          pnl?: string | null
          result?: never
          status?: string | null
          strike?: number | null
          ticker?: string | null
        }
        Relationships: []
      }
      public_journey_posts: {
        Row: {
          author_display_name: string | null
          created_at: string | null
          headline: string | null
          id: string | null
          identity_mode: string | null
          journey_id: string | null
          post_type: string | null
          reaction_clap: number | null
          reaction_fire: number | null
          reaction_muscle: number | null
          reaction_rocket: number | null
          show_exact_amounts: boolean | null
          show_percentages: boolean | null
          show_timeline: boolean | null
          stage_label: string | null
          status: string | null
          subheadline: string | null
          template_key: string | null
          timeline_label: string | null
          updated_at: string | null
          visibility: string | null
        }
        Relationships: []
      }
      public_research_posts: {
        Row: {
          allow_comments: boolean | null
          author_display_name: string | null
          author_handle: string | null
          author_mode: string | null
          company_name: string | null
          disclosure: string | null
          id: string | null
          opportunities: string | null
          published_at: string | null
          risks: string | null
          slug: string | null
          snapshot: Json | null
          sources: Json | null
          summary: string | null
          thesis: string | null
          ticker: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_journey_plan: {
        Args: {
          p_analysis: Json
          p_expected_revision: number
          p_monthly_commitment: number
          p_plan_id: string
          p_target_date: string
        }
        Returns: {
          activated_analysis: Json | null
          activated_at: string | null
          activated_revision: number | null
          answers: Json
          assumptions: Json
          created_at: string
          currency_code: string
          id: string
          input_metadata: Json
          is_baseline: boolean
          journey_id: string
          locale: string
          monthly_commitment: number
          name: string
          parent_plan_id: string | null
          revision: number
          schema_version: number
          status: string
          target_date: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journey_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_sync_discord_users: { Args: never; Returns: Json }
      calculate_investment_analytics: {
        Args: { property_id: string }
        Returns: {
          cap_rate: number
          cash_on_cash_return: number
          investment_score: number
          total_return: number
        }[]
      }
      calculate_market_analytics: {
        Args: { area_name?: string }
        Returns: {
          average_days_on_market: number
          average_price: number
          average_price_per_sqft: number
          investment_opportunities: number
          market_activity: string
          price_trend: string
          total_properties: number
        }[]
      }
      calculate_notification_retry_time: {
        Args: { attempt: number }
        Returns: string
      }
      calculate_profile_completion:
        | {
            Args: {
              profile_record: Database["public"]["Tables"]["profiles"]["Row"]
            }
            Returns: number
          }
        | { Args: { user_id: string }; Returns: number }
      claim_notification_outbox: {
        Args: { batch_size?: number }
        Returns: {
          attempt_count: number
          channels: string[]
          claimed_at: string | null
          created_at: string
          dedupe_key: string | null
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clean_expired_cache: { Args: never; Returns: number }
      cleanup_expired_cache_keys: { Args: never; Returns: number }
      consume_email_rate_slot: {
        Args: {
          p_global_per_minute?: number
          p_per_recipient_per_minute?: number
          p_recipient: string
        }
        Returns: boolean
      }
      create_notification:
        | {
            Args: {
              p_action_label?: string
              p_action_url?: string
              p_category?: string
              p_message: string
              p_metadata?: Json
              p_priority?: number
              p_title: string
              p_type?: string
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: { message: string; title: string; user_id: string }
            Returns: string
          }
      create_stripe_checkout_session: {
        Args: { cancel_url: string; success_url: string; tier: string }
        Returns: Json
      }
      create_stripe_portal_session: {
        Args: { return_url: string }
        Returns: Json
      }
      dispatch_notifications_tick: { Args: never; Returns: undefined }
      enqueue_story_alerts: { Args: { p_alerts: Json }; Returns: number }
      ensure_email_preferences: {
        Args: { target_user: string }
        Returns: {
          created_at: string
          digest_enabled: boolean
          marketing_enabled: boolean
          reminders_enabled: boolean
          transactional_enabled: boolean
          unsubscribe_token: string
          unsubscribed: boolean
          unsubscribed_at: string | null
          updated_at: string
          updates_enabled: boolean
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_email_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_nearest_properties:
        | {
            Args: {
              center_lat: number
              center_lng: number
              limit_count?: number
            }
            Returns: {
              address: string
              city: string
              distance_miles: number
              id: string
              latitude: number
              longitude: number
              state: string
              zip: string
            }[]
          }
        | {
            Args: { lat: number; lng: number; radius: number }
            Returns: {
              address: string
              distance_miles: number
              id: string
            }[]
          }
      get_cache_hit_rate_trends:
        | {
            Args: { days?: number }
            Returns: {
              cache_type: string
              hit_rate: number
              total_requests: number
            }[]
          }
        | {
            Args: { p_cache_type?: string; p_hours_back?: number }
            Returns: {
              cache_hits: number
              cache_type: string
              hit_rate: number
              hour_bucket: string
              total_requests: number
            }[]
          }
      get_cache_performance_summary:
        | {
            Args: { days?: number }
            Returns: {
              avg_response_time: number
              cache_type: string
              total_requests: number
            }[]
          }
        | {
            Args: { p_cache_type?: string; p_hours_back?: number }
            Returns: {
              average_response_time_ms: number
              cache_type: string
              error_rate: number
              hit_rate: number
              total_operations: number
            }[]
          }
      get_checkout_session_status: {
        Args: { request_id: number }
        Returns: Json
      }
      get_current_user_id: { Args: never; Returns: string }
      get_discord_role_mappings: { Args: never; Returns: Json }
      get_latest_checkout_request: { Args: never; Returns: Json }
      get_market_analysis_by_radius: {
        Args: { center_lat: number; center_lng: number; radius_miles: number }
        Returns: {
          avg_equity_percent: number
          avg_investment_score: number
          avg_price: number
          avg_price_per_sqft: number
          price_ranges: Json
          property_types: Json
          total_properties: number
        }[]
      }
      get_options_stats: { Args: never; Returns: Json }
      get_subscription_analytics: {
        Args: never
        Returns: {
          active_subscriptions: number
          free_users: number
          monthly_revenue: number
          tier1_users: number
          tier2_users: number
          tier3_users: number
          total_users: number
        }[]
      }
      get_user_subscription_features: {
        Args: { target_user_id?: string }
        Returns: {
          advanced_analytics: boolean
          ai_tools: boolean
          backtesting_tool: boolean
          course_access: boolean
          discord_chat: boolean
          earnings_calendar: boolean
          live_sessions: boolean
          options_trading_discord: boolean
          retirement_calculator: boolean
          stock_analysis: boolean
          watchlist: boolean
        }[]
      }
      get_user_subscription_history: {
        Args: { target_user_id?: string }
        Returns: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          status: string
          stripe_subscription_id: string
          subscription_id: string
        }[]
      }
      get_user_subscription_status: {
        Args: { target_user_id?: string }
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          discord_user_id: string
          is_active: boolean
          stripe_customer_id: string
          subscription_status: string
          subscription_tier: string
          user_id: string
        }[]
      }
      get_users_needing_discord_sync: { Args: never; Returns: Json }
      handle_stripe_webhook: {
        Args: { event_data: Json; event_type: string }
        Returns: Json
      }
      log_cache_invalidation:
        | { Args: { cache_type: string; reason: string }; Returns: undefined }
        | {
            Args: {
              p_cache_type: string
              p_invalidation_reason?: string
              p_invalidation_type: string
              p_keys_affected?: number
            }
            Returns: undefined
          }
      log_cache_performance:
        | {
            Args: { cache_type: string; response_time_ms: number }
            Returns: undefined
          }
        | {
            Args: {
              p_cache_hit?: boolean
              p_cache_type: string
              p_error_message?: string
              p_operation_type: string
              p_response_time_ms: number
            }
            Returns: undefined
          }
      poll_watchlist_stories_tick: { Args: never; Returns: undefined }
      prune_email_send_log: { Args: never; Returns: undefined }
      queue_due_calendar_reminders: { Args: never; Returns: number }
      search_properties_by_radius: {
        Args: { center_lat: number; center_lng: number; radius_miles: number }
        Returns: {
          address: string
          city: string
          distance_miles: number
          id: string
          latitude: number
          longitude: number
          state: string
          zip: string
        }[]
      }
      search_properties_fulltext:
        | {
            Args: { limit_count?: number; search_query: string }
            Returns: {
              address: string
              city: string
              estimated_value: number
              id: string
              investment_score: number
              owner_name: string
              rank: number
              state: string
              zip: string
            }[]
          }
        | {
            Args: { search_term: string }
            Returns: {
              address: string
              city: string
              id: string
              property_type: string
              state: string
              zip: string
            }[]
          }
      search_properties_in_polygon:
        | {
            Args: { polygon_coords: string }
            Returns: {
              address: string
              city: string
              id: string
              latitude: number
              longitude: number
              state: string
              zip: string
            }[]
          }
        | {
            Args: { polygon_geom: unknown }
            Returns: {
              address: string
              city: string
              id: string
              state: string
            }[]
          }
      set_journey_plan_action_status: {
        Args: { p_action_id: string; p_status: string }
        Returns: {
          action_key: string
          action_type: string
          amount: number | null
          cadence: string | null
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json
          plan_id: string
          source_revision: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "journey_plan_actions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_discord_roles: { Args: { target_user_id: string }; Returns: Json }
      track_login_activity:
        | {
            Args: {
              p_failure_reason?: string
              p_ip_address?: string
              p_success?: boolean
              p_user_agent?: string
              p_user_id: string
            }
            Returns: string
          }
        | { Args: { ip_address: unknown; user_id: string }; Returns: undefined }
      update_cache_statistics:
        | { Args: never; Returns: undefined }
        | {
            Args: {
              p_average_response_time_ms: number
              p_cache_hits: number
              p_cache_misses: number
              p_cache_type: string
              p_total_cache_size_bytes: number
              p_total_items: number
              p_total_requests: number
            }
            Returns: undefined
          }
      update_discord_role_mapping: {
        Args: {
          p_description?: string
          p_role_id: string
          p_role_name: string
          p_tier: string
        }
        Returns: Json
      }
      user_can_access_feature: {
        Args: { feature_name: string; target_user_id?: string }
        Returns: boolean
      }
      user_has_tier: { Args: { required_tier: string }; Returns: boolean }
      watchlist_story_poll_targets: {
        Args: { batch_size?: number }
        Returns: {
          cik: string
          last_accession: string
          ticker: string
          watcher_count: number
        }[]
      }
      watchlist_story_watchers: {
        Args: { p_ticker: string }
        Returns: {
          role: string
          subscription_status: string
          subscription_tier: string
          thesis_invalidation: string
          tracking_mode: string
          user_id: string
          watchlist_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
