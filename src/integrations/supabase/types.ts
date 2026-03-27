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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cash_closings: {
        Row: {
          business_date: string
          closed_at: string | null
          closing_version: number
          counted_balance: number | null
          created_at: string
          current_responsible_id: string
          difference_amount: number | null
          expected_balance: number
          expense_total: number
          id: string
          income_total: number
          is_latest_version: boolean
          last_transfer_id: string | null
          notes: string | null
          opening_balance: number
          previous_closing_snapshot: Json | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          sales_total: number
          status: Database["public"]["Enums"]["closing_status"]
          transfer_count: number
          user_id: string
        }
        Insert: {
          business_date: string
          closed_at?: string | null
          closing_version?: number
          counted_balance?: number | null
          created_at?: string
          current_responsible_id?: string
          difference_amount?: number | null
          expected_balance?: number
          expense_total?: number
          id?: string
          income_total?: number
          is_latest_version?: boolean
          last_transfer_id?: string | null
          notes?: string | null
          opening_balance?: number
          previous_closing_snapshot?: Json | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sales_total?: number
          status?: Database["public"]["Enums"]["closing_status"]
          transfer_count?: number
          user_id: string
        }
        Update: {
          business_date?: string
          closed_at?: string | null
          closing_version?: number
          counted_balance?: number | null
          created_at?: string
          current_responsible_id?: string
          difference_amount?: number | null
          expected_balance?: number
          expense_total?: number
          id?: string
          income_total?: number
          is_latest_version?: boolean
          last_transfer_id?: string | null
          notes?: string | null
          opening_balance?: number
          previous_closing_snapshot?: Json | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sales_total?: number
          status?: Database["public"]["Enums"]["closing_status"]
          transfer_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_current_responsible_id_fkey"
            columns: ["current_responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_last_transfer_id_fkey"
            columns: ["last_transfer_id"]
            isOneToOne: false
            referencedRelation: "cash_session_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_entries: {
        Row: {
          amount: number
          business_date: string
          category: string
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          description: string | null
          document_reference: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          entry_type: Database["public"]["Enums"]["entry_type"]
          id: string
          is_deleted: boolean
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          source_id: string | null
          source_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          business_date?: string
          category: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          document_reference?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          entry_type: Database["public"]["Enums"]["entry_type"]
          id?: string
          is_deleted?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          business_date?: string
          category?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          description?: string | null
          document_reference?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          entry_type?: Database["public"]["Enums"]["entry_type"]
          id?: string
          is_deleted?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_session_transfers: {
        Row: {
          accepted_at: string | null
          business_date: string
          cash_closing_id: string
          created_at: string
          from_user_id: string
          id: string
          notes: string | null
          requested_at: string
          status: Database["public"]["Enums"]["transfer_status"]
          to_user_id: string
          transfer_reason: string
        }
        Insert: {
          accepted_at?: string | null
          business_date: string
          cash_closing_id: string
          created_at?: string
          from_user_id: string
          id?: string
          notes?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          to_user_id: string
          transfer_reason: string
        }
        Update: {
          accepted_at?: string | null
          business_date?: string
          cash_closing_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          notes?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          to_user_id?: string
          transfer_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_transfers_cash_closing_id_fkey"
            columns: ["cash_closing_id"]
            isOneToOne: false
            referencedRelation: "cash_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_transfers_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_transfers_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_operation_insights: {
        Row: {
          business_date: string
          category: string
          created_at: string
          exposed_quantity: number | null
          had_restock: boolean
          had_shortage: boolean
          id: string
          leftover_quantity: number | null
          notes: string | null
          sold_quantity: number | null
          suggested_quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_date: string
          category: string
          created_at?: string
          exposed_quantity?: number | null
          had_restock?: boolean
          had_shortage?: boolean
          id?: string
          leftover_quantity?: number | null
          notes?: string | null
          sold_quantity?: number | null
          suggested_quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_date?: string
          category?: string
          created_at?: string
          exposed_quantity?: number | null
          had_restock?: boolean
          had_shortage?: boolean
          id?: string
          leftover_quantity?: number | null
          notes?: string | null
          sold_quantity?: number | null
          suggested_quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_operation_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          volunteer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          volunteer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "spr_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          id: string
          image_url: string | null
          internal_code: string | null
          is_active: boolean
          name: string
          notes: string | null
          unit_price: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          unit_price: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          unit_price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_complement: string | null
          address_number: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          cep: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          neighborhood: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          state: string | null
          street: string | null
          updated_at: string
          volunteer_id: string | null
        }
        Insert: {
          address_complement?: string | null
          address_number?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          neighborhood?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          street?: string | null
          updated_at?: string
          volunteer_id?: string | null
        }
        Update: {
          address_complement?: string | null
          address_number?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          neighborhood?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          street?: string | null
          updated_at?: string
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "spr_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          item_type: string
          line_total: number
          manual_item_name: string | null
          notes: string | null
          product_id: string | null
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_type?: string
          line_total: number
          manual_item_name?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          id?: string
          item_type?: string
          line_total?: number
          manual_item_name?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_date: string
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          discount_amount: number
          id: string
          is_deleted: boolean
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number: number
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_date?: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          discount_amount?: number
          id?: string
          is_deleted?: boolean
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_date?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          discount_amount?: number
          id?: string
          is_deleted?: boolean
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alert_candidates: {
        Row: {
          actor_user_id: string | null
          audit_log_id: string | null
          business_date: string | null
          candidate_score: number
          context_json: Json | null
          created_at: string
          event_type: string
          financial_delta: number | null
          id: string
          session_id: string | null
          status: string
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          audit_log_id?: string | null
          business_date?: string | null
          candidate_score?: number
          context_json?: Json | null
          created_at?: string
          event_type: string
          financial_delta?: number | null
          id?: string
          session_id?: string | null
          status?: string
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          audit_log_id?: string | null
          business_date?: string | null
          candidate_score?: number
          context_json?: Json | null
          created_at?: string
          event_type?: string
          financial_delta?: number | null
          id?: string
          session_id?: string | null
          status?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alert_candidates_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "security_audit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alert_deliveries: {
        Row: {
          alert_id: string
          channel: string
          created_at: string
          delivery_status: string
          id: string
          provider_response: string | null
          recipient: string
          retry_count: number
          sent_at: string | null
        }
        Insert: {
          alert_id: string
          channel: string
          created_at?: string
          delivery_status?: string
          id?: string
          provider_response?: string | null
          recipient: string
          retry_count?: number
          sent_at?: string | null
        }
        Update: {
          alert_id?: string
          channel?: string
          created_at?: string
          delivery_status?: string
          id?: string
          provider_response?: string | null
          recipient?: string
          retry_count?: number
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "security_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          actor_user_id: string | null
          audit_log_id: string | null
          business_date: string | null
          candidate_id: string | null
          context_json: Json | null
          created_at: string
          event_type: string | null
          fingerprint: string | null
          id: string
          is_deduplicated: boolean
          is_read: boolean
          is_sent: boolean
          priority: string
          read_at: string | null
          recommended_action: string | null
          requires_admin_review: boolean
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          severity: string
          summary: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          actor_user_id?: string | null
          audit_log_id?: string | null
          business_date?: string | null
          candidate_id?: string | null
          context_json?: Json | null
          created_at?: string
          event_type?: string | null
          fingerprint?: string | null
          id?: string
          is_deduplicated?: boolean
          is_read?: boolean
          is_sent?: boolean
          priority?: string
          read_at?: string | null
          recommended_action?: string | null
          requires_admin_review?: boolean
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          severity?: string
          summary?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          actor_user_id?: string | null
          audit_log_id?: string | null
          business_date?: string | null
          candidate_id?: string | null
          context_json?: Json | null
          created_at?: string
          event_type?: string | null
          fingerprint?: string | null
          id?: string
          is_deduplicated?: boolean
          is_read?: boolean
          is_sent?: boolean
          priority?: string
          read_at?: string | null
          recommended_action?: string | null
          requires_admin_review?: boolean
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          severity?: string
          summary?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "security_audit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_alerts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "security_alert_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_alerts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_logs: {
        Row: {
          action: string
          action_summary: string | null
          business_date: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          reason: string | null
          requires_admin_review: boolean | null
          route: string | null
          session_id: string | null
          severity: string
          status: string | null
          target_role: string | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          action_summary?: string | null
          business_date?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          reason?: string | null
          requires_admin_review?: boolean | null
          route?: string | null
          session_id?: string | null
          severity?: string
          status?: string | null
          target_role?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          action_summary?: string | null
          business_date?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          reason?: string | null
          requires_admin_review?: boolean | null
          route?: string | null
          session_id?: string | null
          severity?: string
          status?: string | null
          target_role?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          incident_type: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          incident_type: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          incident_type?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spr_fiado_charge_items: {
        Row: {
          charge_id: string
          id: string
          item_type: string
          line_total: number
          manual_item_name: string | null
          notes: string | null
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          charge_id: string
          id?: string
          item_type?: string
          line_total: number
          manual_item_name?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          unit_price: number
        }
        Update: {
          charge_id?: string
          id?: string
          item_type?: string
          line_total?: number
          manual_item_name?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "spr_fiado_charge_items_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "spr_fiado_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spr_fiado_charge_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      spr_fiado_charges: {
        Row: {
          amount: number
          business_date: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["fiado_status"]
          volunteer_id: string
        }
        Insert: {
          amount: number
          business_date?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["fiado_status"]
          volunteer_id: string
        }
        Update: {
          amount?: number
          business_date?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["fiado_status"]
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spr_fiado_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spr_fiado_charges_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "spr_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      spr_fiado_payments: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          document_reference: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          fiado_charge_id: string
          id: string
          is_deleted: boolean
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          updated_at: string
          updated_by: string | null
          volunteer_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          document_reference?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          fiado_charge_id: string
          id?: string
          is_deleted?: boolean
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          updated_at?: string
          updated_by?: string | null
          volunteer_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          document_reference?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          fiado_charge_id?: string
          id?: string
          is_deleted?: boolean
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          updated_at?: string
          updated_by?: string | null
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spr_fiado_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spr_fiado_payments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spr_fiado_payments_fiado_charge_id_fkey"
            columns: ["fiado_charge_id"]
            isOneToOne: false
            referencedRelation: "spr_fiado_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spr_fiado_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spr_fiado_payments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "spr_volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      spr_volunteers: {
        Row: {
          avatar_url: string | null
          created_at: string
          document_number: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          document_number?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          document_number?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_eligible_transfer_cashiers: {
        Args: { _exclude_user_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_user_names: {
        Args: { _user_ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_spr_notifications: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "cashier" | "volunteer"
      closing_status: "open" | "closed"
      document_type:
        | "recibo"
        | "nota_fiscal"
        | "id_transferencia"
        | "sem_documento"
      entry_type: "income" | "expense"
      fiado_status: "open" | "partial" | "paid"
      notification_type:
        | "spr_over_30_days"
        | "cash_correction"
        | "cash_transfer"
      payment_method:
        | "pix"
        | "debito"
        | "credito"
        | "transferencia"
        | "dinheiro"
      transfer_status: "pending" | "accepted" | "rejected" | "cancelled"
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
      app_role: ["admin", "cashier", "volunteer"],
      closing_status: ["open", "closed"],
      document_type: [
        "recibo",
        "nota_fiscal",
        "id_transferencia",
        "sem_documento",
      ],
      entry_type: ["income", "expense"],
      fiado_status: ["open", "partial", "paid"],
      notification_type: [
        "spr_over_30_days",
        "cash_correction",
        "cash_transfer",
      ],
      payment_method: ["pix", "debito", "credito", "transferencia", "dinheiro"],
      transfer_status: ["pending", "accepted", "rejected", "cancelled"],
    },
  },
} as const
