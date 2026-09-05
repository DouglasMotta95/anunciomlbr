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
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          meta: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          meta?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          meta?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_credit_usage: {
        Row: {
          id: string
          period_start: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          id?: string
          period_start: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          id?: string
          period_start?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          amount_cents: number | null
          coupon_code: string | null
          created_at: string
          event: string
          id: string
          is_bot: boolean
          meta: Json
          path: string | null
          period: string | null
          plan_code: string | null
          session_id: string | null
          source: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          amount_cents?: number | null
          coupon_code?: string | null
          created_at?: string
          event: string
          id?: string
          is_bot?: boolean
          meta?: Json
          path?: string | null
          period?: string | null
          plan_code?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          amount_cents?: number | null
          coupon_code?: string | null
          created_at?: string
          event?: string
          id?: string
          is_bot?: boolean
          meta?: Json
          path?: string | null
          period?: string | null
          plan_code?: string | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      automation_rule_runs: {
        Row: {
          created_at: string
          executed_external_action: boolean
          id: string
          matched_count: number
          result: Json
          rule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_external_action?: boolean
          id?: string
          matched_count?: number
          result?: Json
          rule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          executed_external_action?: boolean
          id?: string
          matched_count?: number
          result?: Json
          rule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: string
          created_at: string
          dry_run: boolean
          enabled: boolean
          id: string
          last_evaluated_at: string | null
          last_result: Json | null
          maximum_price_cents: number | null
          minimum_margin_percent: number | null
          minimum_price_cents: number | null
          name: string
          signal: string
          threshold: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          dry_run?: boolean
          enabled?: boolean
          id?: string
          last_evaluated_at?: string | null
          last_result?: Json | null
          maximum_price_cents?: number | null
          minimum_margin_percent?: number | null
          minimum_price_cents?: number | null
          name: string
          signal: string
          threshold?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          dry_run?: boolean
          enabled?: boolean
          id?: string
          last_evaluated_at?: string | null
          last_result?: Json | null
          maximum_price_cents?: number | null
          minimum_margin_percent?: number | null
          minimum_price_cents?: number | null
          name?: string
          signal?: string
          threshold?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_jobs: {
        Row: {
          created_at: string
          error: string | null
          failed: number
          id: string
          kind: string
          payload: Json
          processed: number
          status: Database["public"]["Enums"]["job_status"]
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          failed?: number
          id?: string
          kind: string
          payload?: Json
          processed?: number
          status?: Database["public"]["Enums"]["job_status"]
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          failed?: number
          id?: string
          kind?: string
          payload?: Json
          processed?: number
          status?: Database["public"]["Enums"]["job_status"]
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      competitor_watch: {
        Row: {
          created_at: string
          id: string
          last_available_quantity: number | null
          last_checked_at: string | null
          last_price_cents: number | null
          last_sold_quantity: number | null
          last_status: string | null
          ml_item_id: string
          permalink: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_available_quantity?: number | null
          last_checked_at?: string | null
          last_price_cents?: number | null
          last_sold_quantity?: number | null
          last_status?: string | null
          ml_item_id: string
          permalink?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_available_quantity?: number | null
          last_checked_at?: string | null
          last_price_cents?: number | null
          last_sold_quantity?: number | null
          last_status?: string | null
          ml_item_id?: string
          permalink?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      competitor_watch_snapshots: {
        Row: {
          available_quantity: number | null
          captured_at: string
          id: string
          permalink: string | null
          price_cents: number | null
          sold_quantity: number | null
          status: string | null
          title: string | null
          user_id: string
          watch_id: string
        }
        Insert: {
          available_quantity?: number | null
          captured_at?: string
          id?: string
          permalink?: string | null
          price_cents?: number | null
          sold_quantity?: number | null
          status?: string | null
          title?: string | null
          user_id: string
          watch_id: string
        }
        Update: {
          available_quantity?: number | null
          captured_at?: string
          id?: string
          permalink?: string | null
          price_cents?: number | null
          sold_quantity?: number | null
          status?: string | null
          title?: string | null
          user_id?: string
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_watch_snapshots_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "competitor_watch"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_percent: number
          expires_at: string | null
          id: string
          max_uses: number | null
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      keyword_track_snapshots: {
        Row: {
          captured_at: string
          found: boolean
          id: string
          position: number | null
          result_window: number
          track_id: string
          user_id: string
        }
        Insert: {
          captured_at?: string
          found?: boolean
          id?: string
          position?: number | null
          result_window?: number
          track_id: string
          user_id: string
        }
        Update: {
          captured_at?: string
          found?: boolean
          id?: string
          position?: number | null
          result_window?: number
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_track_snapshots_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "keyword_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_tracks: {
        Row: {
          created_at: string
          id: string
          keyword: string
          last_checked_at: string | null
          last_position: number | null
          listing_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          last_checked_at?: string | null
          last_position?: number | null
          listing_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          last_checked_at?: string | null
          last_position?: number | null
          listing_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_tracks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      license_alert_log: {
        Row: {
          channel: string
          created_at: string
          day_bucket: number
          error: string | null
          id: string
          license_id: string
          recipient: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          day_bucket: number
          error?: string | null
          id?: string
          license_id: string
          recipient?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          day_bucket?: number
          error?: string | null
          id?: string
          license_id?: string
          recipient?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_alert_log_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      license_alert_settings: {
        Row: {
          body_template: string
          days: number[]
          enabled: boolean
          from_name: string
          id: boolean
          subject_template: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          days?: number[]
          enabled?: boolean
          from_name?: string
          id?: boolean
          subject_template?: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          days?: number[]
          enabled?: boolean
          from_name?: string
          id?: boolean
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      licenses: {
        Row: {
          activated_at: string | null
          ads_quota: number | null
          ads_used: number
          ai_credits_used: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          origin: Database["public"]["Enums"]["license_origin"]
          period: Database["public"]["Enums"]["billing_period"]
          plan_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          ads_quota?: number | null
          ads_used?: number
          ai_credits_used?: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          origin?: Database["public"]["Enums"]["license_origin"]
          period?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          ads_quota?: number | null
          ads_used?: number
          ai_credits_used?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          origin?: Database["public"]["Enums"]["license_origin"]
          period?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_quota_claims: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_quota_claims_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          ai_score: number | null
          attributes: Json
          category: string | null
          condition: string | null
          cost_cents: number | null
          created_at: string
          description: string | null
          fees_cents: number | null
          id: string
          images: Json
          price_cents: number | null
          published_at: string | null
          published_ml_id: string | null
          published_permalink: string | null
          publishing_claim_token: string | null
          publishing_claimed_at: string | null
          sku: string | null
          source_ml_id: string | null
          source_permalink: string | null
          status: Database["public"]["Enums"]["listing_status"]
          stock: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_score?: number | null
          attributes?: Json
          category?: string | null
          condition?: string | null
          cost_cents?: number | null
          created_at?: string
          description?: string | null
          fees_cents?: number | null
          id?: string
          images?: Json
          price_cents?: number | null
          published_at?: string | null
          published_ml_id?: string | null
          published_permalink?: string | null
          publishing_claim_token?: string | null
          publishing_claimed_at?: string | null
          sku?: string | null
          source_ml_id?: string | null
          source_permalink?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_score?: number | null
          attributes?: Json
          category?: string | null
          condition?: string | null
          cost_cents?: number | null
          created_at?: string
          description?: string | null
          fees_cents?: number | null
          id?: string
          images?: Json
          price_cents?: number | null
          published_at?: string | null
          published_ml_id?: string | null
          published_permalink?: string | null
          publishing_claim_token?: string | null
          publishing_claimed_at?: string | null
          sku?: string | null
          source_ml_id?: string | null
          source_permalink?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          stock?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_connections: {
        Row: {
          connected: boolean
          created_at: string
          last_sync_at: string | null
          listings_count: number | null
          ml_user_id: string | null
          nickname: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected?: boolean
          created_at?: string
          last_sync_at?: string | null
          listings_count?: number | null
          ml_user_id?: string | null
          nickname?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected?: boolean
          created_at?: string
          last_sync_at?: string | null
          listings_count?: number | null
          ml_user_id?: string | null
          nickname?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_notifications: {
        Row: {
          application_id: string | null
          attempts: number
          created_at: string
          error: string | null
          id: string
          ml_user_id: string | null
          notification_id: string | null
          payload: Json | null
          processed: boolean
          processed_at: string | null
          received_at: string
          resource: string
          sent_at: string | null
          topic: string
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          ml_user_id?: string | null
          notification_id?: string | null
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          resource: string
          sent_at?: string | null
          topic: string
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          ml_user_id?: string | null
          notification_id?: string | null
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          resource?: string
          sent_at?: string | null
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ml_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_tokens: {
        Row: {
          access_token: string
          expires_at: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_value_snapshots: {
        Row: {
          ai_actions: number
          created_at: string
          estimated_minutes_saved: number
          id: string
          listings_created: number
          listings_optimized: number
          orders: number
          period_start: string
          revenue_cents: number
          units_sold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_actions?: number
          created_at?: string
          estimated_minutes_saved?: number
          id?: string
          listings_created?: number
          listings_optimized?: number
          orders?: number
          period_start: string
          revenue_cents?: number
          units_sold?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_actions?: number
          created_at?: string
          estimated_minutes_saved?: number
          id?: string
          listings_created?: number
          listings_optimized?: number
          orders?: number
          period_start?: string
          revenue_cents?: number
          units_sold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          period: Database["public"]["Enums"]["billing_period"]
          plan_id: string | null
          provider: string
          provider_ref: string | null
          raw: Json | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          period?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string | null
          provider?: string
          provider_ref?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          period?: Database["public"]["Enums"]["billing_period"]
          plan_id?: string | null
          provider?: string
          provider_ref?: string | null
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      period_discounts: {
        Row: {
          discount_percent: number
          label: string
          months: number
          period: Database["public"]["Enums"]["billing_period"]
          updated_at: string
        }
        Insert: {
          discount_percent?: number
          label: string
          months: number
          period: Database["public"]["Enums"]["billing_period"]
          updated_at?: string
        }
        Update: {
          discount_percent?: number
          label?: string
          months?: number
          period?: Database["public"]["Enums"]["billing_period"]
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          ad_quota: number | null
          ai_credits: number | null
          badge: string | null
          code: string
          created_at: string
          feature_flags: Json
          features: Json
          highlighted: boolean
          id: string
          kind: Database["public"]["Enums"]["plan_kind"]
          listing_limit: number | null
          name: string
          period_months: number | null
          price_monthly_cents: number
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          ad_quota?: number | null
          ai_credits?: number | null
          badge?: string | null
          code: string
          created_at?: string
          feature_flags?: Json
          features?: Json
          highlighted?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["plan_kind"]
          listing_limit?: number | null
          name: string
          period_months?: number | null
          price_monthly_cents: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          ad_quota?: number | null
          ai_credits?: number | null
          badge?: string | null
          code?: string
          created_at?: string
          feature_flags?: Json
          features?: Json
          highlighted?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["plan_kind"]
          listing_limit?: number | null
          name?: string
          period_months?: number | null
          price_monthly_cents?: number
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_audit_log: {
        Row: {
          applied: boolean
          created_at: string
          id: string
          listing_id: string | null
          minimum_price_cents: number | null
          previous_price_cents: number | null
          strategy: string
          suggested_price_cents: number
          target_margin_percent: number | null
          user_id: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          id?: string
          listing_id?: string | null
          minimum_price_cents?: number | null
          previous_price_cents?: number | null
          strategy?: string
          suggested_price_cents: number
          target_margin_percent?: number | null
          user_id: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          id?: string
          listing_id?: string | null
          minimum_price_cents?: number | null
          previous_price_cents?: number | null
          strategy?: string
          suggested_price_cents?: number
          target_margin_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_audit_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          free_listings_limit: number
          free_listings_used: number
          full_name: string | null
          id: string
          last_seen_at: string | null
          onboarding_done: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          free_listings_limit?: number
          free_listings_used?: number
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          onboarding_done?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          free_listings_limit?: number
          free_listings_used?: number
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          onboarding_done?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          reward_ads: number
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          reward_ads?: number
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          reward_ads?: number
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          converted_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
          reward_ads: number
          status: string
        }
        Insert: {
          code: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
          reward_ads?: number
          status?: string
        }
        Update: {
          code?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_ads?: number
          status?: string
        }
        Relationships: []
      }
      registration_abuse_events: {
        Row: {
          created_at: string
          device_hash: string
          email_hash: string
          id: string
          ip_hash: string
          reservation_token_hash: string
          status: string
          updated_at: string
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_hash: string
          email_hash: string
          id?: string
          ip_hash: string
          reservation_token_hash: string
          status?: string
          updated_at?: string
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_hash?: string
          email_hash?: string
          id?: string
          ip_hash?: string
          reservation_token_hash?: string
          status?: string
          updated_at?: string
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reseller_customers: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string | null
          id: string
          last_license_code: string | null
          reseller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name?: string | null
          id?: string
          last_license_code?: string | null
          reseller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          id?: string
          last_license_code?: string | null
          reseller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_customers_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_sales: {
        Row: {
          commission_cents: number
          created_at: string
          customer_user_id: string | null
          id: string
          license_id: string | null
          plan_id: string | null
          reseller_cost_cents: number
          reseller_id: string
          sale_price_cents: number
          status: string
        }
        Insert: {
          commission_cents?: number
          created_at?: string
          customer_user_id?: string | null
          id?: string
          license_id?: string | null
          plan_id?: string | null
          reseller_cost_cents: number
          reseller_id: string
          sale_price_cents: number
          status?: string
        }
        Update: {
          commission_cents?: number
          created_at?: string
          customer_user_id?: string | null
          id?: string
          license_id?: string | null
          plan_id?: string | null
          reseller_cost_cents?: number
          reseller_id?: string
          sale_price_cents?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_sales_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_sales_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_sales_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_wallet_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          kind: string
          reference: string | null
          reseller_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          kind: string
          reference?: string | null
          reseller_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: string
          reference?: string | null
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_wallet_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          created_at: string
          created_by: string | null
          discount_percent: number
          email: string
          id: string
          name: string
          status: string
          total_commission_cents: number
          total_sales_cents: number
          updated_at: string
          user_id: string | null
          wallet_cents: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          email: string
          id?: string
          name: string
          status?: string
          total_commission_cents?: number
          total_sales_cents?: number
          updated_at?: string
          user_id?: string | null
          wallet_cents?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          email?: string
          id?: string
          name?: string
          status?: string
          total_commission_cents?: number
          total_sales_cents?: number
          updated_at?: string
          user_id?: string | null
          wallet_cents?: number
        }
        Relationships: []
      }
      sales_recovery_actions: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          message: string | null
          note: string | null
          payment_id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          message?: string | null
          note?: string | null
          payment_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          message?: string | null
          note?: string | null
          payment_id?: string
        }
        Relationships: []
      }
      seller_action_state: {
        Row: {
          action_key: string
          completed_at: string | null
          created_at: string
          dismissed_until: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key: string
          completed_at?: string | null
          created_at?: string
          dismissed_until?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string
          completed_at?: string | null
          created_at?: string
          dismissed_until?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          bot_reason: string | null
          created_at: string
          id: string
          is_authenticated: boolean
          is_bot: boolean
          path: string
          referrer: string | null
          session_id: string | null
          source: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          bot_reason?: string | null
          created_at?: string
          id?: string
          is_authenticated?: boolean
          is_bot?: boolean
          path?: string
          referrer?: string | null
          session_id?: string | null
          source?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          bot_reason?: string | null
          created_at?: string
          id?: string
          is_authenticated?: boolean
          is_bot?: boolean
          path?: string
          referrer?: string | null
          session_id?: string | null
          source?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      subscription_cancellation_requests: {
        Row: {
          details: string | null
          id: string
          license_id: string | null
          reason: string
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          details?: string | null
          id?: string
          license_id?: string | null
          reason: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          details?: string | null
          id?: string
          license_id?: string | null
          reason?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cancellation_requests_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_retention_feedback: {
        Row: {
          accepted_alternative: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          accepted_alternative?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          accepted_alternative?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          opportunity_alerts: boolean
          quota_alerts: boolean
          sales_alerts: boolean
          stock_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          opportunity_alerts?: boolean
          quota_alerts?: boolean
          sales_alerts?: boolean
          stock_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          opportunity_alerts?: boolean
          quota_alerts?: boolean
          sales_alerts?: boolean
          stock_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_to: string | null
          body: string
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          action_to?: string | null
          body: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          action_to?: string | null
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_product_events: {
        Row: {
          created_at: string
          event_key: string | null
          event_type: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ad_quota_summary: {
        Args: { _user_id: string }
        Returns: {
          expires_at: string
          plan_name: string
          quota: number
          remaining: number
          used: number
        }[]
      }
      ai_credit_status: {
        Args: { p_user_id: string }
        Returns: {
          credit_limit: number
          remaining: number
          used: number
        }[]
      }
      claim_listing_quota: {
        Args: { _listing_id: string; _user_id: string }
        Returns: boolean
      }
      consume_ad_quota: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      consume_ai_credit: {
        Args: { p_amount?: number; p_user_id: string }
        Returns: {
          allowed: boolean
          credit_limit: number
          remaining: number
          used: number
        }[]
      }
      consume_coupon_use: { Args: { _code: string }; Returns: boolean }
      ensure_referral_code: { Args: never; Returns: string }
      generate_license_code: { Args: { _plan_code: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_ad_quota: {
        Args: never
        Returns: {
          expires_at: string
          plan_name: string
          quota: number
          remaining: number
          used: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "owner" | "support" | "viewer"
      billing_period: "monthly" | "quarterly" | "semiannual" | "annual"
      job_status: "queued" | "processing" | "done" | "error"
      license_origin:
        | "mercado_pago"
        | "pix_manual"
        | "courtesy"
        | "promo"
        | "partner"
        | "admin"
      license_status:
        | "available"
        | "active"
        | "expired"
        | "suspended"
        | "cancelled"
      listing_status:
        | "draft"
        | "active"
        | "paused"
        | "error"
        | "closed"
        | "under_review"
        | "inactive"
      plan_kind:
        | "subscription"
        | "ad_package"
        | "subscription_with_ad_limit"
        | "ai_package"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "owner", "support", "viewer"],
      billing_period: ["monthly", "quarterly", "semiannual", "annual"],
      job_status: ["queued", "processing", "done", "error"],
      license_origin: [
        "mercado_pago",
        "pix_manual",
        "courtesy",
        "promo",
        "partner",
        "admin",
      ],
      license_status: [
        "available",
        "active",
        "expired",
        "suspended",
        "cancelled",
      ],
      listing_status: [
        "draft",
        "active",
        "paused",
        "error",
        "closed",
        "under_review",
        "inactive",
      ],
      plan_kind: [
        "subscription",
        "ad_package",
        "subscription_with_ad_limit",
        "ai_package",
      ],
    },
  },
} as const
