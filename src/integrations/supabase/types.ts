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
    PostgrestVersion: "14.17"
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
      analytics_events: {
        Row: {
          amount_cents: number | null
          coupon_code: string | null
          created_at: string
          event: string
          id: string
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
      licenses: {
        Row: {
          activated_at: string | null
          ads_quota: number | null
          ads_used: number
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
      site_visits: {
        Row: {
          created_at: string
          id: string
          is_authenticated: boolean
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
          created_at?: string
          id?: string
          is_authenticated?: boolean
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
          created_at?: string
          id?: string
          is_authenticated?: boolean
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
      consume_ad_quota: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
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
      app_role: "admin" | "user"
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
      listing_status: "draft" | "active" | "paused" | "error"
      plan_kind: "subscription" | "ad_package" | "subscription_with_ad_limit"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
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
      listing_status: ["draft", "active", "paused", "error"],
      plan_kind: ["subscription", "ad_package", "subscription_with_ad_limit"],
    },
  },
} as const
