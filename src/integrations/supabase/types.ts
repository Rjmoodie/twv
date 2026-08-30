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
    PostgrestVersion: "14.5"
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
      accreditation_records: {
        Row: {
          basis: string | null
          created_at: string
          expires_at: string | null
          id: string
          method: string | null
          notes: string | null
          organization_id: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          basis?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          basis?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accreditation_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          created_at: string
          stripe_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          stripe_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          stripe_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brrrr_deals: {
        Row: {
          created_at: string
          deal_id: string | null
          deal_name: string
          id: string
          inputs: Json
          notes: string | null
          organization_id: string
          results: Json
          underwriting_version_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          deal_name: string
          id?: string
          inputs: Json
          notes?: string | null
          organization_id: string
          results: Json
          underwriting_version_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          deal_name?: string
          id?: string
          inputs?: Json
          notes?: string | null
          organization_id?: string
          results?: Json
          underwriting_version_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brrrr_deals_deal_id_organization_id_fkey"
            columns: ["deal_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "brrrr_deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brrrr_deals_underwriting_version_id_organization_id_fkey"
            columns: ["underwriting_version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "underwriting_versions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      budget_line_items: {
        Row: {
          approved_changes: number
          budget_id: string
          category: string
          code: string
          committed_amount: number
          created_at: string
          description: string
          id: string
          organization_id: string
          original_amount: number
          paid_amount: number
          updated_at: string
        }
        Insert: {
          approved_changes?: number
          budget_id: string
          category: string
          code: string
          committed_amount?: number
          created_at?: string
          description: string
          id?: string
          organization_id: string
          original_amount?: number
          paid_amount?: number
          updated_at?: string
        }
        Update: {
          approved_changes?: number
          budget_id?: string
          category?: string
          code?: string
          committed_amount?: number
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          original_amount?: number
          paid_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_budget_id_organization_id_fkey"
            columns: ["budget_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "budget_line_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      crm_activities: {
        Row: {
          activity_type: string
          assigned_to: string | null
          body: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          organization_id: string
          project_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          activity_type: string
          assigned_to?: string | null
          body?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          activity_type?: string
          assigned_to?: string | null
          body?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_organization_id_fkey"
            columns: ["contact_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "crm_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      crm_contact_projects: {
        Row: {
          contact_id: string
          created_at: string
          organization_id: string
          project_id: string
          relationship: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          organization_id: string
          project_id: string
          relationship: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          organization_id?: string
          project_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_projects_contact_id_organization_id_fkey"
            columns: ["contact_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "crm_contact_projects_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_name: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          kind: string
          last_contact_at: string | null
          last_name: string
          next_follow_up_at: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          relationship_owner_id: string | null
          source: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          kind: string
          last_contact_at?: string | null
          last_name: string
          next_follow_up_at?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          relationship_owner_id?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          kind?: string
          last_contact_at?: string | null
          last_name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          relationship_owner_id?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      deals: {
        Row: {
          asking_price: number | null
          assigned_to: string | null
          created_at: string
          created_by: string
          id: string
          metadata: Json
          name: string
          organization_id: string
          property_id: string | null
          source: string | null
          source_lead_id: string | null
          stage: string
          status: string
          strategy: string | null
          target_close_date: string | null
          updated_at: string
        }
        Insert: {
          asking_price?: number | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          property_id?: string | null
          source?: string | null
          source_lead_id?: string | null
          stage?: string
          status?: string
          strategy?: string | null
          target_close_date?: string | null
          updated_at?: string
        }
        Update: {
          asking_price?: number | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          property_id?: string | null
          source?: string | null
          source_lead_id?: string | null
          stage?: string
          status?: string
          strategy?: string | null
          target_close_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_organization_id_fkey"
            columns: ["property_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "deals_source_lead_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "real_estate_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      draw_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          draw_request_id: string
          id: string
          organization_id: string
          project_cost_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          draw_request_id: string
          id?: string
          organization_id: string
          project_cost_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          draw_request_id?: string
          id?: string
          organization_id?: string
          project_cost_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draw_items_draw_request_id_organization_id_fkey"
            columns: ["draw_request_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "draw_requests"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "draw_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draw_items_project_cost_id_organization_id_fkey"
            columns: ["project_cost_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "project_costs"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      draw_requests: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          created_at: string
          created_by: string
          draw_number: number
          funded_at: string | null
          id: string
          organization_id: string
          project_id: string
          requested_amount: number
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          created_at?: string
          created_by: string
          draw_number: number
          funded_at?: string | null
          id?: string
          organization_id: string
          project_id: string
          requested_amount?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          created_at?: string
          created_by?: string
          draw_number?: number
          funded_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          requested_amount?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draw_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draw_requests_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
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
          id?: never
          recipient: string
          sent_at?: string
        }
        Update: {
          id?: never
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
      investment_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          organization_id: string
          paid_at: string | null
          project_investment_id: string
          reference: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          organization_id: string
          paid_at?: string | null
          project_investment_id: string
          reference?: string | null
          status?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          organization_id?: string
          paid_at?: string | null
          project_investment_id?: string
          reference?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_transactions_project_investment_id_organization_fkey"
            columns: ["project_investment_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "project_investments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      investor_entities: {
        Row: {
          created_at: string
          created_by: string
          entity_type: string
          id: string
          name: string
          organization_id: string
          primary_contact_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          entity_type: string
          id?: string
          name: string
          organization_id: string
          primary_contact_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_type?: string
          id?: string
          name?: string
          organization_id?: string
          primary_contact_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_inquiries: {
        Row: {
          accreditation_self_report: string
          contact_id: string | null
          created_at: string
          email: string
          full_name: string
          heard_via: string | null
          id: string
          internal_notes: string | null
          investment_range: string | null
          message: string | null
          organization_id: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          timeframe: string | null
          updated_at: string
        }
        Insert: {
          accreditation_self_report?: string
          contact_id?: string | null
          created_at?: string
          email: string
          full_name: string
          heard_via?: string | null
          id?: string
          internal_notes?: string | null
          investment_range?: string | null
          message?: string | null
          organization_id?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          timeframe?: string | null
          updated_at?: string
        }
        Update: {
          accreditation_self_report?: string
          contact_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          heard_via?: string | null
          id?: string
          internal_notes?: string | null
          investment_range?: string | null
          message?: string | null
          organization_id?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          timeframe?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_inquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_inquiries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
        Relationships: [
          {
            foreignKeyName: "notification_outbox_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "notification_channel_policies"
            referencedColumns: ["event_type"]
          },
        ]
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
          metadata: Json
          outbox_id: string | null
          priority: number
          read: boolean
          read_at: string | null
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json
          outbox_id?: string | null
          priority?: number
          read?: boolean
          read_at?: string | null
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json
          outbox_id?: string | null
          priority?: number
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: true
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_primary: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_primary?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_primary?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_portfolio_entries: {
        Row: {
          ai_generated_at: string | null
          article_body: string | null
          article_excerpt: string | null
          article_title: string | null
          challenge: string | null
          completed_on: string | null
          created_at: string
          featured_image_url: string | null
          gallery_urls: string[]
          id: string
          location_public: string | null
          organization_id: string
          outcomes: string | null
          project_id: string | null
          project_type: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          services: string[]
          slug: string
          status: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          work_completed: string
        }
        Insert: {
          ai_generated_at?: string | null
          article_body?: string | null
          article_excerpt?: string | null
          article_title?: string | null
          challenge?: string | null
          completed_on?: string | null
          created_at?: string
          featured_image_url?: string | null
          gallery_urls?: string[]
          id?: string
          location_public?: string | null
          organization_id: string
          outcomes?: string | null
          project_id?: string | null
          project_type: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          services?: string[]
          slug: string
          status?: string
          summary: string
          title: string
          updated_at?: string
          user_id: string
          work_completed: string
        }
        Update: {
          ai_generated_at?: string | null
          article_body?: string | null
          article_excerpt?: string | null
          article_title?: string | null
          challenge?: string | null
          completed_on?: string | null
          created_at?: string
          featured_image_url?: string | null
          gallery_urls?: string[]
          id?: string
          location_public?: string | null
          organization_id?: string
          outcomes?: string | null
          project_id?: string | null
          project_type?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          services?: string[]
          slug?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          user_id?: string
          work_completed?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_portfolio_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_portfolio_entries_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          email_notifications_enabled: boolean
          first_login_at: string | null
          id: string
          last_login_at: string | null
          location: string | null
          login_count: number
          marketing_emails_enabled: boolean
          onboarding_completed: boolean
          onboarding_progress: Json
          onboarding_step: number
          price_alerts_enabled: boolean
          profile_completion_score: number
          push_notifications_enabled: boolean
          theme_preference: string
          tutorial_completed: boolean
          two_factor_enabled: boolean
          updated_at: string
          username: string | null
          website: string | null
          weekly_summary_enabled: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean
          first_login_at?: string | null
          id: string
          last_login_at?: string | null
          location?: string | null
          login_count?: number
          marketing_emails_enabled?: boolean
          onboarding_completed?: boolean
          onboarding_progress?: Json
          onboarding_step?: number
          price_alerts_enabled?: boolean
          profile_completion_score?: number
          push_notifications_enabled?: boolean
          theme_preference?: string
          tutorial_completed?: boolean
          two_factor_enabled?: boolean
          updated_at?: string
          username?: string | null
          website?: string | null
          weekly_summary_enabled?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          email_notifications_enabled?: boolean
          first_login_at?: string | null
          id?: string
          last_login_at?: string | null
          location?: string | null
          login_count?: number
          marketing_emails_enabled?: boolean
          onboarding_completed?: boolean
          onboarding_progress?: Json
          onboarding_step?: number
          price_alerts_enabled?: boolean
          profile_completion_score?: number
          push_notifications_enabled?: boolean
          theme_preference?: string
          tutorial_completed?: boolean
          two_factor_enabled?: boolean
          updated_at?: string
          username?: string | null
          website?: string | null
          weekly_summary_enabled?: boolean
        }
        Relationships: []
      }
      project_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          project_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          project_id: string
          status?: string
          updated_at?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_costs: {
        Row: {
          amount: number
          budget_line_item_id: string | null
          cost_date: string
          created_at: string
          created_by: string
          description: string
          document_url: string | null
          id: string
          organization_id: string
          project_id: string
          reference_number: string | null
          status: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          budget_line_item_id?: string | null
          cost_date: string
          created_at?: string
          created_by: string
          description: string
          document_url?: string | null
          id?: string
          organization_id: string
          project_id: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          budget_line_item_id?: string | null
          cost_date?: string
          created_at?: string
          created_by?: string
          description?: string
          document_url?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_costs_budget_line_item_id_organization_id_fkey"
            columns: ["budget_line_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "project_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_costs_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          name: string
          organization_id: string
          project_id: string
          storage_path: string
          uploaded_by: string
          visibility: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          name: string
          organization_id: string
          project_id: string
          storage_path: string
          uploaded_by: string
          visibility?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          name?: string
          organization_id?: string
          project_id?: string
          storage_path?: string
          uploaded_by?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_inquiries: {
        Row: {
          budget_range: string | null
          company_name: string | null
          contact_id: string | null
          created_at: string
          desired_timeline: string | null
          email: string
          full_name: string
          id: string
          internal_notes: string | null
          message: string
          organization_id: string | null
          phone: string | null
          project_type: string
          property_address: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          company_name?: string | null
          contact_id?: string | null
          created_at?: string
          desired_timeline?: string | null
          email: string
          full_name: string
          id?: string
          internal_notes?: string | null
          message: string
          organization_id?: string | null
          phone?: string | null
          project_type: string
          property_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          company_name?: string | null
          contact_id?: string | null
          created_at?: string
          desired_timeline?: string | null
          email?: string
          full_name?: string
          id?: string
          internal_notes?: string | null
          message?: string
          organization_id?: string | null
          phone?: string | null
          project_type?: string
          property_address?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_inquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inquiries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_investments: {
        Row: {
          commitment_amount: number
          contributed_amount: number
          created_at: string
          distributed_amount: number
          id: string
          investor_entity_id: string
          organization_id: string
          ownership_percent: number | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          commitment_amount?: number
          contributed_amount?: number
          created_at?: string
          distributed_amount?: number
          id?: string
          investor_entity_id: string
          organization_id: string
          ownership_percent?: number | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          commitment_amount?: number
          contributed_amount?: number
          created_at?: string
          distributed_amount?: number
          id?: string
          investor_entity_id?: string
          organization_id?: string
          ownership_percent?: number | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_investments_investor_entity_id_organization_id_fkey"
            columns: ["investor_entity_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "investor_entities"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "project_investments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_investments_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          email_claimed_at: string | null
          email_provider_message_id: string | null
          email_sent_at: string | null
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          project_id: string
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          email_claimed_at?: string | null
          email_provider_message_id?: string | null
          email_sent_at?: string | null
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          project_id: string
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          email_claimed_at?: string | null
          email_provider_message_id?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          project_id?: string
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invitations_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          organization_id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "project_members_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          milestone_type: string
          organization_id: string
          project_id: string
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_type?: string
          organization_id: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_type?: string
          organization_id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_requests: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          organization_id: string
          priority: string
          project_id: string
          request_type: string
          requested_by: string
          resolution_note: string | null
          resolved_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          organization_id: string
          priority?: string
          project_id: string
          request_type: string
          requested_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          priority?: string
          project_id?: string
          request_type?: string
          requested_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_requests_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      project_updates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          organization_id: string
          project_id: string
          published_at: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          project_id: string
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          project_id?: string
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_organization_id_fkey"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_completion_date: string | null
          approved_budget: number
          created_at: string
          created_by: string
          deal_id: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string
          project_manager_id: string | null
          property_id: string
          stage: string
          start_date: string | null
          status: string
          target_completion_date: string | null
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          approved_budget?: number
          created_at?: string
          created_by: string
          deal_id?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          project_manager_id?: string | null
          property_id: string
          stage?: string
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          approved_budget?: number
          created_at?: string
          created_by?: string
          deal_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          project_manager_id?: string | null
          property_id?: string
          stage?: string
          start_date?: string | null
          status?: string
          target_completion_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_deal_id_organization_id_fkey"
            columns: ["deal_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_property_id_organization_id_fkey"
            columns: ["property_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      properties: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          county: string | null
          created_at: string
          created_by: string
          id: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          name: string | null
          organization_id: string
          parcel_number: string | null
          postal_code: string
          property_type: string | null
          square_feet: number | null
          state: string
          units: number | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          county?: string | null
          created_at?: string
          created_by: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name?: string | null
          organization_id: string
          parcel_number?: string | null
          postal_code: string
          property_type?: string | null
          square_feet?: number | null
          state: string
          units?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          county?: string | null
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name?: string | null
          organization_id?: string
          parcel_number?: string | null
          postal_code?: string
          property_type?: string | null
          square_feet?: number | null
          state?: string
          units?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      push_rate_limit_log: {
        Row: {
          consumed_at: string
          id: number
          rate_limit_key: string
          user_id: string
        }
        Insert: {
          consumed_at?: string
          id?: never
          rate_limit_key: string
          user_id: string
        }
        Update: {
          consumed_at?: string
          id?: never
          rate_limit_key?: string
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
          records_fetched: number
          records_inserted: number
          records_updated: number
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_source: string
          error_message?: string | null
          id?: string
          records_fetched?: number
          records_inserted?: number
          records_updated?: number
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_source?: string
          error_message?: string | null
          id?: string
          records_fetched?: number
          records_inserted?: number
          records_updated?: number
          started_at?: string
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
          is_absentee: boolean
          is_distressed: boolean | null
          is_llc_owned: boolean
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
          tags: string[]
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
          is_absentee?: boolean
          is_distressed?: boolean | null
          is_llc_owned?: boolean
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
          tags?: string[]
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
          is_absentee?: boolean
          is_distressed?: boolean | null
          is_llc_owned?: boolean
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
          tags?: string[]
          tax_amount?: number | null
          updated_at?: string
          violation_description?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status: string
          stripe_price_id?: string | null
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          dashboard_layout: Json | null
          id: string
          notification_preferences: Json
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_layout?: Json | null
          id?: string
          notification_preferences?: Json
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_layout?: Json | null
          id?: string
          notification_preferences?: Json
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      underwriting_versions: {
        Row: {
          assumptions: Json
          created_at: string
          created_by: string
          deal_id: string
          id: string
          inputs: Json
          model_type: string
          notes: string | null
          organization_id: string
          results: Json
          version: number
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          created_by: string
          deal_id: string
          id?: string
          inputs: Json
          model_type: string
          notes?: string | null
          organization_id: string
          results: Json
          version: number
        }
        Update: {
          assumptions?: Json
          created_at?: string
          created_by?: string
          deal_id?: string
          id?: string
          inputs?: Json
          model_type?: string
          notes?: string | null
          organization_id?: string
          results?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "underwriting_versions_deal_id_organization_id_fkey"
            columns: ["deal_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "underwriting_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          created_at: string
          feature_type: string
          id: string
          month_year: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_type: string
          id?: string
          month_year?: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature_type?: string
          id?: string
          month_year?: string
          updated_at?: string
          usage_count?: number
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
          metadata: Json
          priority: number
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
          votes_count: number
        }
        Insert: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          priority?: number
          status?: string
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
          votes_count?: number
        }
        Update: {
          admin_response?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          priority?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          votes_count?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          discord_id: string | null
          discord_username: string | null
          email: string
          id: string
          name: string | null
          role: string
          stripe_customer_id: string | null
          subscription_ends_at: string | null
          subscription_status: string
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          email: string
          id: string
          name?: string | null
          role?: string
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string
          stripe_customer_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      subscribers: {
        Row: {
          created_at: string | null
          email: string | null
          features_enabled: Json | null
          id: string | null
          stripe_customer_id: string | null
          subscribed: boolean | null
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string | null
          usage_limits: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          features_enabled?: never
          id?: string | null
          stripe_customer_id?: string | null
          subscribed?: never
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          usage_limits?: never
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          features_enabled?: never
          id?: string | null
          stripe_customer_id?: string | null
          subscribed?: never
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          usage_limits?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_project_invitation: {
        Args: { invitation_token: string }
        Returns: string
      }
      calculate_notification_retry_time: {
        Args: { attempt: number }
        Returns: string
      }
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
      claim_project_invitation_delivery: {
        Args: { invitation_token: string }
        Returns: {
          email_sent_at: string
          expires_at: string
          invitation_id: string
          invite_email: string
          invite_role: string
          project_name: string
        }[]
      }
      consume_email_rate_slot: {
        Args: {
          p_global_per_minute?: number
          p_per_recipient_per_minute?: number
          p_recipient: string
        }
        Returns: boolean
      }
      consume_push_rate_slot: {
        Args: {
          p_key: string
          p_max: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      create_crm_contact: {
        Args: {
          company_name?: string
          contact_kind: string
          email?: string
          first_name: string
          last_name: string
          phone?: string
          target_organization: string
          target_project?: string
        }
        Returns: string
      }
      create_organization: {
        Args: { organization_name: string; organization_slug: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          is_primary: boolean
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_portfolio_project: {
        Args: {
          address_line1: string
          approved_budget?: number
          city: string
          latitude?: number
          longitude?: number
          postal_code: string
          project_name: string
          project_stage?: string
          property_name?: string
          property_type?: string
          start_date?: string
          state: string
          target_completion_date?: string
          target_organization: string
        }
        Returns: string
      }
      create_project_invitation: {
        Args: {
          invite_email: string
          invite_role: string
          target_project: string
          valid_for?: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          invitation_token: string
        }[]
      }
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
      get_portfolio_projects: {
        Args: never
        Returns: {
          access_role: string
          address: string
          approved_budget: number
          budget_variance: number
          can_manage: boolean
          city: string
          commitment_amount: number
          committed_amount: number
          contributed_amount: number
          distributed_amount: number
          health: string
          latest_update_at: string
          latest_update_id: string
          latest_update_title: string
          latitude: number
          longitude: number
          next_action: string
          next_action_label: string
          next_milestone_due: string
          next_milestone_id: string
          next_milestone_title: string
          organization_id: string
          overdue_milestones: number
          paid_amount: number
          postal_code: string
          project_id: string
          project_manager_id: string
          project_name: string
          property_name: string
          stage: string
          start_date: string
          state: string
          status: string
          target_completion_date: string
        }[]
      }
      queue_due_calendar_reminders: {
        Args: { as_of?: string }
        Returns: number
      }
      queue_due_project_milestones: {
        Args: { as_of?: string }
        Returns: number
      }
      submit_investor_inquiry: {
        Args: {
          accreditation_self_report?: string
          email: string
          full_name: string
          heard_via?: string
          investment_range?: string
          message?: string
          phone?: string
          timeframe?: string
        }
        Returns: string
      }
      submit_project_inquiry: {
        Args: {
          budget_range?: string
          company_name?: string
          desired_timeline?: string
          email: string
          full_name: string
          message?: string
          phone?: string
          project_type?: string
          property_address?: string
        }
        Returns: string
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
