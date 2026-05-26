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
      ad_stats: {
        Row: {
          bookings_attributed: number | null
          budget_spent: number | null
          campaign_name: string | null
          channel: string
          clicks: number | null
          created_at: string | null
          id: string
          impressions: number | null
          leads_generated: number | null
          notes: string | null
          period_end: string
          period_start: string
          revenue_generated: number | null
        }
        Insert: {
          bookings_attributed?: number | null
          budget_spent?: number | null
          campaign_name?: string | null
          channel: string
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          leads_generated?: number | null
          notes?: string | null
          period_end: string
          period_start: string
          revenue_generated?: number | null
        }
        Update: {
          bookings_attributed?: number | null
          budget_spent?: number | null
          campaign_name?: string | null
          channel?: string
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          leads_generated?: number | null
          notes?: string | null
          period_end?: string
          period_start?: string
          revenue_generated?: number | null
        }
        Relationships: []
      }
      agent_config: {
        Row: {
          auto_followup_enabled: boolean | null
          business_hours: Json | null
          faq: Json | null
          id: string
          max_followups: number | null
          morning_discount_percent: number | null
          offers: Json
          options: Json
          updated_at: string | null
          weekend_nuit_prestige_contact: string | null
        }
        Insert: {
          auto_followup_enabled?: boolean | null
          business_hours?: Json | null
          faq?: Json | null
          id?: string
          max_followups?: number | null
          morning_discount_percent?: number | null
          offers: Json
          options: Json
          updated_at?: string | null
          weekend_nuit_prestige_contact?: string | null
        }
        Update: {
          auto_followup_enabled?: boolean | null
          business_hours?: Json | null
          faq?: Json | null
          id?: string
          max_followups?: number | null
          morning_discount_percent?: number | null
          offers?: Json
          options?: Json
          updated_at?: string | null
          weekend_nuit_prestige_contact?: string | null
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          created_at: string | null
          date: string
          end_time: string | null
          google_calendar_event_id: string | null
          id: string
          notes: string | null
          reason: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          balance_due: number | null
          balance_due_date: string | null
          booking_type: string | null
          costs: number | null
          created_at: string | null
          customer_id: string | null
          date: string
          deposit_amount: number | null
          deposit_paid: boolean | null
          duration_hours: number | null
          end_time: string | null
          google_calendar_event_id: string | null
          id: string
          lead_id: string | null
          net_margin: number | null
          notes: string | null
          offer_name: string | null
          options: Json | null
          party_size: number | null
          payment_method: string | null
          reminder_sent: boolean | null
          review_received: boolean | null
          review_requested: boolean | null
          source_channel: string | null
          start_time: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          balance_due?: number | null
          balance_due_date?: string | null
          booking_type?: string | null
          costs?: number | null
          created_at?: string | null
          customer_id?: string | null
          date: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          duration_hours?: number | null
          end_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string | null
          net_margin?: number | null
          notes?: string | null
          offer_name?: string | null
          options?: Json | null
          party_size?: number | null
          payment_method?: string | null
          reminder_sent?: boolean | null
          review_received?: boolean | null
          review_requested?: boolean | null
          source_channel?: string | null
          start_time?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          balance_due?: number | null
          balance_due_date?: string | null
          booking_type?: string | null
          costs?: number | null
          created_at?: string | null
          customer_id?: string | null
          date?: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          duration_hours?: number | null
          end_time?: string | null
          google_calendar_event_id?: string | null
          id?: string
          lead_id?: string | null
          net_margin?: number | null
          notes?: string | null
          offer_name?: string | null
          options?: Json | null
          party_size?: number | null
          payment_method?: string | null
          reminder_sent?: boolean | null
          review_received?: boolean | null
          review_requested?: boolean | null
          source_channel?: string | null
          start_time?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      content_marketing: {
        Row: {
          channel: string
          comments: number | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          leads_attributed: number | null
          likes: number | null
          notes: string | null
          publish_date: string | null
          publish_time: string | null
          shares: number | null
          status: string | null
          title: string | null
          updated_at: string | null
          url: string | null
          views: number | null
        }
        Insert: {
          channel: string
          comments?: number | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          leads_attributed?: number | null
          likes?: number | null
          notes?: string | null
          publish_date?: string | null
          publish_time?: string | null
          shares?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
          views?: number | null
        }
        Update: {
          channel?: string
          comments?: number | null
          content_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          leads_attributed?: number | null
          likes?: number | null
          notes?: string | null
          publish_date?: string | null
          publish_time?: string | null
          shares?: number | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string | null
          views?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          channel: string | null
          created_at: string | null
          customer_id: string | null
          escalation_reason: string | null
          id: string
          lead_id: string | null
          messages: Json | null
          outcome: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          customer_id?: string | null
          escalation_reason?: string | null
          id?: string
          lead_id?: string | null
          messages?: Json | null
          outcome?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          customer_id?: string | null
          escalation_reason?: string | null
          id?: string
          lead_id?: string | null
          messages?: Json | null
          outcome?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          acquisition_channel: string | null
          ai_memo: string | null
          birthday: string | null
          bookings_count: number | null
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          instagram_handle: string | null
          last_booking_at: string | null
          last_name: string | null
          lead_id: string | null
          member_card_issued: boolean | null
          member_number: number
          member_page_slug: string | null
          phone: string | null
          preferences: Json | null
          referral_code: string | null
          referred_by: string | null
          tier: string | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          acquisition_channel?: string | null
          ai_memo?: string | null
          birthday?: string | null
          bookings_count?: number | null
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          instagram_handle?: string | null
          last_booking_at?: string | null
          last_name?: string | null
          lead_id?: string | null
          member_card_issued?: boolean | null
          member_number?: number
          member_page_slug?: string | null
          phone?: string | null
          preferences?: Json | null
          referral_code?: string | null
          referred_by?: string | null
          tier?: string | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          acquisition_channel?: string | null
          ai_memo?: string | null
          birthday?: string | null
          bookings_count?: number | null
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          instagram_handle?: string | null
          last_booking_at?: string | null
          last_name?: string | null
          lead_id?: string | null
          member_card_issued?: boolean | null
          member_number?: number
          member_page_slug?: string | null
          phone?: string | null
          preferences?: Json | null
          referral_code?: string | null
          referred_by?: string | null
          tier?: string | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookings: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email: string | null
          event_id: string | null
          first_name: string
          id: string
          is_member_priority: boolean | null
          last_name: string | null
          party_size: number | null
          payment_status: string | null
          phone: string | null
          sumup_transaction_id: string | null
          total_paid: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          event_id?: string | null
          first_name: string
          id?: string
          is_member_priority?: boolean | null
          last_name?: string | null
          party_size?: number | null
          payment_status?: string | null
          phone?: string | null
          sumup_transaction_id?: string | null
          total_paid?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          event_id?: string | null
          first_name?: string
          id?: string
          is_member_priority?: boolean | null
          last_name?: string | null
          party_size?: number | null
          payment_status?: string | null
          phone?: string | null
          sumup_transaction_id?: string | null
          total_paid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events_public: {
        Row: {
          cost_estimate: number | null
          created_at: string | null
          current_bookings: number | null
          date: string
          description: string | null
          end_time: string | null
          id: string
          max_participants: number | null
          net_margin: number | null
          price_per_person: number | null
          start_time: string | null
          status: string | null
          sumup_payment_link: string | null
          theme: string | null
          title: string
          total_revenue: number | null
          updated_at: string | null
          whatsapp_message_template: string | null
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string | null
          current_bookings?: number | null
          date: string
          description?: string | null
          end_time?: string | null
          id?: string
          max_participants?: number | null
          net_margin?: number | null
          price_per_person?: number | null
          start_time?: string | null
          status?: string | null
          sumup_payment_link?: string | null
          theme?: string | null
          title: string
          total_revenue?: number | null
          updated_at?: string | null
          whatsapp_message_template?: string | null
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string | null
          current_bookings?: number | null
          date?: string
          description?: string | null
          end_time?: string | null
          id?: string
          max_participants?: number | null
          net_margin?: number | null
          price_per_person?: number | null
          start_time?: string | null
          status?: string | null
          sumup_payment_link?: string | null
          theme?: string | null
          title?: string
          total_revenue?: number | null
          updated_at?: string | null
          whatsapp_message_template?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          linked_booking_id: string | null
          linked_event_id: string | null
          receipt_url: string | null
          recurrence_period: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          linked_booking_id?: string | null
          linked_event_id?: string | null
          receipt_url?: string | null
          recurrence_period?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          linked_booking_id?: string | null
          linked_event_id?: string | null
          receipt_url?: string | null
          recurrence_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_linked_booking_id_fkey"
            columns: ["linked_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          current_revenue: number | null
          id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          period_type: string | null
          target_medium: number | null
          target_min: number | null
          target_strong: number | null
        }
        Insert: {
          created_at?: string | null
          current_revenue?: number | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          target_medium?: number | null
          target_min?: number | null
          target_strong?: number | null
        }
        Update: {
          created_at?: string | null
          current_revenue?: number | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          target_medium?: number | null
          target_min?: number | null
          target_strong?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          ai_memo: string | null
          assigned_to: string | null
          budget_range: string | null
          created_at: string | null
          desired_date: string | null
          desired_time_slot: string | null
          email: string | null
          first_name: string | null
          followup_count: number | null
          id: string
          instagram_handle: string | null
          interested_offer: string | null
          last_interaction_at: string | null
          last_name: string | null
          needs_human_intervention: boolean | null
          notes: string | null
          party_size: number | null
          phone: string | null
          score: number | null
          source_channel: string | null
          source_status: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_memo?: string | null
          assigned_to?: string | null
          budget_range?: string | null
          created_at?: string | null
          desired_date?: string | null
          desired_time_slot?: string | null
          email?: string | null
          first_name?: string | null
          followup_count?: number | null
          id?: string
          instagram_handle?: string | null
          interested_offer?: string | null
          last_interaction_at?: string | null
          last_name?: string | null
          needs_human_intervention?: boolean | null
          notes?: string | null
          party_size?: number | null
          phone?: string | null
          score?: number | null
          source_channel?: string | null
          source_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_memo?: string | null
          assigned_to?: string | null
          budget_range?: string | null
          created_at?: string | null
          desired_date?: string | null
          desired_time_slot?: string | null
          email?: string | null
          first_name?: string | null
          followup_count?: number | null
          id?: string
          instagram_handle?: string | null
          interested_offer?: string | null
          last_interaction_at?: string | null
          last_name?: string | null
          needs_human_intervention?: boolean | null
          notes?: string | null
          party_size?: number | null
          phone?: string | null
          score?: number | null
          source_channel?: string | null
          source_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          notification_preferences: Json | null
          permissions: Json | null
          role: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          notification_preferences?: Json | null
          permissions?: Json | null
          role?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          notification_preferences?: Json | null
          permissions?: Json | null
          role?: string | null
        }
        Relationships: []
      }
      recaps: {
        Row: {
          content: string | null
          created_at: string | null
          data: Json | null
          id: string
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          type?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: string
          referred_customer_id: string | null
          referred_lead_id: string | null
          referrer_customer_id: string | null
          reward_chosen: string | null
          reward_used: boolean | null
          status: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referred_customer_id?: string | null
          referred_lead_id?: string | null
          referrer_customer_id?: string | null
          reward_chosen?: string | null
          reward_used?: boolean | null
          status?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: string
          referred_customer_id?: string | null
          referred_lead_id?: string | null
          referrer_customer_id?: string | null
          reward_chosen?: string | null
          reward_used?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_lead_id_fkey"
            columns: ["referred_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          date: string
          fetched_at: string | null
          id: string
          rating: string | null
          swell_m: number | null
          water_temp_c: number | null
          wave_height_m: number | null
          wind_direction: string | null
          wind_speed_kmh: number | null
        }
        Insert: {
          date: string
          fetched_at?: string | null
          id?: string
          rating?: string | null
          swell_m?: number | null
          water_temp_c?: number | null
          wave_height_m?: number | null
          wind_direction?: string | null
          wind_speed_kmh?: number | null
        }
        Update: {
          date?: string
          fetched_at?: string | null
          id?: string
          rating?: string | null
          swell_m?: number | null
          water_temp_c?: number | null
          wave_height_m?: number | null
          wind_direction?: string | null
          wind_speed_kmh?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
