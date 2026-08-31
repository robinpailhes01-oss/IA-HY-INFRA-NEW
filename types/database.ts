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
      agent_config_history: {
        Row: {
          applied_at: string
          column_name: string
          description: string
          id: string
          key_name: string | null
          new_value: Json
          old_value: Json | null
          source: string
        }
        Insert: {
          applied_at?: string
          column_name: string
          description: string
          id?: string
          key_name?: string | null
          new_value: Json
          old_value?: Json | null
          source?: string
        }
        Update: {
          applied_at?: string
          column_name?: string
          description?: string
          id?: string
          key_name?: string | null
          new_value?: Json
          old_value?: Json | null
          source?: string
        }
        Relationships: []
      }
      agent_config_pending_changes: {
        Row: {
          chat_id: string
          column_name: string
          created_at: string
          description: string
          id: string
          key_name: string | null
          new_value: Json
          old_value: Json | null
          status: string
        }
        Insert: {
          chat_id: string
          column_name: string
          created_at?: string
          description: string
          id?: string
          key_name?: string | null
          new_value: Json
          old_value?: Json | null
          status?: string
        }
        Update: {
          chat_id?: string
          column_name?: string
          created_at?: string
          description?: string
          id?: string
          key_name?: string | null
          new_value?: Json
          old_value?: Json | null
          status?: string
        }
        Relationships: []
      }
      analytics_daily_snapshots: {
        Row: {
          created_at: string
          id: string
          pageviews: number
          snapshot_date: string
          top_pages: Json
          top_referrers: Json
          updated_at: string
          vercel_project_id: string
          visitors: number
        }
        Insert: {
          created_at?: string
          id?: string
          pageviews?: number
          snapshot_date: string
          top_pages?: Json
          top_referrers?: Json
          updated_at?: string
          vercel_project_id: string
          visitors?: number
        }
        Update: {
          created_at?: string
          id?: string
          pageviews?: number
          snapshot_date?: string
          top_pages?: Json
          top_referrers?: Json
          updated_at?: string
          vercel_project_id?: string
          visitors?: number
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          authorized_balance_cents: number
          balance_cents: number
          balance_updated_at: string | null
          created_at: string
          currency: string
          iban: string | null
          id: string
          is_main: boolean
          name: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          authorized_balance_cents?: number
          balance_cents?: number
          balance_updated_at?: string | null
          created_at?: string
          currency?: string
          iban?: string | null
          id: string
          is_main?: boolean
          name?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          authorized_balance_cents?: number
          balance_cents?: number
          balance_updated_at?: string | null
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          is_main?: boolean
          name?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount_cents: number
          bank_account_id: string | null
          cashflow_category: string | null
          counterparty_name: string | null
          created_at: string
          currency: string
          emitted_at: string | null
          id: string
          label: string | null
          note: string | null
          operation_type: string | null
          qonto_category: string | null
          qonto_id: string
          qonto_updated_at: string | null
          raw: Json
          reference: string | null
          settled_at: string | null
          side: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          bank_account_id?: string | null
          cashflow_category?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          emitted_at?: string | null
          id?: string
          label?: string | null
          note?: string | null
          operation_type?: string | null
          qonto_category?: string | null
          qonto_id: string
          qonto_updated_at?: string | null
          raw?: Json
          reference?: string | null
          settled_at?: string | null
          side: string
          status: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          bank_account_id?: string | null
          cashflow_category?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          emitted_at?: string | null
          id?: string
          label?: string | null
          note?: string | null
          operation_type?: string | null
          qonto_category?: string | null
          qonto_id?: string
          qonto_updated_at?: string | null
          raw?: Json
          reference?: string | null
          settled_at?: string | null
          side?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          balance_payments: Json
          booking_type: string | null
          contract_signed_at: string | null
          contract_signed_by_name: string | null
          costs: number | null
          created_at: string | null
          customer_id: string | null
          date: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          discount_amount: number | null
          discount_reason: string | null
          duration_hours: number | null
          end_time: string | null
          gift_card_code: string | null
          gift_card_recipient_name: string | null
          google_calendar_event_id: string | null
          id: string
          is_gift_card: boolean
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
          stripe_session_id: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          balance_due?: number | null
          balance_due_date?: string | null
          balance_payments?: Json
          booking_type?: string | null
          contract_signed_at?: string | null
          contract_signed_by_name?: string | null
          costs?: number | null
          created_at?: string | null
          customer_id?: string | null
          date?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          discount_amount?: number | null
          discount_reason?: string | null
          duration_hours?: number | null
          end_time?: string | null
          gift_card_code?: string | null
          gift_card_recipient_name?: string | null
          google_calendar_event_id?: string | null
          id?: string
          is_gift_card?: boolean
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
          stripe_session_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          balance_due?: number | null
          balance_due_date?: string | null
          balance_payments?: Json
          booking_type?: string | null
          contract_signed_at?: string | null
          contract_signed_by_name?: string | null
          costs?: number | null
          created_at?: string | null
          customer_id?: string | null
          date?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          discount_amount?: number | null
          discount_reason?: string | null
          duration_hours?: number | null
          end_time?: string | null
          gift_card_code?: string | null
          gift_card_recipient_name?: string | null
          google_calendar_event_id?: string | null
          id?: string
          is_gift_card?: boolean
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
          stripe_session_id?: string | null
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
      client_outreach: {
        Row: {
          campaign: string
          created_at: string
          email_body_html: string | null
          email_subject: string | null
          error: string | null
          id: string
          legacy_client_id: string
          provider: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign: string
          created_at?: string
          email_body_html?: string | null
          email_subject?: string | null
          error?: string | null
          id?: string
          legacy_client_id: string
          provider?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign?: string
          created_at?: string
          email_body_html?: string | null
          email_subject?: string | null
          error?: string | null
          id?: string
          legacy_client_id?: string
          provider?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_outreach_legacy_client_id_fkey"
            columns: ["legacy_client_id"]
            isOneToOne: false
            referencedRelation: "legacy_clients"
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
      email_log: {
        Row: {
          id: string
          lead_id: string | null
          sent_at: string
          source: string
          subject: string | null
          to_email: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          sent_at?: string
          source: string
          subject?: string | null
          to_email: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          sent_at?: string
          source?: string
          subject?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          conversation_id: string
          created_at: string
          from_email: string
          id: string
          last_outbound_message_id: string | null
          lead_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_email: string
          id?: string
          last_outbound_message_id?: string | null
          lead_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_email?: string
          id?: string
          last_outbound_message_id?: string | null
          lead_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          email: string
          source_campaign: string | null
          unsubscribed_at: string
        }
        Insert: {
          email: string
          source_campaign?: string | null
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          source_campaign?: string | null
          unsubscribed_at?: string
        }
        Relationships: []
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
          google_calendar_event_id: string | null
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
          google_calendar_event_id?: string | null
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
          google_calendar_event_id?: string | null
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
          bank_transaction_id: string | null
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
          bank_transaction_id?: string | null
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
          bank_transaction_id?: string | null
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
            foreignKeyName: "expenses_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
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
      hub_agent_activities: {
        Row: {
          agent_id: string
          conversation_id: string | null
          description: string
          id: string
          metadata: Json
          occurred_at: string
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          conversation_id?: string | null
          description?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          conversation_id?: string | null
          description?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_agent_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hub_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_agent_activities_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hub_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_agent_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_agent_channels: {
        Row: {
          agent_id: string
          channel_connection_id: string
          is_active: boolean
        }
        Insert: {
          agent_id: string
          channel_connection_id: string
          is_active?: boolean
        }
        Update: {
          agent_id?: string
          channel_connection_id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hub_agent_channels_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hub_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_agent_channels_channel_connection_id_fkey"
            columns: ["channel_connection_id"]
            isOneToOne: false
            referencedRelation: "hub_channel_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_agents: {
        Row: {
          avatar_color: string
          created_at: string
          hermes_agent_id: string | null
          id: string
          model_config: Json
          name: string
          persona: string
          role: string
          slug: string
          status: string
          system_prompt: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          hermes_agent_id?: string | null
          id?: string
          model_config?: Json
          name: string
          persona?: string
          role?: string
          slug: string
          status?: string
          system_prompt?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          hermes_agent_id?: string | null
          id?: string
          model_config?: Json
          name?: string
          persona?: string
          role?: string
          slug?: string
          status?: string
          system_prompt?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_channel_connections: {
        Row: {
          created_at: string
          credentials: Json
          display_name: string
          id: string
          last_connected_at: string | null
          metadata: Json
          status: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          last_connected_at?: string | null
          metadata?: Json
          status?: string
          type: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          display_name?: string
          id?: string
          last_connected_at?: string | null
          metadata?: Json
          status?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_channel_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_contacts: {
        Row: {
          channel_type: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string
          primary_handle: string
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          channel_type: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string
          primary_handle: string
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string
          primary_handle?: string
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_conversations: {
        Row: {
          agent_id: string | null
          channel_connection_id: string | null
          channel_type: string
          contact_handle: string
          contact_id: string | null
          contact_name: string
          created_at: string
          crm_stage: string
          crm_summary: string
          id: string
          last_message_at: string
          message_count: number
          outcome: string | null
          status: string
          subject: string
          tags: string[]
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          channel_connection_id?: string | null
          channel_type: string
          contact_handle?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          crm_stage?: string
          crm_summary?: string
          id?: string
          last_message_at?: string
          message_count?: number
          outcome?: string | null
          status?: string
          subject?: string
          tags?: string[]
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          channel_connection_id?: string | null
          channel_type?: string
          contact_handle?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          crm_stage?: string
          crm_summary?: string
          id?: string
          last_message_at?: string
          message_count?: number
          outcome?: string | null
          status?: string
          subject?: string
          tags?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hub_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_conversations_channel_connection_id_fkey"
            columns: ["channel_connection_id"]
            isOneToOne: false
            referencedRelation: "hub_channel_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hub_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_credit_ledger: {
        Row: {
          agent_id: string
          channel_type: string
          conversation_id: string | null
          credits: number
          event_type: string
          id: string
          occurred_at: string
          tokens_input: number
          tokens_output: number
          workspace_id: string
        }
        Insert: {
          agent_id: string
          channel_type: string
          conversation_id?: string | null
          credits: number
          event_type: string
          id?: string
          occurred_at?: string
          tokens_input?: number
          tokens_output?: number
          workspace_id: string
        }
        Update: {
          agent_id?: string
          channel_type?: string
          conversation_id?: string | null
          credits?: number
          event_type?: string
          id?: string
          occurred_at?: string
          tokens_input?: number
          tokens_output?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_credit_ledger_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hub_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_credit_ledger_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hub_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_messages: {
        Row: {
          content: string
          content_type: string
          conversation_id: string
          direction: string
          id: string
          metadata: Json
          sender: string
          sent_at: string
        }
        Insert: {
          content: string
          content_type?: string
          conversation_id: string
          direction: string
          id?: string
          metadata?: Json
          sender: string
          sent_at?: string
        }
        Update: {
          content?: string
          content_type?: string
          conversation_id?: string
          direction?: string
          id?: string
          metadata?: Json
          sender?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "hub_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_settings: {
        Row: {
          id: string
          key: string
          value: Json
          workspace_id: string
        }
        Insert: {
          id?: string
          key: string
          value?: Json
          workspace_id: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_workspaces: {
        Row: {
          created_at: string
          credit_balance: number
          id: string
          name: string
          plan: string
        }
        Insert: {
          created_at?: string
          credit_balance?: number
          id?: string
          name: string
          plan?: string
        }
        Update: {
          created_at?: string
          credit_balance?: number
          id?: string
          name?: string
          plan?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ai_memo: string | null
          archived: boolean
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
          last_followup_at: string | null
          last_interaction_at: string | null
          last_name: string | null
          needs_human_intervention: boolean | null
          notes: string | null
          occasion: string | null
          party_size: number | null
          phone: string | null
          real_phone: string | null
          score: number | null
          source_channel: string | null
          source_status: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_memo?: string | null
          archived?: boolean
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
          last_followup_at?: string | null
          last_interaction_at?: string | null
          last_name?: string | null
          needs_human_intervention?: boolean | null
          notes?: string | null
          occasion?: string | null
          party_size?: number | null
          phone?: string | null
          real_phone?: string | null
          score?: number | null
          source_channel?: string | null
          source_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_memo?: string | null
          archived?: boolean
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
          last_followup_at?: string | null
          last_interaction_at?: string | null
          last_name?: string | null
          needs_human_intervention?: boolean | null
          notes?: string | null
          occasion?: string | null
          party_size?: number | null
          phone?: string | null
          real_phone?: string | null
          score?: number | null
          source_channel?: string | null
          source_status?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      legacy_clients: {
        Row: {
          created_at: string
          email: string | null
          event_date: string | null
          event_year: number | null
          first_name: string | null
          ics_uid: string
          id: string
          last_name: string | null
          offer_summary: string | null
          phone: string | null
          raw_description: string | null
          source_file: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_year?: number | null
          first_name?: string | null
          ics_uid: string
          id?: string
          last_name?: string | null
          offer_summary?: string | null
          phone?: string | null
          raw_description?: string | null
          source_file?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_year?: number | null
          first_name?: string | null
          ics_uid?: string
          id?: string
          last_name?: string | null
          offer_summary?: string | null
          phone?: string | null
          raw_description?: string | null
          source_file?: string | null
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
      prospects: {
        Row: {
          adresse: string
          aides_totales: number | null
          co2_evite_kg_an: number | null
          code_postal: string | null
          cout_installation_ttc: number | null
          created_at: string
          date_photo_satellite: string | null
          economie_annuelle: number | null
          email: string | null
          heures_ensoleillement: number | null
          id: string
          latitude: number | null
          longitude: number | null
          nb_panneaux_recommande: number | null
          nom: string
          notes: string | null
          orientation_principale: string | null
          panneaux_detectes: string | null
          prenom: string
          production_annuelle_kwh: number | null
          proposition_html: string | null
          proposition_id: string | null
          proposition_vue_at: string | null
          puissance_kwc: number | null
          qualite_imagerie: string | null
          reste_a_charge: number | null
          score_solaire: number | null
          site_web: string | null
          statut: Database["public"]["Enums"]["prospect_statut"]
          surface_toit_m2: number | null
          telephone: string | null
          temps_retour_ans: number | null
          updated_at: string
          ville: string
        }
        Insert: {
          adresse: string
          aides_totales?: number | null
          co2_evite_kg_an?: number | null
          code_postal?: string | null
          cout_installation_ttc?: number | null
          created_at?: string
          date_photo_satellite?: string | null
          economie_annuelle?: number | null
          email?: string | null
          heures_ensoleillement?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nb_panneaux_recommande?: number | null
          nom: string
          notes?: string | null
          orientation_principale?: string | null
          panneaux_detectes?: string | null
          prenom: string
          production_annuelle_kwh?: number | null
          proposition_html?: string | null
          proposition_id?: string | null
          proposition_vue_at?: string | null
          puissance_kwc?: number | null
          qualite_imagerie?: string | null
          reste_a_charge?: number | null
          score_solaire?: number | null
          site_web?: string | null
          statut?: Database["public"]["Enums"]["prospect_statut"]
          surface_toit_m2?: number | null
          telephone?: string | null
          temps_retour_ans?: number | null
          updated_at?: string
          ville: string
        }
        Update: {
          adresse?: string
          aides_totales?: number | null
          co2_evite_kg_an?: number | null
          code_postal?: string | null
          cout_installation_ttc?: number | null
          created_at?: string
          date_photo_satellite?: string | null
          economie_annuelle?: number | null
          email?: string | null
          heures_ensoleillement?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nb_panneaux_recommande?: number | null
          nom?: string
          notes?: string | null
          orientation_principale?: string | null
          panneaux_detectes?: string | null
          prenom?: string
          production_annuelle_kwh?: number | null
          proposition_html?: string | null
          proposition_id?: string | null
          proposition_vue_at?: string | null
          puissance_kwc?: number | null
          qualite_imagerie?: string | null
          reste_a_charge?: number | null
          score_solaire?: number | null
          site_web?: string | null
          statut?: Database["public"]["Enums"]["prospect_statut"]
          surface_toit_m2?: number | null
          telephone?: string | null
          temps_retour_ans?: number | null
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      qonto_sync_state: {
        Row: {
          id: boolean
          last_error: string | null
          last_run_at: string | null
          last_synced_at: string | null
          transactions_synced: number
        }
        Insert: {
          id?: boolean
          last_error?: string | null
          last_run_at?: string | null
          last_synced_at?: string | null
          transactions_synced?: number
        }
        Update: {
          id?: boolean
          last_error?: string | null
          last_run_at?: string | null
          last_synced_at?: string | null
          transactions_synced?: number
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
      revenues: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          date: string
          id: string
          note: string | null
          payment_kind: string | null
          type: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          note?: string | null
          payment_kind?: string | null
          type: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          payment_kind?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenues_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_audits: {
        Row: {
          checks: Json
          checks_passed: number
          checks_total: number
          created_at: string
          critical_count: number
          duration_ms: number | null
          error: string | null
          id: string
          pages: Json
          run_at: string
          score: number
          site_url: string
          warning_count: number
        }
        Insert: {
          checks?: Json
          checks_passed?: number
          checks_total?: number
          created_at?: string
          critical_count?: number
          duration_ms?: number | null
          error?: string | null
          id?: string
          pages?: Json
          run_at?: string
          score: number
          site_url: string
          warning_count?: number
        }
        Update: {
          checks?: Json
          checks_passed?: number
          checks_total?: number
          created_at?: string
          critical_count?: number
          duration_ms?: number | null
          error?: string | null
          id?: string
          pages?: Json
          run_at?: string
          score?: number
          site_url?: string
          warning_count?: number
        }
        Relationships: []
      }
      telegram_manager_conversations: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          messages: Json
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account: string
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string | null
          source: string
          type: string
        }
        Insert: {
          account?: string
          amount: number
          category: string
          created_at?: string
          date: string
          id: string
          note?: string | null
          source?: string
          type: string
        }
        Update: {
          account?: string
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          source?: string
          type?: string
        }
        Relationships: []
      }
      wa_auth_state: {
        Row: {
          data: Json
          id: string
          updated_at: string | null
        }
        Insert: {
          data: Json
          id: string
          updated_at?: string | null
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      wa_conversations: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string
          id: string
          is_paused: boolean
          last_message_at: string | null
          lead_id: string | null
          paused_until: string | null
          unread_count: number
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone: string
          id?: string
          is_paused?: boolean
          last_message_at?: string | null
          lead_id?: string | null
          paused_until?: string | null
          unread_count?: number
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string
          id?: string
          is_paused?: boolean
          last_message_at?: string | null
          lead_id?: string | null
          paused_until?: string | null
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_inbox: {
        Row: {
          created_at: string
          id: number
          phone: string
          processed_at: string | null
          received_at: string
          text: string
          wa_message_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          phone: string
          processed_at?: string | null
          received_at?: string
          text: string
          wa_message_id: string
        }
        Update: {
          created_at?: string
          id?: number
          phone?: string
          processed_at?: string | null
          received_at?: string
          text?: string
          wa_message_id?: string
        }
        Relationships: []
      }
      wa_lid_map: {
        Row: {
          created_at: string
          lid: string
          phone: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          lid: string
          phone: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          lid?: string
          phone?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_messages: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string | null
          from_me: boolean
          id: string
          is_from_human: boolean
          wa_message_id: string | null
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string | null
          from_me?: boolean
          id?: string
          is_from_human?: boolean
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string | null
          from_me?: boolean
          id?: string
          is_from_human?: boolean
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
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
      dashboard_stats: {
        Row: {
          ca_pipeline: number | null
          ca_signe: number | null
          roi_moyen_ans: number | null
          total_analyses: number | null
          total_propositions: number | null
          total_prospects: number | null
          total_signes: number | null
        }
        Relationships: []
      }
      hub_agent_credit_summary: {
        Row: {
          agent_id: string | null
          credits_30d: number | null
          credits_7d: number | null
          credits_total: number | null
          events_total: number | null
          tokens_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_credit_ledger_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hub_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_credit_daily: {
        Row: {
          agent_id: string | null
          channel_type: string | null
          credits: number | null
          day: string | null
          events: number | null
          tokens: number | null
          tokens_input: number | null
          tokens_output: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_credit_ledger_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "hub_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "hub_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_last_message: {
        Row: {
          last_from_me: boolean | null
          last_is_from_human: boolean | null
          last_message_at: string | null
          lead_id: string | null
          site_link_sent: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_booked_slots: {
        Args: { p_from: string; p_to: string }
        Returns: {
          booking_type: string
          date: string
          end_time: string
          start_time: string
        }[]
      }
      wa_inbox_cleanup: { Args: never; Returns: undefined }
    }
    Enums: {
      prospect_statut:
        | "nouveau"
        | "proposition_envoyee"
        | "visite_planifiee"
        | "signe"
        | "perdu"
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
      prospect_statut: [
        "nouveau",
        "proposition_envoyee",
        "visite_planifiee",
        "signe",
        "perdu",
      ],
    },
  },
} as const
