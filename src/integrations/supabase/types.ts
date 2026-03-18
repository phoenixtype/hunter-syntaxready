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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_activity_logs: {
        Row: {
          action: string
          agent: string
          created_at: string
          details: string | null
          id: string
          log_type: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          agent: string
          created_at?: string
          details?: string | null
          id?: string
          log_type?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          agent?: string
          created_at?: string
          details?: string | null
          id?: string
          log_type?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      application_history: {
        Row: {
          applied_at: string
          company: string
          id: string
          job_id: string | null
          job_title: string
          job_url: string | null
          metadata: Json | null
          notes: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string
          company: string
          id?: string
          job_id?: string | null
          job_title: string
          job_url?: string | null
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string
          company?: string
          id?: string
          job_id?: string | null
          job_title?: string
          job_url?: string | null
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          created_at: string
          education: Json
          experience_atoms: Json
          id: string
          identity: Json
          raw_resume_text: string | null
          resume_file_url: string | null
          skills: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          education?: Json
          experience_atoms?: Json
          id?: string
          identity?: Json
          raw_resume_text?: string | null
          resume_file_url?: string | null
          skills?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          education?: Json
          experience_atoms?: Json
          id?: string
          identity?: Json
          raw_resume_text?: string | null
          resume_file_url?: string | null
          skills?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_metrics: {
        Row: {
          action_count: number | null
          action_type: string
          created_at: string
          hour_bucket: string
          id: string
          user_id: string
        }
        Insert: {
          action_count?: number | null
          action_type: string
          created_at?: string
          hour_bucket: string
          id?: string
          user_id: string
        }
        Update: {
          action_count?: number | null
          action_type?: string
          created_at?: string
          hour_bucket?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_actions: {
        Row: {
          action: string
          created_at: string
          id: string
          job_id: string
          job_metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          job_id: string
          job_metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          job_id?: string
          job_metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      job_listings: {
        Row: {
          company: string
          created_at: string
          credibility_score: number | null
          description: string | null
          freshness_score: number | null
          id: string
          job_hash: string
          location: string | null
          posted_at: string | null
          raw_data: Json | null
          salary_range: string | null
          source: string
          tech_stack: string[] | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          company: string
          created_at?: string
          credibility_score?: number | null
          description?: string | null
          freshness_score?: number | null
          id?: string
          job_hash: string
          location?: string | null
          posted_at?: string | null
          raw_data?: Json | null
          salary_range?: string | null
          source?: string
          tech_stack?: string[] | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          company?: string
          created_at?: string
          credibility_score?: number | null
          description?: string | null
          freshness_score?: number | null
          id?: string
          job_hash?: string
          location?: string | null
          posted_at?: string | null
          raw_data?: Json | null
          salary_range?: string | null
          source?: string
          tech_stack?: string[] | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      learning_weights: {
        Row: {
          banned_companies: string[] | null
          created_at: string
          culture_weight: number | null
          freshness_weight: number | null
          id: string
          preferred_skills: string[] | null
          skill_weight: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          banned_companies?: string[] | null
          created_at?: string
          culture_weight?: number | null
          freshness_weight?: number | null
          id?: string
          preferred_skills?: string[] | null
          skill_weight?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          banned_companies?: string[] | null
          created_at?: string
          culture_weight?: number | null
          freshness_weight?: number | null
          id?: string
          preferred_skills?: string[] | null
          skill_weight?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          alert_frequency: string
          application_updates: boolean
          created_at: string
          email_enabled: boolean
          id: string
          job_alerts: boolean
          notification_email: string | null
          phone_number: string | null
          sms_enabled: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          alert_frequency?: string
          application_updates?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          job_alerts?: boolean
          notification_email?: string | null
          phone_number?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          alert_frequency?: string
          application_updates?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          job_alerts?: boolean
          notification_email?: string | null
          phone_number?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          created_at: string
          function_name: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          function_name: string
          request_count: number | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          function_name: string
          request_count?: number | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          function_name?: string
          request_count?: number | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      recruiter_applications: {
        Row: {
          company_name: string
          company_size: string | null
          company_website: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          use_case: string | null
          user_id: string | null
        }
        Insert: {
          company_name: string
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_title: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          use_case?: string | null
          user_id?: string | null
        }
        Update: {
          company_name?: string
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          use_case?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      recruiter_job_applications: {
        Row: {
          application_history_id: string | null
          applied_at: string
          candidate_id: string
          cover_letter: string | null
          id: string
          is_auto_applied: boolean
          match_score: number | null
          recruiter_job_id: string
          recruiter_notes: string | null
          resume_snapshot: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          application_history_id?: string | null
          applied_at?: string
          candidate_id: string
          cover_letter?: string | null
          id?: string
          is_auto_applied?: boolean
          match_score?: number | null
          recruiter_job_id: string
          recruiter_notes?: string | null
          resume_snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          application_history_id?: string | null
          applied_at?: string
          candidate_id?: string
          cover_letter?: string | null
          id?: string
          is_auto_applied?: boolean
          match_score?: number | null
          recruiter_job_id?: string
          recruiter_notes?: string | null
          resume_snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_job_applications_application_history_id_fkey"
            columns: ["application_history_id"]
            isOneToOne: false
            referencedRelation: "application_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_job_applications_recruiter_job_id_fkey"
            columns: ["recruiter_job_id"]
            isOneToOne: false
            referencedRelation: "recruiter_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_jobs: {
        Row: {
          application_count: number
          application_deadline: string | null
          benefits: string | null
          company: string
          created_at: string
          description: string
          employment_type: string
          experience_level: string | null
          id: string
          job_listing_id: string | null
          location: string | null
          location_type: string
          max_applicants: number | null
          recruiter_id: string
          requirements: string | null
          responsibilities: string | null
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          status: string
          tech_stack: string[] | null
          title: string
          updated_at: string
          view_count: number
          visa_sponsorship: boolean
        }
        Insert: {
          application_count?: number
          application_deadline?: string | null
          benefits?: string | null
          company: string
          created_at?: string
          description: string
          employment_type?: string
          experience_level?: string | null
          id?: string
          job_listing_id?: string | null
          location?: string | null
          location_type?: string
          max_applicants?: number | null
          recruiter_id: string
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          tech_stack?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
          visa_sponsorship?: boolean
        }
        Update: {
          application_count?: number
          application_deadline?: string | null
          benefits?: string | null
          company?: string
          created_at?: string
          description?: string
          employment_type?: string
          experience_level?: string | null
          id?: string
          job_listing_id?: string | null
          location?: string | null
          location_type?: string
          max_applicants?: number | null
          recruiter_id?: string
          requirements?: string | null
          responsibilities?: string | null
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          tech_stack?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
          visa_sponsorship?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_jobs_job_listing_id_fkey"
            columns: ["job_listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_outreach: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          message: string | null
          outreach_type: string
          recruiter_id: string
          recruiter_job_id: string | null
          status: string
          subject: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          message?: string | null
          outreach_type?: string
          recruiter_id: string
          recruiter_job_id?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          message?: string | null
          outreach_type?: string
          recruiter_id?: string
          recruiter_job_id?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_outreach_recruiter_job_id_fkey"
            columns: ["recruiter_job_id"]
            isOneToOne: false
            referencedRelation: "recruiter_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_profiles: {
        Row: {
          about: string | null
          company_logo_url: string | null
          company_name: string
          company_size: string | null
          company_website: string | null
          created_at: string
          headquarters: string | null
          id: string
          industry: string | null
          is_verified: boolean
          linkedin_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          about?: string | null
          company_logo_url?: string | null
          company_name: string
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          headquarters?: string | null
          id?: string
          industry?: string | null
          is_verified?: boolean
          linkedin_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          about?: string | null
          company_logo_url?: string | null
          company_name?: string
          company_size?: string | null
          company_website?: string | null
          created_at?: string
          headquarters?: string | null
          id?: string
          industry?: string | null
          is_verified?: boolean
          linkedin_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tailored_resumes: {
        Row: {
          changes_summary: string[]
          company: string
          cover_letter: string
          created_at: string
          id: string
          job_title: string
          job_url: string | null
          tailored_profile: Json
          user_id: string
        }
        Insert: {
          changes_summary?: string[]
          company: string
          cover_letter?: string
          created_at?: string
          id?: string
          job_title: string
          job_url?: string | null
          tailored_profile?: Json
          user_id: string
        }
        Update: {
          changes_summary?: string[]
          company?: string
          cover_letter?: string
          created_at?: string
          id?: string
          job_title?: string
          job_url?: string | null
          tailored_profile?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          aggressiveness: number | null
          alert_frequency: string | null
          auto_apply_enabled: boolean
          auto_apply_min_match_score: number
          created_at: string
          email_alerts_enabled: boolean | null
          experience_level: string | null
          has_clearance: boolean | null
          id: string
          locations: string[] | null
          min_salary_usd: number | null
          notice_period_days: number | null
          remote_policy: string | null
          require_sponsorship: boolean | null
          safe_mode: boolean | null
          search_intent: string | null
          sms_alerts_enabled: boolean | null
          target_roles: string[] | null
          tracker_view: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aggressiveness?: number | null
          alert_frequency?: string | null
          auto_apply_enabled?: boolean
          auto_apply_min_match_score?: number
          created_at?: string
          email_alerts_enabled?: boolean | null
          experience_level?: string | null
          has_clearance?: boolean | null
          id?: string
          locations?: string[] | null
          min_salary_usd?: number | null
          notice_period_days?: number | null
          remote_policy?: string | null
          require_sponsorship?: boolean | null
          safe_mode?: boolean | null
          search_intent?: string | null
          sms_alerts_enabled?: boolean | null
          target_roles?: string[] | null
          tracker_view?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aggressiveness?: number | null
          alert_frequency?: string | null
          auto_apply_enabled?: boolean
          auto_apply_min_match_score?: number
          created_at?: string
          email_alerts_enabled?: boolean | null
          experience_level?: string | null
          has_clearance?: boolean | null
          id?: string
          locations?: string[] | null
          min_salary_usd?: number | null
          notice_period_days?: number | null
          remote_policy?: string | null
          require_sponsorship?: boolean | null
          safe_mode?: boolean | null
          search_intent?: string | null
          sms_alerts_enabled?: boolean | null
          target_roles?: string[] | null
          tracker_view?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_function_name: string
          p_max_requests: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      get_platform_analytics: { Args: never; Returns: Json }
      is_platform_admin: { Args: never; Returns: boolean }
      is_root_admin: { Args: never; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
