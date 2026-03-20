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
      accessibility_requests: {
        Row: {
          accommodation_details: string
          candidate_id: string | null
          created_at: string | null
          employer_response: string | null
          id: string
          job_application_id: string | null
          request_type: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accommodation_details: string
          candidate_id?: string | null
          created_at?: string | null
          employer_response?: string | null
          id?: string
          job_application_id?: string | null
          request_type: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accommodation_details?: string
          candidate_id?: string | null
          created_at?: string | null
          employer_response?: string | null
          id?: string
          job_application_id?: string | null
          request_type?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
          accessibility_accommodations: string[] | null
          age: number | null
          created_at: string
          dei_preferences: Json | null
          disability_status: string | null
          education: Json
          ethnicity: string[] | null
          experience_atoms: Json
          first_generation_college: boolean | null
          gender: string | null
          id: string
          identity: Json
          primary_language: string | null
          privacy_settings: Json | null
          pronouns: string | null
          raw_resume_text: string | null
          religious_accommodations: string[] | null
          resume_file_url: string | null
          skills: Json
          socioeconomic_background: string | null
          updated_at: string
          user_id: string
          veteran_status: boolean | null
          visa_sponsorship_required: boolean | null
        }
        Insert: {
          accessibility_accommodations?: string[] | null
          age?: number | null
          created_at?: string
          dei_preferences?: Json | null
          disability_status?: string | null
          education?: Json
          ethnicity?: string[] | null
          experience_atoms?: Json
          first_generation_college?: boolean | null
          gender?: string | null
          id?: string
          identity?: Json
          primary_language?: string | null
          privacy_settings?: Json | null
          pronouns?: string | null
          raw_resume_text?: string | null
          religious_accommodations?: string[] | null
          resume_file_url?: string | null
          skills?: Json
          socioeconomic_background?: string | null
          updated_at?: string
          user_id: string
          veteran_status?: boolean | null
          visa_sponsorship_required?: boolean | null
        }
        Update: {
          accessibility_accommodations?: string[] | null
          age?: number | null
          created_at?: string
          dei_preferences?: Json | null
          disability_status?: string | null
          education?: Json
          ethnicity?: string[] | null
          experience_atoms?: Json
          first_generation_college?: boolean | null
          gender?: string | null
          id?: string
          identity?: Json
          primary_language?: string | null
          privacy_settings?: Json | null
          pronouns?: string | null
          raw_resume_text?: string | null
          religious_accommodations?: string[] | null
          resume_file_url?: string | null
          skills?: Json
          socioeconomic_background?: string | null
          updated_at?: string
          user_id?: string
          veteran_status?: boolean | null
          visa_sponsorship_required?: boolean | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          name: string
          size_range: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          name: string
          size_range?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          name?: string
          size_range?: string | null
          updated_at?: string | null
          website?: string | null
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
      diversity_metrics: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          metric_category: string
          metric_name: string
          metric_value: number | null
          reporting_period: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          metric_category: string
          metric_name: string
          metric_value?: number | null
          reporting_period: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          metric_category?: string
          metric_name?: string
          metric_value?: number | null
          reporting_period?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diversity_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dropdown_options: {
        Row: {
          category: string
          created_at: string | null
          display_text: string
          id: string
          option_value: string
          sort_order: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          display_text: string
          id?: string
          option_value: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          display_text?: string
          id?: string
          option_value?: string
          sort_order?: number | null
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
      job_applications: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      job_listings: {
        Row: {
          accessibility_support: string[] | null
          accommodation_statement: string | null
          company: string
          created_at: string
          credibility_score: number | null
          dei_commitment: string | null
          description: string | null
          diversity_rating: number | null
          eeo_statement: string | null
          experience_level: string | null
          freshness_score: number | null
          id: string
          inclusive_benefits: string[] | null
          job_hash: string
          job_type: string | null
          location: string | null
          mentorship_programs: boolean | null
          pay_equity_certified: boolean | null
          posted_at: string | null
          preferred_pronouns_respected: boolean | null
          raw_data: Json | null
          remote: boolean | null
          remote_work_accessibility: boolean | null
          salary_max: number | null
          salary_min: number | null
          salary_range: string | null
          source: string
          tech_stack: string[] | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          accessibility_support?: string[] | null
          accommodation_statement?: string | null
          company: string
          created_at?: string
          credibility_score?: number | null
          dei_commitment?: string | null
          description?: string | null
          diversity_rating?: number | null
          eeo_statement?: string | null
          experience_level?: string | null
          freshness_score?: number | null
          id?: string
          inclusive_benefits?: string[] | null
          job_hash: string
          job_type?: string | null
          location?: string | null
          mentorship_programs?: boolean | null
          pay_equity_certified?: boolean | null
          posted_at?: string | null
          preferred_pronouns_respected?: boolean | null
          raw_data?: Json | null
          remote?: boolean | null
          remote_work_accessibility?: boolean | null
          salary_max?: number | null
          salary_min?: number | null
          salary_range?: string | null
          source?: string
          tech_stack?: string[] | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          accessibility_support?: string[] | null
          accommodation_statement?: string | null
          company?: string
          created_at?: string
          credibility_score?: number | null
          dei_commitment?: string | null
          description?: string | null
          diversity_rating?: number | null
          eeo_statement?: string | null
          experience_level?: string | null
          freshness_score?: number | null
          id?: string
          inclusive_benefits?: string[] | null
          job_hash?: string
          job_type?: string | null
          location?: string | null
          mentorship_programs?: boolean | null
          pay_equity_certified?: boolean | null
          posted_at?: string | null
          preferred_pronouns_respected?: boolean | null
          raw_data?: Json | null
          remote?: boolean | null
          remote_work_accessibility?: boolean | null
          salary_max?: number | null
          salary_min?: number | null
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
      notification_history: {
        Row: {
          clicked_at: string | null
          email_subject: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          sent_to: string
          type: string
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          clicked_at?: string | null
          email_subject?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          sent_to: string
          type: string
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          clicked_at?: string | null
          email_subject?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          sent_to?: string
          type?: string
          unsubscribed_at?: string | null
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
      notification_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          data: Json
          error_message: string | null
          id: string
          max_attempts: number | null
          priority: string
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          data?: Json
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          data?: Json
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      overage_purchases: {
        Row: {
          created_at: string | null
          expires_at: string | null
          feature_name: string
          id: string
          quantity: number
          status: string
          stripe_payment_intent_id: string | null
          total_amount: number
          unit_price: number
          updated_at: string | null
          used_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          feature_name: string
          id?: string
          quantity: number
          status?: string
          stripe_payment_intent_id?: string | null
          total_amount: number
          unit_price: number
          updated_at?: string | null
          used_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          feature_name?: string
          id?: string
          quantity?: number
          status?: string
          stripe_payment_intent_id?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
          used_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      paystack_webhooks: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          paystack_event_id: string | null
          processed: boolean | null
          processed_at: string | null
          webhook_data: Json
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          paystack_event_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          webhook_data: Json
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          paystack_event_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          webhook_data?: Json
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
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          feature_limits: Json
          id: string
          is_active: boolean | null
          name: string
          overage_rates: Json
          paystack_plan_code: string | null
          paystack_plan_code_yearly: string | null
          price_monthly: number
          price_monthly_ngn: number | null
          price_yearly: number
          price_yearly_ngn: number | null
          sort_order: number | null
          stripe_price_id: string | null
          stripe_price_id_yearly: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          feature_limits?: Json
          id?: string
          is_active?: boolean | null
          name: string
          overage_rates?: Json
          paystack_plan_code?: string | null
          paystack_plan_code_yearly?: string | null
          price_monthly?: number
          price_monthly_ngn?: number | null
          price_yearly?: number
          price_yearly_ngn?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          feature_limits?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          overage_rates?: Json
          paystack_plan_code?: string | null
          paystack_plan_code_yearly?: string | null
          price_monthly?: number
          price_monthly_ngn?: number | null
          price_yearly?: number
          price_yearly_ngn?: number | null
          sort_order?: number | null
          stripe_price_id?: string | null
          stripe_price_id_yearly?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_usage: {
        Row: {
          created_at: string | null
          feature_name: string
          id: string
          period_end: string
          period_start: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_name: string
          id?: string
          period_end: string
          period_start: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_name?: string
          id?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          feature_limits: Json | null
          id: string
          payment_provider: string | null
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
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
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          feature_limits?: Json | null
          id?: string
          payment_provider?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
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
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          feature_limits?: Json | null
          id?: string
          payment_provider?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
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
      subscriptions_backup: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string | null
          payment_provider: string | null
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          payment_provider?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          payment_provider?: string | null
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      usage_alerts: {
        Row: {
          acknowledged: boolean | null
          alert_threshold: number
          alert_type: string
          created_at: string | null
          feature_name: string
          id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          alert_threshold: number
          alert_type: string
          created_at?: string | null
          feature_name: string
          id?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          alert_threshold?: number
          alert_type?: string
          created_at?: string | null
          feature_name?: string
          id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          created_at: string | null
          feature_name: string
          id: string
          metadata: Json | null
          period_end: string
          period_start: string
          updated_at: string | null
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature_name: string
          id?: string
          metadata?: Json | null
          period_end: string
          period_start: string
          updated_at?: string | null
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature_name?: string
          id?: string
          metadata?: Json | null
          period_end?: string
          period_start?: string
          updated_at?: string | null
          usage_count?: number
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
          notification_settings: Json | null
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
          notification_settings?: Json | null
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
          notification_settings?: Json | null
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
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end: string
          current_period_start?: string
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions_backup: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string | null
          plan_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      check_feature_access: {
        Args: { p_feature_name: string; p_user_id: string }
        Returns: {
          can_use: boolean
          currency: string
          current_usage: number
          limit_amount: number
          overage_cost: number
          overage_needed: number
          remaining_amount: number
          subscription_plan: string
        }[]
      }
      check_feature_usage_limit: {
        Args: {
          p_feature_name: string
          p_requested_count?: number
          p_user_id: string
        }
        Returns: {
          can_use: boolean
          current_usage: number
          limit_amount: number
          remaining_amount: number
        }[]
      }
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
      get_current_usage: {
        Args: {
          p_feature_name: string
          p_period_start?: string
          p_user_id: string
        }
        Returns: number
      }
      get_feature_usage: {
        Args: { p_feature_name: string; p_user_id: string }
        Returns: number
      }
      get_notification_preferences: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_overage_rate: {
        Args: { p_feature_name: string; p_user_id: string }
        Returns: number
      }
      get_payment_provider_for_user: {
        Args: { p_user_country?: string; p_user_id: string }
        Returns: {
          currency: string
          monthly_price: number
          provider: string
          yearly_price: number
        }[]
      }
      get_platform_analytics: { Args: never; Returns: Json }
      get_usage_overview: {
        Args: { p_user_id: string }
        Returns: {
          billing_period_end: string
          billing_period_start: string
          can_use: boolean
          current_usage: number
          display_name: string
          feature_name: string
          limit_amount: number
          overage_credits: number
          plan_display_name: string
          plan_name: string
          remaining_amount: number
          usage_percentage: number
        }[]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_root_admin: { Args: never; Returns: boolean }
      match_dei_preferences: {
        Args: { candidate_profile_id: string; job_listing_id: string }
        Returns: number
      }
      purchase_overage_credits: {
        Args: {
          p_feature_name: string
          p_payment_intent_id: string
          p_quantity: number
          p_user_id: string
        }
        Returns: string
      }
      record_feature_usage: {
        Args: {
          p_feature_name: string
          p_metadata?: Json
          p_usage_count?: number
          p_user_id: string
        }
        Returns: boolean
      }
      schedule_notification: {
        Args: {
          p_data?: Json
          p_priority?: string
          p_scheduled_for?: string
          p_type: string
          p_user_id: string
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
  public: {
    Enums: {},
  },
} as const
