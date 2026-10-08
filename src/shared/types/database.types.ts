// Generated from Supabase project schema. Do not edit by hand — regenerate via MCP generate_typescript_types.

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
      abuse_reports: {
        Row: {
          category: string
          created_at: string
          details: Json
          id: string
          status: string
          target_id: string | null
          target_type: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          details?: Json
          id?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json
          id?: string
          status?: string
          target_id?: string | null
          target_type?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abuse_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      abuse_signals: {
        Row: {
          created_at: string
          fingerprint: string | null
          id: string
          ip_address: unknown
          metadata: Json
          severity: number
          signal_type: string
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          severity?: number
          signal_type: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          severity?: number
          signal_type?: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          allowed_models: string[]
          allowed_providers: string[]
          created_at: string
          environment: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          key_type: string
          last_used_at: string | null
          last_used_ip: unknown
          last_used_user_agent: string | null
          max_priority_rank: number | null
          name: string
          policy_snapshot: Json
          revoked_at: string | null
          revoked_reason: string | null
          rotation_required_at: string | null
          scopes: string[]
          training_access_allowed: boolean
          usage_metadata: Json
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          allowed_models?: string[]
          allowed_providers?: string[]
          created_at?: string
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          key_type?: string
          last_used_at?: string | null
          last_used_ip?: unknown
          last_used_user_agent?: string | null
          max_priority_rank?: number | null
          name: string
          policy_snapshot?: Json
          revoked_at?: string | null
          revoked_reason?: string | null
          rotation_required_at?: string | null
          scopes?: string[]
          training_access_allowed?: boolean
          usage_metadata?: Json
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          allowed_models?: string[]
          allowed_providers?: string[]
          created_at?: string
          environment?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          key_type?: string
          last_used_at?: string | null
          last_used_ip?: unknown
          last_used_user_agent?: string | null
          max_priority_rank?: number | null
          name?: string
          policy_snapshot?: Json
          revoked_at?: string | null
          revoked_reason?: string | null
          rotation_required_at?: string | null
          scopes?: string[]
          training_access_allowed?: boolean
          usage_metadata?: Json
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_jobs: {
        Row: {
          artifact_id: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          job_type: string
          result: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          artifact_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          job_type: string
          result?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          artifact_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          job_type?: string
          result?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artifact_jobs_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_versions: {
        Row: {
          artifact_id: string
          content_hash: string | null
          created_at: string
          created_by_message_id: string | null
          id: string
          metadata: Json
          storage_bucket: string
          storage_path: string
          version_number: number
        }
        Insert: {
          artifact_id: string
          content_hash?: string | null
          created_at?: string
          created_by_message_id?: string | null
          id?: string
          metadata?: Json
          storage_bucket: string
          storage_path: string
          version_number: number
        }
        Update: {
          artifact_id?: string
          content_hash?: string | null
          created_at?: string
          created_by_message_id?: string | null
          id?: string
          metadata?: Json
          storage_bucket?: string
          storage_path?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "artifact_versions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_versions_created_by_message_id_fkey"
            columns: ["created_by_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      artifacts: {
        Row: {
          chat_id: string | null
          created_at: string
          current_version_id: string | null
          id: string
          kind: string
          message_id: string | null
          metadata: Json
          status: string
          storage_bucket: string | null
          storage_path: string | null
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          kind: string
          message_id?: string | null
          metadata?: Json
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          kind?: string
          message_id?: string | null
          metadata?: Json
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "artifact_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_profiles: {
        Row: {
          capabilities: Json
          created_at: string
          default_model_id: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          owner_user_id: string | null
          slug: string | null
          status: string
          system_prompt: string | null
          updated_at: string
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          default_model_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_user_id?: string | null
          slug?: string | null
          status?: string
          system_prompt?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          capabilities?: Json
          created_at?: string
          default_model_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_user_id?: string | null
          slug?: string | null
          status?: string
          system_prompt?: string | null
          updated_at?: string
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_versions: {
        Row: {
          assistant_id: string
          capabilities: Json
          changelog: string | null
          created_at: string
          created_by: string | null
          default_model_id: string | null
          id: string
          system_prompt: string | null
          version_number: number
        }
        Insert: {
          assistant_id: string
          capabilities?: Json
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          default_model_id?: string | null
          id?: string
          system_prompt?: string | null
          version_number: number
        }
        Update: {
          assistant_id?: string
          capabilities?: Json
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          default_model_id?: string | null
          id?: string
          system_prompt?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "assistant_versions_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_plan_id: string | null
          actor_service_level: string | null
          actor_type: string
          after_state: Json | null
          before_state: Json | null
          compliance_tags: string[]
          created_at: string
          data_classification: string | null
          decision_trace: Json
          id: string
          ip_address: unknown
          metadata: Json
          request_id: string | null
          retention_expires_at: string | null
          risk_level: string
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_plan_id?: string | null
          actor_service_level?: string | null
          actor_type?: string
          after_state?: Json | null
          before_state?: Json | null
          compliance_tags?: string[]
          created_at?: string
          data_classification?: string | null
          decision_trace?: Json
          id?: string
          ip_address?: unknown
          metadata?: Json
          request_id?: string | null
          retention_expires_at?: string | null
          risk_level?: string
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_plan_id?: string | null
          actor_service_level?: string | null
          actor_type?: string
          after_state?: Json | null
          before_state?: Json | null
          compliance_tags?: string[]
          created_at?: string
          data_classification?: string | null
          decision_trace?: Json
          id?: string
          ip_address?: unknown
          metadata?: Json
          request_id?: string | null
          retention_expires_at?: string | null
          risk_level?: string
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          run_id: string
          status: string
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          run_id: string
          status: string
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          run_id?: string
          status?: string
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_notifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "scheduled_task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "scheduled_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_addresses: {
        Row: {
          address_line1: string
          address_line2: string
          city: string
          country_code: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          phone: string | null
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string
          city: string
          country_code?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          phone?: string | null
          postal_code: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string
          city?: string
          country_code?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          phone?: string | null
          postal_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_invoices: {
        Row: {
          country: string
          created_at: string
          currency: string
          emailed_at: string | null
          evidence: Json
          id: string
          invoice_number: string
          kind: string
          order_id: string
          payment_id: string
          r2_key: string
          r2_url: string
          razorpay_document_id: string | null
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          emailed_at?: string | null
          evidence?: Json
          id?: string
          invoice_number: string
          kind?: string
          order_id: string
          payment_id: string
          r2_key: string
          r2_url: string
          razorpay_document_id?: string | null
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          emailed_at?: string | null
          evidence?: Json
          id?: string
          invoice_number?: string
          kind?: string
          order_id?: string
          payment_id?: string
          r2_key?: string
          r2_url?: string
          razorpay_document_id?: string | null
          subtotal_paise?: number
          tax_paise?: number
          total_paise?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_orders: {
        Row: {
          activated_at: string | null
          amount_paise: number
          billing_cycle: string
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          failure_reason: string | null
          fulfilled_at: string | null
          gift_id: string | null
          id: string
          idempotency_key: string | null
          max_tier: string | null
          metadata: Json
          order_kind: string
          paid_at: string | null
          plan_id: string
          plan_name: string
          plan_snapshot: Json
          provider: string
          provider_order_id: string | null
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_status: string
          receipt: string
          status: string
          subtotal_paise: number
          tax_paise: number
          tokens: number
          updated_at: string
          user_email: string | null
          user_id: string
          verification_attempts: number
          verified_at: string | null
          workspace_id: string | null
        }
        Insert: {
          activated_at?: string | null
          amount_paise: number
          billing_cycle: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          gift_id?: string | null
          id: string
          idempotency_key?: string | null
          max_tier?: string | null
          metadata?: Json
          order_kind?: string
          paid_at?: string | null
          plan_id: string
          plan_name: string
          plan_snapshot?: Json
          provider?: string
          provider_order_id?: string | null
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_status: string
          receipt: string
          status?: string
          subtotal_paise: number
          tax_paise: number
          tokens: number
          updated_at?: string
          user_email?: string | null
          user_id: string
          verification_attempts?: number
          verified_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          activated_at?: string | null
          amount_paise?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          gift_id?: string | null
          id?: string
          idempotency_key?: string | null
          max_tier?: string | null
          metadata?: Json
          order_kind?: string
          paid_at?: string | null
          plan_id?: string
          plan_name?: string
          plan_snapshot?: Json
          provider?: string
          provider_order_id?: string | null
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_status?: string
          receipt?: string
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          tokens?: number
          updated_at?: string
          user_email?: string | null
          user_id?: string
          verification_attempts?: number
          verified_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_paise: number
          captured_at: string | null
          contact: string | null
          created_at: string
          currency: string
          email: string | null
          fulfilled_at: string
          id: string
          method: string | null
          order_id: string
          provider: string
          provider_payload: Json
          provider_payment_id: string | null
          source: string
          status: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          amount_paise: number
          captured_at?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          fulfilled_at?: string
          id: string
          method?: string | null
          order_id: string
          provider?: string
          provider_payload?: Json
          provider_payment_id?: string | null
          source: string
          status: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          amount_paise?: number
          captured_at?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          fulfilled_at?: string
          id?: string
          method?: string | null
          order_id?: string
          provider?: string
          provider_payload?: Json
          provider_payment_id?: string | null
          source?: string
          status?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["razorpay_order_id"]
          },
          {
            foreignKeyName: "billing_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_branches: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string | null
          created_from_message_id: string | null
          id: string
          parent_branch_id: string | null
          root_message_id: string | null
          title: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by?: string | null
          created_from_message_id?: string | null
          id?: string
          parent_branch_id?: string | null
          root_message_id?: string | null
          title?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string | null
          created_from_message_id?: string | null
          id?: string
          parent_branch_id?: string | null
          root_message_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_branches_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_branches_created_from_message_fk"
            columns: ["created_from_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_branches_root_message_fk"
            columns: ["root_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_generation_jobs: {
        Row: {
          assistant_message_id: string | null
          attempt: number
          chat_id: string
          checkpoint: Json
          completed_at: string | null
          created_at: string
          error: string | null
          heartbeat_at: string
          id: string
          input: Json
          locked_at: string | null
          locked_by: string | null
          result: Json | null
          slice_index: number
          status: string
          updated_at: string
          user_id: string
          user_message_id: string | null
        }
        Insert: {
          assistant_message_id?: string | null
          attempt?: number
          chat_id: string
          checkpoint?: Json
          completed_at?: string | null
          created_at?: string
          error?: string | null
          heartbeat_at?: string
          id?: string
          input?: Json
          locked_at?: string | null
          locked_by?: string | null
          result?: Json | null
          slice_index?: number
          status?: string
          updated_at?: string
          user_id: string
          user_message_id?: string | null
        }
        Update: {
          assistant_message_id?: string | null
          attempt?: number
          chat_id?: string
          checkpoint?: Json
          completed_at?: string | null
          created_at?: string
          error?: string | null
          heartbeat_at?: string
          id?: string
          input?: Json
          locked_at?: string | null
          locked_by?: string | null
          result?: Json | null
          slice_index?: number
          status?: string
          updated_at?: string
          user_id?: string
          user_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_generation_jobs_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_generation_jobs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_generation_jobs_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_parts: {
        Row: {
          artifact_id: string | null
          created_at: string
          file_id: string | null
          id: string
          json: Json | null
          message_id: string
          position: number
          text: string | null
          tool_call_id: string | null
          type: string
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          json?: Json | null
          message_id: string
          position?: number
          text?: string | null
          tool_call_id?: string | null
          type: string
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          json?: Json | null
          message_id?: string
          position?: number
          text?: string | null
          tool_call_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_parts_artifact_fk"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_parts_file_fk"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_parts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_parts_tool_call_fk"
            columns: ["tool_call_id"]
            isOneToOne: false
            referencedRelation: "tool_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          branch_id: string | null
          chat_id: string
          client_id: string | null
          contains_pii: boolean
          content: string | null
          content_json: Json
          content_search: unknown
          content_search_unaccent: unknown
          created_at: string
          error: Json | null
          finish_reason: string | null
          id: string
          input_tokens: number
          metadata: Json
          model_id: string | null
          output_tokens: number
          parent_message_id: string | null
          redaction_status: string
          role: string
          status: string
          token_count: number
          total_tokens: number | null
          training_eligible: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          chat_id: string
          client_id?: string | null
          contains_pii?: boolean
          content?: string | null
          content_json?: Json
          content_search?: unknown
          content_search_unaccent?: unknown
          created_at?: string
          error?: Json | null
          finish_reason?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json
          model_id?: string | null
          output_tokens?: number
          parent_message_id?: string | null
          redaction_status?: string
          role: string
          status?: string
          token_count?: number
          total_tokens?: number | null
          training_eligible?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          chat_id?: string
          client_id?: string | null
          contains_pii?: boolean
          content?: string | null
          content_json?: Json
          content_search?: unknown
          content_search_unaccent?: unknown
          created_at?: string
          error?: Json | null
          finish_reason?: string | null
          id?: string
          input_tokens?: number
          metadata?: Json
          model_id?: string | null
          output_tokens?: number
          parent_message_id?: string | null
          redaction_status?: string
          role?: string
          status?: string
          token_count?: number
          total_tokens?: number | null
          training_eligible?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_transcript_lines: {
        Row: {
          chat_id: string
          created_at: string
          id: number
          message_id: string | null
          record: Json
          role: string
          schema_version: string
          seq: number
          training_eligible: boolean
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: never
          message_id?: string | null
          record: Json
          role: string
          schema_version?: string
          seq: number
          training_eligible?: boolean
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: never
          message_id?: string | null
          record?: Json
          role?: string
          schema_version?: string
          seq?: number
          training_eligible?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_transcript_lines_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_transcript_lines_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          active_leaf_message_id: string | null
          adaptive_thinking_enabled: boolean
          archived_at: string | null
          created_at: string
          id: string
          metadata: Json
          model_id: string | null
          project_id: string | null
          response_style: string | null
          starred: boolean
          status: string
          system_prompt: string | null
          title: string
          updated_at: string
          user_id: string
          web_search_enabled: boolean
          workspace_id: string | null
        }
        Insert: {
          active_leaf_message_id?: string | null
          adaptive_thinking_enabled?: boolean
          archived_at?: string | null
          created_at?: string
          id: string
          metadata?: Json
          model_id?: string | null
          project_id?: string | null
          response_style?: string | null
          starred?: boolean
          status?: string
          system_prompt?: string | null
          title?: string
          updated_at?: string
          user_id: string
          web_search_enabled?: boolean
          workspace_id?: string | null
        }
        Update: {
          active_leaf_message_id?: string | null
          adaptive_thinking_enabled?: boolean
          archived_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          model_id?: string | null
          project_id?: string | null
          response_style?: string | null
          starred?: boolean
          status?: string
          system_prompt?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          web_search_enabled?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_active_leaf_message_id_fkey"
            columns: ["active_leaf_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          connected_at: string
          id: string
          provider: string
          provider_account_id: string | null
          scopes: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          provider: string
          provider_account_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          provider?: string
          provider_account_id?: string | null
          scopes?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connector_action_approvals: {
        Row: {
          arguments_hash: string
          consumed_at: string | null
          created_at: string
          decided_at: string | null
          expires_at: string
          id: string
          installation_id: string
          status: string
          tool_name: string
          user_id: string
        }
        Insert: {
          arguments_hash: string
          consumed_at?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          installation_id: string
          status?: string
          tool_name: string
          user_id: string
        }
        Update: {
          arguments_hash?: string
          consumed_at?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          installation_id?: string
          status?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_action_approvals_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "connector_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_audit_events: {
        Row: {
          connector_key: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          event_id: string
          event_type: string
          id: string
          installation_id: string | null
          metadata: Json
          request_id: string | null
          status: string
          tool_name: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          connector_key?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          event_id?: string
          event_type: string
          id?: string
          installation_id?: string | null
          metadata?: Json
          request_id?: string | null
          status: string
          tool_name?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          connector_key?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          event_id?: string
          event_type?: string
          id?: string
          installation_id?: string | null
          metadata?: Json
          request_id?: string | null
          status?: string
          tool_name?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_audit_events_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "connector_installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_catalog: {
        Row: {
          auth_type: string
          capabilities: Json
          config_schema: Json
          created_at: string
          documentation_url: string | null
          id: string
          key: string
          mcp_url: string | null
          metadata: Json
          name: string
          protocol: string
          provider: string
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          auth_type?: string
          capabilities?: Json
          config_schema?: Json
          created_at?: string
          documentation_url?: string | null
          id?: string
          key: string
          mcp_url?: string | null
          metadata?: Json
          name: string
          protocol?: string
          provider: string
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          auth_type?: string
          capabilities?: Json
          config_schema?: Json
          created_at?: string
          documentation_url?: string | null
          id?: string
          key?: string
          mcp_url?: string | null
          metadata?: Json
          name?: string
          protocol?: string
          provider?: string
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      connector_health_checks: {
        Row: {
          checked_at: string
          error_code: string | null
          id: string
          installation_id: string
          latency_ms: number | null
          metadata: Json
          status: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          error_code?: string | null
          id?: string
          installation_id: string
          latency_ms?: number | null
          metadata?: Json
          status: string
          user_id: string
        }
        Update: {
          checked_at?: string
          error_code?: string | null
          id?: string
          installation_id?: string
          latency_ms?: number | null
          metadata?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_health_checks_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "connector_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_installations: {
        Row: {
          account_label: string | null
          connected_at: string | null
          connector_id: string
          created_at: string
          granted_scopes: string[]
          id: string
          last_error_at: string | null
          last_error_code: string | null
          last_synced_at: string | null
          last_used_at: string | null
          provider_account_id: string | null
          settings: Json
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          account_label?: string | null
          connected_at?: string | null
          connector_id: string
          created_at?: string
          granted_scopes?: string[]
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_synced_at?: string | null
          last_used_at?: string | null
          provider_account_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          account_label?: string | null
          connected_at?: string | null
          connector_id?: string
          created_at?: string
          granted_scopes?: string[]
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_synced_at?: string | null
          last_used_at?: string | null
          provider_account_id?: string | null
          settings?: Json
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connector_installations_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connector_installations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_tool_permissions: {
        Row: {
          created_at: string
          id: string
          installation_id: string
          policy: string
          tool_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installation_id: string
          policy?: string
          tool_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installation_id?: string
          policy?: string
          tool_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_tool_permissions_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "connector_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      connector_tools: {
        Row: {
          connector_id: string
          created_at: string
          description: string
          http_method: string | null
          id: string
          input_schema: Json
          is_enabled: boolean
          metadata: Json
          name: string
          output_schema: Json | null
          path_template: string | null
          request_config: Json
          requires_confirmation: boolean
          risk_level: string
          title: string
          updated_at: string
        }
        Insert: {
          connector_id: string
          created_at?: string
          description?: string
          http_method?: string | null
          id?: string
          input_schema?: Json
          is_enabled?: boolean
          metadata?: Json
          name: string
          output_schema?: Json | null
          path_template?: string | null
          request_config?: Json
          requires_confirmation?: boolean
          risk_level?: string
          title: string
          updated_at?: string
        }
        Update: {
          connector_id?: string
          created_at?: string
          description?: string
          http_method?: string | null
          id?: string
          input_schema?: Json
          is_enabled?: boolean
          metadata?: Json
          name?: string
          output_schema?: Json | null
          path_template?: string | null
          request_config?: Json
          requires_confirmation?: boolean
          risk_level?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_tools_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "connector_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_shares: {
        Row: {
          chat_id: string
          created_at: string
          expires_at: string | null
          id: string
          include_artifacts: boolean
          metadata: Json
          revoked_at: string | null
          share_token_hash: string
          snapshot: Json | null
          user_id: string
          visibility: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          include_artifacts?: boolean
          metadata?: Json
          revoked_at?: string | null
          share_token_hash: string
          snapshot?: Json | null
          user_id: string
          visibility?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          include_artifacts?: boolean
          metadata?: Json
          revoked_at?: string | null
          share_token_hash?: string
          snapshot?: Json | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_shares_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          advertising: boolean
          country_code: string | null
          created_at: string
          essential: boolean
          id: string
          performance: boolean
          source: string
          updated_at: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          advertising: boolean
          country_code?: string | null
          created_at?: string
          essential?: boolean
          id?: string
          performance: boolean
          source?: string
          updated_at?: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          advertising?: boolean
          country_code?: string | null
          created_at?: string
          essential?: boolean
          id?: string
          performance?: boolean
          source?: string
          updated_at?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      cookie_events: {
        Row: {
          category: string
          country_code: string | null
          created_at: string
          event_type: string
          id: string
          path: string | null
          payload: Json
          referrer: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string
        }
        Insert: {
          category: string
          country_code?: string | null
          created_at?: string
          event_type: string
          id?: string
          path?: string | null
          payload?: Json
          referrer?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id: string
        }
        Update: {
          category?: string
          country_code?: string | null
          created_at?: string
          event_type?: string
          id?: string
          path?: string | null
          payload?: Json
          referrer?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json
          requested_scope: string
          scheduled_for: string | null
          status: string
          user_id: string
          verification_token_hash: string | null
          verified_at: string | null
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          requested_scope?: string
          scheduled_for?: string | null
          status?: string
          user_id: string
          verification_token_hash?: string | null
          verified_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          requested_scope?: string
          scheduled_for?: string | null
          status?: string
          user_id?: string
          verification_token_hash?: string | null
          verified_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_type: string
          id: string
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          id?: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          id?: string
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_export_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_search: unknown
          content_search_unaccent: unknown
          created_at: string
          id: string
          metadata: Json
          source_id: string | null
          source_type: string
          token_count: number
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          content_search?: unknown
          content_search_unaccent?: unknown
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type: string
          token_count?: number
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          content_search?: unknown
          content_search_unaccent?: unknown
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type?: string
          token_count?: number
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          chunk_id: string
          created_at: string
          dimensions: number
          embedding: string | null
          id: string
          model_id: string
          provider: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          chunk_id: string
          created_at?: string
          dimensions?: number
          embedding?: string | null
          id?: string
          model_id: string
          provider: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          chunk_id?: string
          created_at?: string
          dimensions?: number
          embedding?: string | null
          id?: string
          model_id?: string
          provider?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          affects_model_routing: boolean
          affects_training: boolean
          allowed_plan_ids: string[]
          audit_required: boolean
          blocked_plan_ids: string[]
          conditions: Json
          created_at: string
          description: string | null
          enabled: boolean
          evaluation_metadata: Json
          id: string
          key: string
          owner_team: string | null
          risk_level: string
          rollout: Json
          rollout_ended_at: string | null
          rollout_started_at: string | null
          updated_at: string
        }
        Insert: {
          affects_model_routing?: boolean
          affects_training?: boolean
          allowed_plan_ids?: string[]
          audit_required?: boolean
          blocked_plan_ids?: string[]
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          evaluation_metadata?: Json
          id?: string
          key: string
          owner_team?: string | null
          risk_level?: string
          rollout?: Json
          rollout_ended_at?: string | null
          rollout_started_at?: string | null
          updated_at?: string
        }
        Update: {
          affects_model_routing?: boolean
          affects_training?: boolean
          allowed_plan_ids?: string[]
          audit_required?: boolean
          blocked_plan_ids?: string[]
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          evaluation_metadata?: Json
          id?: string
          key?: string
          owner_team?: string | null
          risk_level?: string
          rollout?: Json
          rollout_ended_at?: string | null
          rollout_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      file_processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: Json | null
          file_id: string
          id: string
          job_type: string
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          file_id: string
          id?: string
          job_type: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          file_id?: string
          id?: string
          job_type?: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_processing_jobs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_versions: {
        Row: {
          content_hash: string | null
          created_at: string
          file_id: string
          id: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          version_number: number
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          file_id: string
          id?: string
          size_bytes?: number
          storage_bucket: string
          storage_path: string
          version_number: number
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          file_id?: string
          id?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_codes: {
        Row: {
          amount_paise: number
          billing_order_id: string | null
          claim_token: string | null
          code_hash: string
          code_last4: string
          code_prefix: string
          code_rotated_at: string | null
          created_at: string
          currency: string
          delivery_method: string
          expires_at: string
          id: string
          message: string | null
          metadata: Json
          months: number
          plan_id: string
          plan_name: string
          purchased_at: string | null
          purchased_payment_id: string | null
          purchaser_email: string | null
          purchaser_user_id: string
          recipient_email: string | null
          recipient_name: string | null
          redeemed_at: string | null
          redeemed_by_user_id: string | null
          sender_email: string | null
          sender_name: string | null
          status: string
          subtotal_paise: number
          tax_paise: number
          theme_color: string | null
          token_grant: number
          updated_at: string
        }
        Insert: {
          amount_paise: number
          billing_order_id?: string | null
          claim_token?: string | null
          code_hash: string
          code_last4: string
          code_prefix: string
          code_rotated_at?: string | null
          created_at?: string
          currency?: string
          delivery_method?: string
          expires_at: string
          id?: string
          message?: string | null
          metadata?: Json
          months: number
          plan_id: string
          plan_name: string
          purchased_at?: string | null
          purchased_payment_id?: string | null
          purchaser_email?: string | null
          purchaser_user_id: string
          recipient_email?: string | null
          recipient_name?: string | null
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          status?: string
          subtotal_paise: number
          tax_paise?: number
          theme_color?: string | null
          token_grant: number
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          billing_order_id?: string | null
          claim_token?: string | null
          code_hash?: string
          code_last4?: string
          code_prefix?: string
          code_rotated_at?: string | null
          created_at?: string
          currency?: string
          delivery_method?: string
          expires_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          months?: number
          plan_id?: string
          plan_name?: string
          purchased_at?: string | null
          purchased_payment_id?: string | null
          purchaser_email?: string | null
          purchaser_user_id?: string
          recipient_email?: string | null
          recipient_name?: string | null
          redeemed_at?: string | null
          redeemed_by_user_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          theme_color?: string | null
          token_grant?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_codes_billing_order_id_fkey"
            columns: ["billing_order_id"]
            isOneToOne: true
            referencedRelation: "billing_orders"
            referencedColumns: ["razorpay_order_id"]
          },
          {
            foreignKeyName: "gift_codes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_delivery_jobs: {
        Row: {
          attempts: number
          created_at: string
          delivery_method: string
          gift_id: string
          id: string
          last_error: string | null
          metadata: Json
          provider: string | null
          provider_message_id: string | null
          recipient_email: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivery_method: string
          gift_id: string
          id?: string
          last_error?: string | null
          metadata?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivery_method?: string
          gift_id?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_delivery_jobs_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: true
            referencedRelation: "gift_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_redemptions: {
        Row: {
          gift_id: string
          id: string
          metadata: Json
          redeemed_at: string
          subscription_id: string | null
          token_transaction_id: string | null
          user_id: string
        }
        Insert: {
          gift_id: string
          id?: string
          metadata?: Json
          redeemed_at?: string
          subscription_id?: string | null
          token_transaction_id?: string | null
          user_id: string
        }
        Update: {
          gift_id?: string
          id?: string
          metadata?: Json
          redeemed_at?: string
          subscription_id?: string | null
          token_transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_redemptions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: true
            referencedRelation: "gift_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_redemptions_token_transaction_id_fkey"
            columns: ["token_transaction_id"]
            isOneToOne: false
            referencedRelation: "token_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      inference_gateway_requests: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          gateway: string
          id: string
          latency_ms: number | null
          metadata: Json
          mode: string
          model: string
          prompt_character_count: number
          prompt_message_count: number
          provider: string
          request_finished_at: string | null
          request_started_at: string
          response_character_count: number
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          gateway?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          mode: string
          model: string
          prompt_character_count?: number
          prompt_message_count?: number
          provider?: string
          request_finished_at?: string | null
          request_started_at?: string
          response_character_count?: number
          status: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          gateway?: string
          id?: string
          latency_ms?: number | null
          metadata?: Json
          mode?: string
          model?: string
          prompt_character_count?: number
          prompt_message_count?: number
          provider?: string
          request_finished_at?: string | null
          request_started_at?: string
          response_character_count?: number
          status?: string
        }
        Relationships: []
      }
      instruction_profiles: {
        Row: {
          created_at: string
          id: string
          instructions: string
          is_default: boolean
          status: string
          title: string
          traits: Json
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instructions: string
          is_default?: boolean
          status?: string
          title: string
          traits?: Json
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string
          is_default?: boolean
          status?: string
          title?: string
          traits?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instruction_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      library_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_folders_parent_owner_fk"
            columns: ["parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      library_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json
          source_id: string | null
          source_type: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          source_id?: string | null
          source_type?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          audit_trace: Json
          consent_snapshot: Json
          created_at: string
          data_classification: string | null
          event_reason: string | null
          event_type: string
          id: string
          memory_id: string | null
          metadata: Json
          policy_version: string | null
          request_id: string | null
          source_message_id: string | null
          training_state_after: string | null
          training_state_before: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          audit_trace?: Json
          consent_snapshot?: Json
          created_at?: string
          data_classification?: string | null
          event_reason?: string | null
          event_type: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          policy_version?: string | null
          request_id?: string | null
          source_message_id?: string | null
          training_state_after?: string | null
          training_state_before?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          audit_trace?: Json
          consent_snapshot?: Json
          created_at?: string
          data_classification?: string | null
          event_reason?: string | null
          event_type?: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          policy_version?: string | null
          request_id?: string | null
          source_message_id?: string | null
          training_state_after?: string | null
          training_state_before?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_events_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "user_memories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_events_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      model_catalog: {
        Row: {
          capabilities: Json
          context_window_tokens: number | null
          created_at: string
          data_residency_regions: string[]
          default_temperature: number | null
          display_name: string
          fallback_model_ids: string[]
          id: string
          input_token_price: number
          is_enabled: boolean
          max_output_tokens: number | null
          metadata: Json
          model_family: string | null
          model_id: string
          model_version: string | null
          nomita_model_slug: string | null
          nomita_routing_metadata: Json
          output_token_price: number
          peak_capacity_units: number | null
          priority_supported: boolean
          provider: string
          provider_display_name: string | null
          retention_policy: string
          supports_audio: boolean
          supports_embeddings: boolean
          supports_realtime: boolean
          supports_streaming: boolean
          supports_tools: boolean
          supports_vision: boolean
          training_data_policy: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          context_window_tokens?: number | null
          created_at?: string
          data_residency_regions?: string[]
          default_temperature?: number | null
          display_name: string
          fallback_model_ids?: string[]
          id?: string
          input_token_price?: number
          is_enabled?: boolean
          max_output_tokens?: number | null
          metadata?: Json
          model_family?: string | null
          model_id: string
          model_version?: string | null
          nomita_model_slug?: string | null
          nomita_routing_metadata?: Json
          output_token_price?: number
          peak_capacity_units?: number | null
          priority_supported?: boolean
          provider: string
          provider_display_name?: string | null
          retention_policy?: string
          supports_audio?: boolean
          supports_embeddings?: boolean
          supports_realtime?: boolean
          supports_streaming?: boolean
          supports_tools?: boolean
          supports_vision?: boolean
          training_data_policy?: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          context_window_tokens?: number | null
          created_at?: string
          data_residency_regions?: string[]
          default_temperature?: number | null
          display_name?: string
          fallback_model_ids?: string[]
          id?: string
          input_token_price?: number
          is_enabled?: boolean
          max_output_tokens?: number | null
          metadata?: Json
          model_family?: string | null
          model_id?: string
          model_version?: string | null
          nomita_model_slug?: string | null
          nomita_routing_metadata?: Json
          output_token_price?: number
          peak_capacity_units?: number | null
          priority_supported?: boolean
          provider?: string
          provider_display_name?: string | null
          retention_policy?: string
          supports_audio?: boolean
          supports_embeddings?: boolean
          supports_realtime?: boolean
          supports_streaming?: boolean
          supports_tools?: boolean
          supports_vision?: boolean
          training_data_policy?: string
          updated_at?: string
        }
        Relationships: []
      }
      model_priority_runtime_snapshots: {
        Row: {
          capacity_pool: string | null
          created_at: string
          decision: string
          decision_reason: string | null
          entitlement_snapshot: Json
          highest_priority: boolean
          id: string
          model_id: string | null
          peak_window: boolean
          plan_id: string | null
          plus_highest_priority_blocked: boolean
          priority_rank: number
          provider: string
          provider_snapshot: Json
          queue_position: number | null
          queue_wait_ms: number | null
          rate_limit_snapshot: Json
          request_id: string | null
          router_rule_id: string | null
          service_level: string
          subscription_id: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          capacity_pool?: string | null
          created_at?: string
          decision?: string
          decision_reason?: string | null
          entitlement_snapshot?: Json
          highest_priority?: boolean
          id?: string
          model_id?: string | null
          peak_window?: boolean
          plan_id?: string | null
          plus_highest_priority_blocked?: boolean
          priority_rank?: number
          provider?: string
          provider_snapshot?: Json
          queue_position?: number | null
          queue_wait_ms?: number | null
          rate_limit_snapshot?: Json
          request_id?: string | null
          router_rule_id?: string | null
          service_level?: string
          subscription_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          capacity_pool?: string | null
          created_at?: string
          decision?: string
          decision_reason?: string | null
          entitlement_snapshot?: Json
          highest_priority?: boolean
          id?: string
          model_id?: string | null
          peak_window?: boolean
          plan_id?: string | null
          plus_highest_priority_blocked?: boolean
          priority_rank?: number
          provider?: string
          provider_snapshot?: Json
          queue_position?: number | null
          queue_wait_ms?: number | null
          rate_limit_snapshot?: Json
          request_id?: string | null
          router_rule_id?: string | null
          service_level?: string
          subscription_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_priority_runtime_snapshots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_priority_runtime_snapshots_router_rule_id_fkey"
            columns: ["router_rule_id"]
            isOneToOne: false
            referencedRelation: "model_router_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_priority_runtime_snapshots_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_priority_runtime_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_router_rules: {
        Row: {
          allowed_plan_ids: string[]
          blocked_plan_ids: string[]
          capacity_pool: string | null
          condition: Json
          created_at: string
          data_classification_allowed: string[]
          ends_at: string | null
          enterprise_override_allowed: boolean
          evaluation_tags: string[]
          failover_order: Json
          fallback_model_id: string | null
          fallback_provider: string | null
          highest_priority_required: boolean
          id: string
          is_enabled: boolean
          max_latency_ms: number | null
          max_queue_depth: number | null
          model_id: string
          name: string
          nomita_policy: Json
          nomita_route_key: string | null
          peak_only: boolean
          plus_highest_priority_blocked: boolean
          priority: number
          priority_rank_max: number | null
          priority_rank_min: number | null
          provider: string
          provider_weight: number
          rollout_percentage: number
          service_level: string | null
          starts_at: string | null
          training_allowed: boolean | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          allowed_plan_ids?: string[]
          blocked_plan_ids?: string[]
          capacity_pool?: string | null
          condition?: Json
          created_at?: string
          data_classification_allowed?: string[]
          ends_at?: string | null
          enterprise_override_allowed?: boolean
          evaluation_tags?: string[]
          failover_order?: Json
          fallback_model_id?: string | null
          fallback_provider?: string | null
          highest_priority_required?: boolean
          id?: string
          is_enabled?: boolean
          max_latency_ms?: number | null
          max_queue_depth?: number | null
          model_id: string
          name: string
          nomita_policy?: Json
          nomita_route_key?: string | null
          peak_only?: boolean
          plus_highest_priority_blocked?: boolean
          priority?: number
          priority_rank_max?: number | null
          priority_rank_min?: number | null
          provider: string
          provider_weight?: number
          rollout_percentage?: number
          service_level?: string | null
          starts_at?: string | null
          training_allowed?: boolean | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          allowed_plan_ids?: string[]
          blocked_plan_ids?: string[]
          capacity_pool?: string | null
          condition?: Json
          created_at?: string
          data_classification_allowed?: string[]
          ends_at?: string | null
          enterprise_override_allowed?: boolean
          evaluation_tags?: string[]
          failover_order?: Json
          fallback_model_id?: string | null
          fallback_provider?: string | null
          highest_priority_required?: boolean
          id?: string
          is_enabled?: boolean
          max_latency_ms?: number | null
          max_queue_depth?: number | null
          model_id?: string
          name?: string
          nomita_policy?: Json
          nomita_route_key?: string | null
          peak_only?: boolean
          plus_highest_priority_blocked?: boolean
          priority?: number
          priority_rank_max?: number | null
          priority_rank_min?: number | null
          provider?: string
          provider_weight?: number
          rollout_percentage?: number
          service_level?: string | null
          starts_at?: string | null
          training_allowed?: boolean | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_router_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_training_consent_events: {
        Row: {
          allowed_modalities: string[]
          blocked_categories: string[]
          consent_scope: string
          consent_state: string
          created_at: string
          data_classification: string | null
          effective_at: string
          evidence: Json
          expires_at: string | null
          id: string
          plan_id: string | null
          policy_version: string | null
          revoked_at: string | null
          service_level: string | null
          source: string
          source_ip: unknown
          source_user_agent: string | null
          subject_id: string | null
          subject_type: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          allowed_modalities?: string[]
          blocked_categories?: string[]
          consent_scope?: string
          consent_state: string
          created_at?: string
          data_classification?: string | null
          effective_at?: string
          evidence?: Json
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          policy_version?: string | null
          revoked_at?: string | null
          service_level?: string | null
          source?: string
          source_ip?: unknown
          source_user_agent?: string | null
          subject_id?: string | null
          subject_type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          allowed_modalities?: string[]
          blocked_categories?: string[]
          consent_scope?: string
          consent_state?: string
          created_at?: string
          data_classification?: string | null
          effective_at?: string
          evidence?: Json
          expires_at?: string | null
          id?: string
          plan_id?: string | null
          policy_version?: string | null
          revoked_at?: string | null
          service_level?: string | null
          source?: string
          source_ip?: unknown
          source_user_agent?: string | null
          subject_id?: string | null
          subject_type?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_training_consent_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_training_consent_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_usage_events: {
        Row: {
          billing_trace: Json
          capacity_pool: string | null
          chat_id: string | null
          cost_amount: number | null
          created_at: string
          currency: string
          data_classification: string
          error_code: string | null
          error_message: string | null
          fallback_chain: Json
          fallback_count: number
          highest_priority: boolean
          id: string
          input_tokens: number
          latency_ms: number | null
          message_id: string | null
          metadata: Json
          model_id: string
          nomita_request_id: string | null
          nomita_routing_metadata: Json
          output_tokens: number
          peak_window: boolean
          plan_id: string | null
          priority_rank: number | null
          prompt_hash: string | null
          provider: string
          provider_cluster: string | null
          provider_latency_ms: number | null
          provider_region: string | null
          provider_request_id: string | null
          queue_entered_at: string | null
          queue_released_at: string | null
          queue_wait_ms: number | null
          request_id: string | null
          request_status: string
          response_hash: string | null
          retry_count: number
          route_rule_id: string | null
          safety_policy_snapshot: Json
          service_level: string | null
          session_id: string | null
          throttle_applied: boolean
          throttle_reason: string | null
          time_to_first_token_ms: number | null
          total_tokens: number | null
          training_consent_snapshot: Json
          training_eligible: boolean
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          billing_trace?: Json
          capacity_pool?: string | null
          chat_id?: string | null
          cost_amount?: number | null
          created_at?: string
          currency?: string
          data_classification?: string
          error_code?: string | null
          error_message?: string | null
          fallback_chain?: Json
          fallback_count?: number
          highest_priority?: boolean
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          message_id?: string | null
          metadata?: Json
          model_id: string
          nomita_request_id?: string | null
          nomita_routing_metadata?: Json
          output_tokens?: number
          peak_window?: boolean
          plan_id?: string | null
          priority_rank?: number | null
          prompt_hash?: string | null
          provider: string
          provider_cluster?: string | null
          provider_latency_ms?: number | null
          provider_region?: string | null
          provider_request_id?: string | null
          queue_entered_at?: string | null
          queue_released_at?: string | null
          queue_wait_ms?: number | null
          request_id?: string | null
          request_status?: string
          response_hash?: string | null
          retry_count?: number
          route_rule_id?: string | null
          safety_policy_snapshot?: Json
          service_level?: string | null
          session_id?: string | null
          throttle_applied?: boolean
          throttle_reason?: string | null
          time_to_first_token_ms?: number | null
          total_tokens?: number | null
          training_consent_snapshot?: Json
          training_eligible?: boolean
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          billing_trace?: Json
          capacity_pool?: string | null
          chat_id?: string | null
          cost_amount?: number | null
          created_at?: string
          currency?: string
          data_classification?: string
          error_code?: string | null
          error_message?: string | null
          fallback_chain?: Json
          fallback_count?: number
          highest_priority?: boolean
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          message_id?: string | null
          metadata?: Json
          model_id?: string
          nomita_request_id?: string | null
          nomita_routing_metadata?: Json
          output_tokens?: number
          peak_window?: boolean
          plan_id?: string | null
          priority_rank?: number | null
          prompt_hash?: string | null
          provider?: string
          provider_cluster?: string | null
          provider_latency_ms?: number | null
          provider_region?: string | null
          provider_request_id?: string | null
          queue_entered_at?: string | null
          queue_released_at?: string | null
          queue_wait_ms?: number | null
          request_id?: string | null
          request_status?: string
          response_hash?: string | null
          retry_count?: number
          route_rule_id?: string | null
          safety_policy_snapshot?: Json
          service_level?: string | null
          session_id?: string | null
          throttle_applied?: boolean
          throttle_reason?: string | null
          time_to_first_token_ms?: number | null
          total_tokens?: number | null
          training_consent_snapshot?: Json
          training_eligible?: boolean
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_usage_events_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_usage_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      model_usage_realtime_windows: {
        Row: {
          active_requests: number
          avg_latency_ms: number | null
          bucket_seconds: number
          capacity_pool: string | null
          capacity_units: number | null
          completed_requests: number
          cost_amount: number | null
          created_at: string
          failed_requests: number
          highest_priority: boolean
          id: string
          input_tokens: number
          model_family: string | null
          model_id: string | null
          nomita_capacity_snapshot: Json
          output_tokens: number
          p95_latency_ms: number | null
          plan_id: string | null
          priority_rank: number
          provider: string
          queue_depth: number
          queued_requests: number
          region: string | null
          routing_snapshot: Json
          saturation_ratio: number | null
          service_level: string
          throttled_requests: number
          training_blocked_requests: number
          training_eligible_requests: number
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          active_requests?: number
          avg_latency_ms?: number | null
          bucket_seconds?: number
          capacity_pool?: string | null
          capacity_units?: number | null
          completed_requests?: number
          cost_amount?: number | null
          created_at?: string
          failed_requests?: number
          highest_priority?: boolean
          id?: string
          input_tokens?: number
          model_family?: string | null
          model_id?: string | null
          nomita_capacity_snapshot?: Json
          output_tokens?: number
          p95_latency_ms?: number | null
          plan_id?: string | null
          priority_rank?: number
          provider?: string
          queue_depth?: number
          queued_requests?: number
          region?: string | null
          routing_snapshot?: Json
          saturation_ratio?: number | null
          service_level?: string
          throttled_requests?: number
          training_blocked_requests?: number
          training_eligible_requests?: number
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          active_requests?: number
          avg_latency_ms?: number | null
          bucket_seconds?: number
          capacity_pool?: string | null
          capacity_units?: number | null
          completed_requests?: number
          cost_amount?: number | null
          created_at?: string
          failed_requests?: number
          highest_priority?: boolean
          id?: string
          input_tokens?: number
          model_family?: string | null
          model_id?: string | null
          nomita_capacity_snapshot?: Json
          output_tokens?: number
          p95_latency_ms?: number | null
          plan_id?: string | null
          priority_rank?: number
          provider?: string
          queue_depth?: number
          queued_requests?: number
          region?: string | null
          routing_snapshot?: Json
          saturation_ratio?: number | null
          service_level?: string
          throttled_requests?: number
          training_blocked_requests?: number
          training_eligible_requests?: number
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_usage_realtime_windows_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          appeal_status: string | null
          audit_trace: Json
          category_scores: Json
          chat_id: string | null
          created_at: string
          decision: string
          decision_latency_ms: number | null
          escalation_required: boolean
          id: string
          input_hash: string | null
          jurisdiction: string | null
          message_id: string | null
          metadata: Json
          model_id: string | null
          policy_rule_id: string | null
          policy_version: string | null
          provider: string | null
          provider_request_id: string | null
          redaction_applied: boolean
          retention_expires_at: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          severity: number | null
          training_blocked: boolean
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          appeal_status?: string | null
          audit_trace?: Json
          category_scores?: Json
          chat_id?: string | null
          created_at?: string
          decision: string
          decision_latency_ms?: number | null
          escalation_required?: boolean
          id?: string
          input_hash?: string | null
          jurisdiction?: string | null
          message_id?: string | null
          metadata?: Json
          model_id?: string | null
          policy_rule_id?: string | null
          policy_version?: string | null
          provider?: string | null
          provider_request_id?: string | null
          redaction_applied?: boolean
          retention_expires_at?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          severity?: number | null
          training_blocked?: boolean
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          appeal_status?: string | null
          audit_trace?: Json
          category_scores?: Json
          chat_id?: string | null
          created_at?: string
          decision?: string
          decision_latency_ms?: number | null
          escalation_required?: boolean
          id?: string
          input_hash?: string | null
          jurisdiction?: string | null
          message_id?: string | null
          metadata?: Json
          model_id?: string | null
          policy_rule_id?: string | null
          policy_version?: string | null
          provider?: string | null
          provider_request_id?: string | null
          redaction_applied?: boolean
          retention_expires_at?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          severity?: number | null
          training_blocked?: boolean
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_policy_rule_id_fkey"
            columns: ["policy_rule_id"]
            isOneToOne: false
            referencedRelation: "safety_policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          billing_alerts: boolean
          email_notifications: boolean
          product_updates: boolean
          research_complete: boolean
          security_alerts: boolean
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_alerts?: boolean
          email_notifications?: boolean
          product_updates?: boolean
          research_complete?: boolean
          security_alerts?: boolean
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_alerts?: boolean
          email_notifications?: boolean
          product_updates?: boolean
          research_complete?: boolean
          security_alerts?: boolean
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_access_tokens: {
        Row: {
          audience: string | null
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          metadata: Json
          oauth_client_id: string
          refresh_token_id: string | null
          revoked_at: string | null
          scopes: string[]
          status: Database["public"]["Enums"]["oauth_token_status"]
          token_hash: string
          user_id: string
        }
        Insert: {
          audience?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          oauth_client_id: string
          refresh_token_id?: string | null
          revoked_at?: string | null
          scopes: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          token_hash: string
          user_id: string
        }
        Update: {
          audience?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          oauth_client_id?: string
          refresh_token_id?: string | null
          revoked_at?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_access_tokens_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_access_tokens_refresh_token_id_fkey"
            columns: ["refresh_token_id"]
            isOneToOne: false
            referencedRelation: "oauth_refresh_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorization_codes: {
        Row: {
          authorization_request_id: string | null
          code_challenge: string
          code_challenge_method: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          nonce_hash: string | null
          oauth_client_id: string
          redirect_uri: string
          scopes: string[]
          status: Database["public"]["Enums"]["oauth_token_status"]
          user_id: string
        }
        Insert: {
          authorization_request_id?: string | null
          code_challenge: string
          code_challenge_method?: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce_hash?: string | null
          oauth_client_id: string
          redirect_uri: string
          scopes: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_id: string
        }
        Update: {
          authorization_request_id?: string | null
          code_challenge?: string
          code_challenge_method?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce_hash?: string | null
          oauth_client_id?: string
          redirect_uri?: string
          scopes?: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_authorization_request_id_fkey"
            columns: ["authorization_request_id"]
            isOneToOne: false
            referencedRelation: "oauth_authorization_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorization_codes_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorization_requests: {
        Row: {
          code_challenge: string
          code_challenge_method: string
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          metadata: Json
          nonce_hash: string | null
          oauth_client_id: string
          redirect_uri: string
          scopes: string[]
          state_hash: string | null
          status: Database["public"]["Enums"]["oauth_token_status"]
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          code_challenge: string
          code_challenge_method?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          nonce_hash?: string | null
          oauth_client_id: string
          redirect_uri: string
          scopes: string[]
          state_hash?: string | null
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          code_challenge?: string
          code_challenge_method?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          nonce_hash?: string | null
          oauth_client_id?: string
          redirect_uri?: string
          scopes?: string[]
          state_hash?: string | null
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_requests_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_client_redirect_uris: {
        Row: {
          created_at: string
          id: string
          oauth_client_id: string
          redirect_uri: string
        }
        Insert: {
          created_at?: string
          id?: string
          oauth_client_id: string
          redirect_uri: string
        }
        Update: {
          created_at?: string
          id?: string
          oauth_client_id?: string
          redirect_uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_client_redirect_uris_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          allowed_grant_types: string[]
          allowed_origins: string[]
          allowed_response_types: string[]
          client_id: string
          client_secret_hash: string | null
          client_type: Database["public"]["Enums"]["oauth_client_type"]
          created_at: string
          deleted_at: string | null
          description: string | null
          first_party: boolean
          homepage_url: string | null
          id: string
          jwks: Json
          logo_url: string | null
          metadata: Json
          name: string
          owner_user_id: string | null
          privacy_url: string | null
          require_pkce: boolean
          status: Database["public"]["Enums"]["oauth_client_status"]
          terms_url: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          allowed_grant_types?: string[]
          allowed_origins?: string[]
          allowed_response_types?: string[]
          client_id: string
          client_secret_hash?: string | null
          client_type?: Database["public"]["Enums"]["oauth_client_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          first_party?: boolean
          homepage_url?: string | null
          id?: string
          jwks?: Json
          logo_url?: string | null
          metadata?: Json
          name: string
          owner_user_id?: string | null
          privacy_url?: string | null
          require_pkce?: boolean
          status?: Database["public"]["Enums"]["oauth_client_status"]
          terms_url?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          allowed_grant_types?: string[]
          allowed_origins?: string[]
          allowed_response_types?: string[]
          client_id?: string
          client_secret_hash?: string | null
          client_type?: Database["public"]["Enums"]["oauth_client_type"]
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          first_party?: boolean
          homepage_url?: string | null
          id?: string
          jwks?: Json
          logo_url?: string | null
          metadata?: Json
          name?: string
          owner_user_id?: string | null
          privacy_url?: string | null
          require_pkce?: boolean
          status?: Database["public"]["Enums"]["oauth_client_status"]
          terms_url?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_consent_grants: {
        Row: {
          claims: Json
          expires_at: string | null
          granted_at: string
          id: string
          metadata: Json
          oauth_client_id: string
          revoked_at: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          claims?: Json
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json
          oauth_client_id: string
          revoked_at?: string | null
          scopes: string[]
          user_id: string
        }
        Update: {
          claims?: Json
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json
          oauth_client_id?: string
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consent_grants_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_device_codes: {
        Row: {
          approved_at: string | null
          consumed_at: string | null
          created_at: string
          device_code_hash: string
          expires_at: string
          id: string
          interval_seconds: number
          metadata: Json
          oauth_client_id: string
          scopes: string[]
          status: Database["public"]["Enums"]["oauth_token_status"]
          user_code_hash: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          consumed_at?: string | null
          created_at?: string
          device_code_hash: string
          expires_at?: string
          id?: string
          interval_seconds?: number
          metadata?: Json
          oauth_client_id: string
          scopes: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_code_hash: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          consumed_at?: string | null
          created_at?: string
          device_code_hash?: string
          expires_at?: string
          id?: string
          interval_seconds?: number
          metadata?: Json
          oauth_client_id?: string
          scopes?: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_code_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_device_codes_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          oauth_client_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          oauth_client_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          oauth_client_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_events_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_jwks: {
        Row: {
          algorithm: string
          created_at: string
          id: string
          key_id: string
          metadata: Json
          not_after: string | null
          not_before: string
          private_secret_ref: string | null
          public_jwk: Json
          status: string
        }
        Insert: {
          algorithm?: string
          created_at?: string
          id?: string
          key_id: string
          metadata?: Json
          not_after?: string | null
          not_before?: string
          private_secret_ref?: string | null
          public_jwk: Json
          status?: string
        }
        Update: {
          algorithm?: string
          created_at?: string
          id?: string
          key_id?: string
          metadata?: Json
          not_after?: string | null
          not_before?: string
          private_secret_ref?: string | null
          public_jwk?: Json
          status?: string
        }
        Relationships: []
      }
      oauth_refresh_token_families: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          oauth_client_id: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["oauth_token_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          oauth_client_id: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          oauth_client_id?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["oauth_token_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_refresh_token_families_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_refresh_tokens: {
        Row: {
          created_at: string
          expires_at: string
          family_id: string
          id: string
          last_used_at: string | null
          metadata: Json
          oauth_client_id: string
          revoked_at: string | null
          rotated_from_token_id: string | null
          rotated_to_token_id: string | null
          scopes: string[]
          status: Database["public"]["Enums"]["oauth_token_status"]
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          family_id: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          oauth_client_id: string
          revoked_at?: string | null
          rotated_from_token_id?: string | null
          rotated_to_token_id?: string | null
          scopes: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          family_id?: string
          id?: string
          last_used_at?: string | null
          metadata?: Json
          oauth_client_id?: string
          revoked_at?: string | null
          rotated_from_token_id?: string | null
          rotated_to_token_id?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["oauth_token_status"]
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_refresh_tokens_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "oauth_refresh_token_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_refresh_tokens_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_refresh_tokens_rotated_from_token_id_fkey"
            columns: ["rotated_from_token_id"]
            isOneToOne: false
            referencedRelation: "oauth_refresh_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_refresh_tokens_rotated_to_token_id_fkey"
            columns: ["rotated_to_token_id"]
            isOneToOne: false
            referencedRelation: "oauth_refresh_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_scopes: {
        Row: {
          claim_names: string[]
          created_at: string
          description: string
          is_default: boolean
          is_sensitive: boolean
          key: string
        }
        Insert: {
          claim_names?: string[]
          created_at?: string
          description: string
          is_default?: boolean
          is_sensitive?: boolean
          key: string
        }
        Update: {
          claim_names?: string[]
          created_at?: string
          description?: string
          is_default?: boolean
          is_sensitive?: boolean
          key?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string
          card_first4: string | null
          card_last4: string | null
          created_at: string
          display_label: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last_payment_id: string | null
          mandate_max_amount_paise: number | null
          mandate_status: string | null
          method_type: string
          network: string
          provider_ref_encrypted: string
          provider_ref_fingerprint: string
          razorpay_customer_id: string | null
          updated_at: string
          upi_vpa: string | null
          user_id: string
        }
        Insert: {
          brand?: string
          card_first4?: string | null
          card_last4?: string | null
          created_at?: string
          display_label?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last_payment_id?: string | null
          mandate_max_amount_paise?: number | null
          mandate_status?: string | null
          method_type?: string
          network: string
          provider_ref_encrypted: string
          provider_ref_fingerprint: string
          razorpay_customer_id?: string | null
          updated_at?: string
          upi_vpa?: string | null
          user_id: string
        }
        Update: {
          brand?: string
          card_first4?: string | null
          card_last4?: string | null
          created_at?: string
          display_label?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last_payment_id?: string | null
          mandate_max_amount_paise?: number | null
          mandate_status?: string | null
          method_type?: string
          network?: string
          provider_ref_encrypted?: string
          provider_ref_fingerprint?: string
          razorpay_customer_id?: string | null
          updated_at?: string
          upi_vpa?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pinned_chats: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          position: number
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          position?: number
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_chats_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_metadata: Json
          burst_multiplier: number
          business_controls_enabled: boolean
          created_at: string
          currency: string
          dedicated_capacity_eligible: boolean
          display_name: string
          effective_from: string
          enterprise_controls_enabled: boolean
          features: Json
          giftable: boolean
          governance_notes: string | null
          highest_priority_eligible: boolean
          id: string
          is_active: boolean
          limits: Json
          model_access_policy: Json
          name: string
          peak_priority_weight: number
          peak_time_policy: Json
          plus_highest_priority_blocked: boolean
          price_paise_monthly: number
          price_paise_yearly: number
          priority_rank: number
          queue_jump_allowed: boolean
          rate_limit_policy: Json
          service_level: string
          soft_limit_multiplier: number
          sort_order: number
          support_response_sla_minutes: number | null
          token_grant: number
          training_default_opt_in_allowed: boolean
          training_policy: Json
          updated_at: string
          yearly_supported: boolean
        }
        Insert: {
          billing_metadata?: Json
          burst_multiplier?: number
          business_controls_enabled?: boolean
          created_at?: string
          currency?: string
          dedicated_capacity_eligible?: boolean
          display_name: string
          effective_from?: string
          enterprise_controls_enabled?: boolean
          features?: Json
          giftable?: boolean
          governance_notes?: string | null
          highest_priority_eligible?: boolean
          id: string
          is_active?: boolean
          limits?: Json
          model_access_policy?: Json
          name: string
          peak_priority_weight?: number
          peak_time_policy?: Json
          plus_highest_priority_blocked?: boolean
          price_paise_monthly?: number
          price_paise_yearly?: number
          priority_rank?: number
          queue_jump_allowed?: boolean
          rate_limit_policy?: Json
          service_level?: string
          soft_limit_multiplier?: number
          sort_order?: number
          support_response_sla_minutes?: number | null
          token_grant?: number
          training_default_opt_in_allowed?: boolean
          training_policy?: Json
          updated_at?: string
          yearly_supported?: boolean
        }
        Update: {
          billing_metadata?: Json
          burst_multiplier?: number
          business_controls_enabled?: boolean
          created_at?: string
          currency?: string
          dedicated_capacity_eligible?: boolean
          display_name?: string
          effective_from?: string
          enterprise_controls_enabled?: boolean
          features?: Json
          giftable?: boolean
          governance_notes?: string | null
          highest_priority_eligible?: boolean
          id?: string
          is_active?: boolean
          limits?: Json
          model_access_policy?: Json
          name?: string
          peak_priority_weight?: number
          peak_time_policy?: Json
          plus_highest_priority_blocked?: boolean
          price_paise_monthly?: number
          price_paise_yearly?: number
          priority_rank?: number
          queue_jump_allowed?: boolean
          rate_limit_policy?: Json
          service_level?: string
          soft_limit_multiplier?: number
          sort_order?: number
          support_response_sla_minutes?: number | null
          token_grant?: number
          training_default_opt_in_allowed?: boolean
          training_policy?: Json
          updated_at?: string
          yearly_supported?: boolean
        }
        Relationships: []
      }
      plugin_collections: {
        Row: {
          created_at: string
          plugin_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plugin_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          plugin_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_kind: string
          acquisition_source: string | null
          avatar_file_id: string | null
          avatar_storage_bucket: string | null
          avatar_storage_path: string | null
          avatar_updated_at: string | null
          avatar_url: string | null
          compliance_region: string | null
          created_at: string
          default_workspace_id: string | null
          display_name: string | null
          email: string | null
          id: string
          lifecycle_stage: string
          locale: string
          metadata: Json
          organization_role: string | null
          preferred_name: string | null
          residency_region: string | null
          risk_tier: string
          timezone: string
          training_consent_scope: string
          training_consent_source: string | null
          training_consent_updated_at: string | null
          training_eligibility_default: boolean
          updated_at: string
          user_segment: string | null
        }
        Insert: {
          account_kind?: string
          acquisition_source?: string | null
          avatar_file_id?: string | null
          avatar_storage_bucket?: string | null
          avatar_storage_path?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          compliance_region?: string | null
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          lifecycle_stage?: string
          locale?: string
          metadata?: Json
          organization_role?: string | null
          preferred_name?: string | null
          residency_region?: string | null
          risk_tier?: string
          timezone?: string
          training_consent_scope?: string
          training_consent_source?: string | null
          training_consent_updated_at?: string | null
          training_eligibility_default?: boolean
          updated_at?: string
          user_segment?: string | null
        }
        Update: {
          account_kind?: string
          acquisition_source?: string | null
          avatar_file_id?: string | null
          avatar_storage_bucket?: string | null
          avatar_storage_path?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          compliance_region?: string | null
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          lifecycle_stage?: string
          locale?: string
          metadata?: Json
          organization_role?: string | null
          preferred_name?: string | null
          residency_region?: string | null
          risk_tier?: string
          timezone?: string
          training_consent_scope?: string
          training_consent_source?: string | null
          training_consent_updated_at?: string | null
          training_eligibility_default?: boolean
          updated_at?: string
          user_segment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_file_id_fkey"
            columns: ["avatar_file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_workspace_fk"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          metadata: Json
          name: string
          status: string
          system_prompt: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          metadata?: Json
          name: string
          status?: string
          system_prompt?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          metadata?: Json
          name?: string
          status?: string
          system_prompt?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_capacity_windows: {
        Row: {
          capacity_pool: string | null
          created_at: string
          error_rate: number | null
          health_state: string
          id: string
          max_concurrency: number | null
          max_qps: number | null
          model_family: string | null
          model_id: string | null
          nomita_payload: Json
          observed_concurrency: number | null
          observed_qps: number | null
          provider: string
          queue_depth: number | null
          recommended_priority_floor: number | null
          recommended_throttle_policy: string | null
          region: string | null
          saturation_ratio: number | null
          throttle_rate: number | null
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          capacity_pool?: string | null
          created_at?: string
          error_rate?: number | null
          health_state?: string
          id?: string
          max_concurrency?: number | null
          max_qps?: number | null
          model_family?: string | null
          model_id?: string | null
          nomita_payload?: Json
          observed_concurrency?: number | null
          observed_qps?: number | null
          provider?: string
          queue_depth?: number | null
          recommended_priority_floor?: number | null
          recommended_throttle_policy?: string | null
          region?: string | null
          saturation_ratio?: number | null
          throttle_rate?: number | null
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          capacity_pool?: string | null
          created_at?: string
          error_rate?: number | null
          health_state?: string
          id?: string
          max_concurrency?: number | null
          max_qps?: number | null
          model_family?: string | null
          model_id?: string | null
          nomita_payload?: Json
          observed_concurrency?: number | null
          observed_qps?: number | null
          provider?: string
          queue_depth?: number | null
          recommended_priority_floor?: number | null
          recommended_throttle_policy?: string | null
          region?: string | null
          saturation_ratio?: number | null
          throttle_rate?: number | null
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      provider_health_checks: {
        Row: {
          capacity_pool: string | null
          checked_at: string
          circuit_state: string
          degraded_reason: string | null
          error_message: string | null
          error_rate: number | null
          expires_at: string | null
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          latency_ms: number | null
          max_qps: number | null
          metadata: Json
          model_id: string | null
          nomita_status_payload: Json
          observed_qps: number | null
          p50_latency_ms: number | null
          p95_latency_ms: number | null
          p99_latency_ms: number | null
          provider: string
          queue_depth: number | null
          recommended_action: string | null
          region: string | null
          saturation_ratio: number | null
          status: string
          throttle_rate: number | null
        }
        Insert: {
          capacity_pool?: string | null
          checked_at?: string
          circuit_state?: string
          degraded_reason?: string | null
          error_message?: string | null
          error_rate?: number | null
          expires_at?: string | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          max_qps?: number | null
          metadata?: Json
          model_id?: string | null
          nomita_status_payload?: Json
          observed_qps?: number | null
          p50_latency_ms?: number | null
          p95_latency_ms?: number | null
          p99_latency_ms?: number | null
          provider: string
          queue_depth?: number | null
          recommended_action?: string | null
          region?: string | null
          saturation_ratio?: number | null
          status: string
          throttle_rate?: number | null
        }
        Update: {
          capacity_pool?: string | null
          checked_at?: string
          circuit_state?: string
          degraded_reason?: string | null
          error_message?: string | null
          error_rate?: number | null
          expires_at?: string | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          max_qps?: number | null
          metadata?: Json
          model_id?: string | null
          nomita_status_payload?: Json
          observed_qps?: number | null
          p50_latency_ms?: number | null
          p95_latency_ms?: number | null
          p99_latency_ms?: number | null
          provider?: string
          queue_depth?: number | null
          recommended_action?: string | null
          region?: string | null
          saturation_ratio?: number | null
          status?: string
          throttle_rate?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string | null
          burst_limit: number | null
          concurrency_in_use: number
          concurrency_limit: number | null
          count: number
          created_at: string
          enforcement_metadata: Json
          highest_priority: boolean
          id: string
          identifier: string
          last_enforced_at: string | null
          last_request: number
          model_id: string | null
          peak_window: boolean
          plan_id: string | null
          priority_rank: number
          provider: string | null
          queue_entered_at: string | null
          queue_position: number | null
          refill_rate: number | null
          service_level: string | null
          subject_id: string | null
          subject_type: string | null
          sustained_limit: number | null
          throttle_reason: string | null
          tokens_remaining: number | null
          updated_at: string
          user_id: string | null
          window_start: number
          workspace_id: string | null
        }
        Insert: {
          action?: string | null
          burst_limit?: number | null
          concurrency_in_use?: number
          concurrency_limit?: number | null
          count?: number
          created_at?: string
          enforcement_metadata?: Json
          highest_priority?: boolean
          id: string
          identifier: string
          last_enforced_at?: string | null
          last_request: number
          model_id?: string | null
          peak_window?: boolean
          plan_id?: string | null
          priority_rank?: number
          provider?: string | null
          queue_entered_at?: string | null
          queue_position?: number | null
          refill_rate?: number | null
          service_level?: string | null
          subject_id?: string | null
          subject_type?: string | null
          sustained_limit?: number | null
          throttle_reason?: string | null
          tokens_remaining?: number | null
          updated_at?: string
          user_id?: string | null
          window_start: number
          workspace_id?: string | null
        }
        Update: {
          action?: string | null
          burst_limit?: number | null
          concurrency_in_use?: number
          concurrency_limit?: number | null
          count?: number
          created_at?: string
          enforcement_metadata?: Json
          highest_priority?: boolean
          id?: string
          identifier?: string
          last_enforced_at?: string | null
          last_request?: number
          model_id?: string | null
          peak_window?: boolean
          plan_id?: string | null
          priority_rank?: number
          provider?: string | null
          queue_entered_at?: string | null
          queue_position?: number | null
          refill_rate?: number | null
          service_level?: string | null
          subject_id?: string | null
          subject_type?: string | null
          sustained_limit?: number | null
          throttle_reason?: string | null
          tokens_remaining?: number | null
          updated_at?: string
          user_id?: string | null
          window_start?: number
          workspace_id?: string | null
        }
        Relationships: []
      }
      razorpay_webhook_events: {
        Row: {
          event: string
          event_id: string
          id: string
          order_id: string | null
          payment_id: string | null
          received_at: string
          status: string
        }
        Insert: {
          event: string
          event_id: string
          id: string
          order_id?: string | null
          payment_id?: string | null
          received_at?: string
          status: string
        }
        Update: {
          event?: string
          event_id?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      research_runs: {
        Row: {
          chat_id: string | null
          created_at: string
          error: Json | null
          id: string
          objective: string
          processor: string
          provider: string
          provider_run_id: string
          result: Json | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          objective: string
          processor?: string
          provider?: string
          provider_run_id: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          objective?: string
          processor?: string
          provider?: string
          provider_run_id?: string
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          created_at: string
          excerpt: string | null
          id: string
          metadata: Json
          published_at: string | null
          publisher: string | null
          research_run_id: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          published_at?: string | null
          publisher?: string | null
          research_run_id: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          published_at?: string | null
          publisher?: string | null
          research_run_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_research_run_id_fkey"
            columns: ["research_run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_policy_rules: {
        Row: {
          action: string
          category: string
          created_at: string
          id: string
          is_enabled: boolean
          key: string
          rule: Json
          severity: number
          updated_at: string
        }
        Insert: {
          action: string
          category: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          key: string
          rule?: Json
          severity?: number
          updated_at?: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          key?: string
          rule?: Json
          severity?: number
          updated_at?: string
        }
        Relationships: []
      }
      saved_prompts: {
        Row: {
          created_at: string
          id: string
          prompt: string
          title: string
          updated_at: string
          user_id: string
          variables: Json
          visibility: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          title: string
          updated_at?: string
          user_id: string
          variables?: Json
          visibility?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          title?: string
          updated_at?: string
          user_id?: string
          variables?: Json
          visibility?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_prompts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_task_runs: {
        Row: {
          attempt_count: number
          chat_id: string | null
          created_at: string
          error_message: string | null
          execution_key: string
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          metadata: Json
          queued_at: string
          scheduled_for: string
          started_at: string
          status: string
          summary: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          chat_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_key: string
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          metadata?: Json
          queued_at?: string
          scheduled_for: string
          started_at?: string
          status?: string
          summary?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          chat_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_key?: string
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          metadata?: Json
          queued_at?: string
          scheduled_for?: string
          started_at?: string
          status?: string
          summary?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_task_runs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "scheduled_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_task_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_tasks: {
        Row: {
          attachment_refs: Json
          connector_ids: string[]
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          expires_at: string | null
          frequency: string
          id: string
          last_chat_id: string | null
          last_run_at: string | null
          last_run_status: string | null
          lease_run_id: string | null
          lease_until: string | null
          metadata: Json
          model_mode: string
          name: string
          next_run_at: string | null
          notification_mode: string
          project_id: string | null
          requirement: string
          run_count: number
          run_date: string | null
          skill_ids: string[]
          source: string
          status: string
          time_local: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_refs?: Json
          connector_ids?: string[]
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          expires_at?: string | null
          frequency: string
          id?: string
          last_chat_id?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          lease_run_id?: string | null
          lease_until?: string | null
          metadata?: Json
          model_mode?: string
          name: string
          next_run_at?: string | null
          notification_mode?: string
          project_id?: string | null
          requirement: string
          run_count?: number
          run_date?: string | null
          skill_ids?: string[]
          source?: string
          status?: string
          time_local: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_refs?: Json
          connector_ids?: string[]
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          expires_at?: string | null
          frequency?: string
          id?: string
          last_chat_id?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          lease_run_id?: string | null
          lease_until?: string | null
          metadata?: Json
          model_mode?: string
          name?: string
          next_run_at?: string | null
          notification_mode?: string
          project_id?: string | null
          requirement?: string
          run_count?: number
          run_date?: string | null
          skill_ids?: string[]
          source?: string
          status?: string
          time_local?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_tasks_last_chat_id_fkey"
            columns: ["last_chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_tasks_lease_run_id_fkey"
            columns: ["lease_run_id"]
            isOneToOne: false
            referencedRelation: "scheduled_task_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          status: string
          token_hash: string
          token_prefix: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          status?: string
          token_hash: string
          token_prefix: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          status?: string
          token_hash?: string
          token_prefix?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_connections: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          issuer_url: string | null
          metadata_url: string | null
          provider: string
          settings: Json
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          issuer_url?: string | null
          metadata_url?: string | null
          provider: string
          settings?: Json
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          issuer_url?: string | null
          metadata_url?: string | null
          provider?: string
          settings?: Json
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_purchases: {
        Row: {
          amount_paise: number
          amount_usd_micros: number
          created_at: string
          currency: string
          gigabytes: number
          id: string
          paid_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          amount_usd_micros: number
          created_at?: string
          currency?: string
          gigabytes: number
          id?: string
          paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          amount_usd_micros?: number
          created_at?: string
          currency?: string
          gigabytes?: number
          id?: string
          paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_activation_events: {
        Row: {
          billing_order_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          payment_id: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          source: string
          subscription_id: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          billing_order_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          payment_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          source: string
          subscription_id?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          billing_order_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          payment_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          source?: string
          subscription_id?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_activation_events_billing_order_id_fkey"
            columns: ["billing_order_id"]
            isOneToOne: false
            referencedRelation: "billing_orders"
            referencedColumns: ["razorpay_order_id"]
          },
          {
            foreignKeyName: "subscription_activation_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_activation_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_activation_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          admin_contact_email: string | null
          billing_cycle: string | null
          burst_credits_remaining: number | null
          business_unit: string | null
          cancel_at_period_end: boolean
          capacity_pool: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          enterprise_contract_id: string | null
          entitlement_notes: string | null
          highest_priority_active: boolean
          id: string
          last_priority_recalculated_at: string | null
          metadata: Json
          nomita_priority_group: string | null
          nomita_routing_metadata: Json
          peak_priority_weight_snapshot: number | null
          peak_usage_window_started_at: string | null
          plan_id: string | null
          priority_rank_snapshot: number | null
          provider: string
          provider_contract_metadata: Json
          provider_subscription_id: string | null
          seat_count: number | null
          service_level_snapshot: string | null
          status: string
          throttling_policy: string
          training_entitlement_snapshot: Json
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          admin_contact_email?: string | null
          billing_cycle?: string | null
          burst_credits_remaining?: number | null
          business_unit?: string | null
          cancel_at_period_end?: boolean
          capacity_pool?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          enterprise_contract_id?: string | null
          entitlement_notes?: string | null
          highest_priority_active?: boolean
          id?: string
          last_priority_recalculated_at?: string | null
          metadata?: Json
          nomita_priority_group?: string | null
          nomita_routing_metadata?: Json
          peak_priority_weight_snapshot?: number | null
          peak_usage_window_started_at?: string | null
          plan_id?: string | null
          priority_rank_snapshot?: number | null
          provider?: string
          provider_contract_metadata?: Json
          provider_subscription_id?: string | null
          seat_count?: number | null
          service_level_snapshot?: string | null
          status?: string
          throttling_policy?: string
          training_entitlement_snapshot?: Json
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          admin_contact_email?: string | null
          billing_cycle?: string | null
          burst_credits_remaining?: number | null
          business_unit?: string | null
          cancel_at_period_end?: boolean
          capacity_pool?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          enterprise_contract_id?: string | null
          entitlement_notes?: string | null
          highest_priority_active?: boolean
          id?: string
          last_priority_recalculated_at?: string | null
          metadata?: Json
          nomita_priority_group?: string | null
          nomita_routing_metadata?: Json
          peak_priority_weight_snapshot?: number | null
          peak_usage_window_started_at?: string | null
          plan_id?: string | null
          priority_rank_snapshot?: number | null
          provider?: string
          provider_contract_metadata?: Json
          provider_subscription_id?: string | null
          seat_count?: number | null
          service_level_snapshot?: string | null
          status?: string
          throttling_policy?: string
          training_entitlement_snapshot?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      token_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          billing_context: Json
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          model_id: string | null
          model_provider: string | null
          peak_window_id: string | null
          priority_rank: number | null
          request_id: string | null
          reservation_id: string | null
          service_level: string | null
          settlement_metadata: Json
          source: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          billing_context?: Json
          created_at?: string
          id: string
          idempotency_key?: string | null
          metadata?: Json
          model_id?: string | null
          model_provider?: string | null
          peak_window_id?: string | null
          priority_rank?: number | null
          request_id?: string | null
          reservation_id?: string | null
          service_level?: string | null
          settlement_metadata?: Json
          source: string
          type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          billing_context?: Json
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          model_id?: string | null
          model_provider?: string | null
          peak_window_id?: string | null
          priority_rank?: number | null
          request_id?: string | null
          reservation_id?: string | null
          service_level?: string | null
          settlement_metadata?: Json
          source?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_calls: {
        Row: {
          chat_id: string | null
          created_at: string
          error: Json | null
          id: string
          input: Json
          latency_ms: number | null
          message_id: string | null
          output: Json | null
          provider: string | null
          provider_call_id: string | null
          status: string
          tool_name: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          input?: Json
          latency_ms?: number | null
          message_id?: string | null
          output?: Json | null
          provider?: string | null
          provider_call_id?: string | null
          status?: string
          tool_name: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          input?: Json
          latency_ms?: number | null
          message_id?: string | null
          output?: Json | null
          provider?: string | null
          provider_call_id?: string | null
          status?: string
          tool_name?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_calls_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_calls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_daily_rollups: {
        Row: {
          average_latency_ms: number | null
          created_at: string
          estimated_cost_minor: number
          generation_count: number
          id: string
          input_tokens: number
          metadata: Json
          model_family: string | null
          model_id: string | null
          output_tokens: number
          p95_latency_ms: number | null
          peak_requests: number
          priority_rank: number | null
          provider: string | null
          provider_cost_amount: number | null
          rollup_metadata: Json
          service_level: string | null
          throttled_requests: number
          total_tokens: number
          training_blocked_events: number
          training_eligible_events: number
          updated_at: string
          usage_date: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          average_latency_ms?: number | null
          created_at?: string
          estimated_cost_minor?: number
          generation_count?: number
          id?: string
          input_tokens?: number
          metadata?: Json
          model_family?: string | null
          model_id?: string | null
          output_tokens?: number
          p95_latency_ms?: number | null
          peak_requests?: number
          priority_rank?: number | null
          provider?: string | null
          provider_cost_amount?: number | null
          rollup_metadata?: Json
          service_level?: string | null
          throttled_requests?: number
          total_tokens?: number
          training_blocked_events?: number
          training_eligible_events?: number
          updated_at?: string
          usage_date: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          average_latency_ms?: number | null
          created_at?: string
          estimated_cost_minor?: number
          generation_count?: number
          id?: string
          input_tokens?: number
          metadata?: Json
          model_family?: string | null
          model_id?: string | null
          output_tokens?: number
          p95_latency_ms?: number | null
          peak_requests?: number
          priority_rank?: number | null
          provider?: string | null
          provider_cost_amount?: number | null
          rollup_metadata?: Json
          service_level?: string | null
          throttled_requests?: number
          total_tokens?: number
          training_blocked_events?: number
          training_eligible_events?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_rollups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_days: {
        Row: {
          activity_date: string
          message_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date: string
          message_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          message_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          balance_audit_metadata: Json
          balance_policy: Json
          created_at: string
          enterprise_pool_tokens: number
          last_debit_at: string | null
          last_grant_at: string | null
          monthly_grant_tokens: number
          pending_debits: number
          promotional_tokens: number
          reserved_tokens: number
          rollover_tokens: number
          status: string
          tokens_consumed: number
          tokens_remaining: number
          tokens_total: number
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          balance_audit_metadata?: Json
          balance_policy?: Json
          created_at?: string
          enterprise_pool_tokens?: number
          last_debit_at?: string | null
          last_grant_at?: string | null
          monthly_grant_tokens?: number
          pending_debits?: number
          promotional_tokens?: number
          reserved_tokens?: number
          rollover_tokens?: number
          status?: string
          tokens_consumed?: number
          tokens_remaining?: number
          tokens_total?: number
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          balance_audit_metadata?: Json
          balance_policy?: Json
          created_at?: string
          enterprise_pool_tokens?: number
          last_debit_at?: string | null
          last_grant_at?: string | null
          monthly_grant_tokens?: number
          pending_debits?: number
          promotional_tokens?: number
          reserved_tokens?: number
          rollover_tokens?: number
          status?: string
          tokens_consumed?: number
          tokens_remaining?: number
          tokens_total?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_balances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clauxen_insights: {
        Row: {
          created_at: string
          self_growth_enabled: boolean
          self_growth_enabled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          self_growth_enabled?: boolean
          self_growth_enabled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          self_growth_enabled?: boolean
          self_growth_enabled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clauxen_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_files: {
        Row: {
          content_hash: string | null
          created_at: string
          folder_id: string | null
          id: string
          metadata: Json
          mime_type: string | null
          original_name: string
          project_id: string | null
          size_bytes: number
          status: string
          storage_bucket: string
          storage_path: string
          storage_url: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_name: string
          project_id?: string | null
          size_bytes?: number
          status?: string
          storage_bucket: string
          storage_path: string
          storage_url?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          original_name?: string
          project_id?: string | null
          size_bytes?: number
          status?: string
          storage_bucket?: string
          storage_path?: string
          storage_url?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_files_folder_owner_fk"
            columns: ["folder_id", "user_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "user_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memories: {
        Row: {
          archived_at: string | null
          confidence: number
          consent_snapshot: Json
          created_at: string
          data_classification: string
          extraction_policy_version: string | null
          id: string
          memory_type: string
          metadata: Json
          pii_detected: boolean
          pinned: boolean
          quality_score: number | null
          retention_expires_at: string | null
          review_metadata: Json
          source_message_id: string | null
          source_model_id: string | null
          status: string
          summary: string
          training_block_reason: string | null
          training_eligible: boolean
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          confidence?: number
          consent_snapshot?: Json
          created_at?: string
          data_classification?: string
          extraction_policy_version?: string | null
          id?: string
          memory_type?: string
          metadata?: Json
          pii_detected?: boolean
          pinned?: boolean
          quality_score?: number | null
          retention_expires_at?: string | null
          review_metadata?: Json
          source_message_id?: string | null
          source_model_id?: string | null
          status?: string
          summary: string
          training_block_reason?: string | null
          training_eligible?: boolean
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          confidence?: number
          consent_snapshot?: Json
          created_at?: string
          data_classification?: string
          extraction_policy_version?: string | null
          id?: string
          memory_type?: string
          metadata?: Json
          pii_detected?: boolean
          pinned?: boolean
          quality_score?: number | null
          retention_expires_at?: string | null
          review_metadata?: Json
          source_message_id?: string | null
          source_model_id?: string | null
          status?: string
          summary?: string
          training_block_reason?: string | null
          training_eligible?: boolean
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_objects: {
        Row: {
          bucket: string
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          metadata: Json
          object_path: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket: string
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          metadata?: Json
          object_path: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket?: string
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          metadata?: Json
          object_path?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          artifact_auto_open: boolean
          avatar_url: string | null
          chat_model_id: string | null
          consent_captured_at: string | null
          consent_captured_ip: unknown
          consent_captured_user_agent: string | null
          consent_evidence: Json
          consent_policy_version: string | null
          created_at: string
          data_retention_preference: string
          data_training_allowed_modalities: string[]
          data_training_blocked_categories: string[]
          data_training_opt_in: boolean
          data_training_opt_out_reason: string | null
          data_training_scope: string
          display_name: string | null
          email: string | null
          email_notifications: boolean
          language: string
          memory_enabled: boolean
          personalization_training_enabled: boolean
          privacy_review_reason: string | null
          privacy_review_required: boolean
          product_analytics_opt_in: boolean
          product_updates: boolean
          research_contact_opt_in: boolean
          response_style: string | null
          settings: Json
          theme: string
          timezone: string
          training_data_boundary: Json
          updated_at: string
          user_id: string
          web_search_enabled: boolean
        }
        Insert: {
          artifact_auto_open?: boolean
          avatar_url?: string | null
          chat_model_id?: string | null
          consent_captured_at?: string | null
          consent_captured_ip?: unknown
          consent_captured_user_agent?: string | null
          consent_evidence?: Json
          consent_policy_version?: string | null
          created_at?: string
          data_retention_preference?: string
          data_training_allowed_modalities?: string[]
          data_training_blocked_categories?: string[]
          data_training_opt_in?: boolean
          data_training_opt_out_reason?: string | null
          data_training_scope?: string
          display_name?: string | null
          email?: string | null
          email_notifications?: boolean
          language?: string
          memory_enabled?: boolean
          personalization_training_enabled?: boolean
          privacy_review_reason?: string | null
          privacy_review_required?: boolean
          product_analytics_opt_in?: boolean
          product_updates?: boolean
          research_contact_opt_in?: boolean
          response_style?: string | null
          settings?: Json
          theme?: string
          timezone?: string
          training_data_boundary?: Json
          updated_at?: string
          user_id: string
          web_search_enabled?: boolean
        }
        Update: {
          artifact_auto_open?: boolean
          avatar_url?: string | null
          chat_model_id?: string | null
          consent_captured_at?: string | null
          consent_captured_ip?: unknown
          consent_captured_user_agent?: string | null
          consent_evidence?: Json
          consent_policy_version?: string | null
          created_at?: string
          data_retention_preference?: string
          data_training_allowed_modalities?: string[]
          data_training_blocked_categories?: string[]
          data_training_opt_in?: boolean
          data_training_opt_out_reason?: string | null
          data_training_scope?: string
          display_name?: string | null
          email?: string | null
          email_notifications?: boolean
          language?: string
          memory_enabled?: boolean
          personalization_training_enabled?: boolean
          privacy_review_reason?: string | null
          privacy_review_required?: boolean
          product_analytics_opt_in?: boolean
          product_updates?: boolean
          research_contact_opt_in?: boolean
          response_style?: string | null
          settings?: Json
          theme?: string
          timezone?: string
          training_data_boundary?: Json
          updated_at?: string
          user_id?: string
          web_search_enabled?: boolean
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          primary_object_key: string | null
          source_format: string
          status: string
          storage_bucket: string
          storage_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          primary_object_key?: string | null
          source_format?: string
          status?: string
          storage_bucket: string
          storage_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          primary_object_key?: string | null
          source_format?: string
          status?: string
          storage_bucket?: string
          storage_prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_storage_balances: {
        Row: {
          extra_gb: number
          updated_at: string
          user_id: string
        }
        Insert: {
          extra_gb?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          extra_gb?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      workspace_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          verification_token_hash: string | null
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          verification_token_hash?: string | null
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          verification_token_hash?: string | null
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role?: string
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          role: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_roles: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          permissions: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          permissions?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          permissions?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          allow_member_invites: boolean
          allowed_models: string[]
          artifact_retention_days: number | null
          audit_export_enabled: boolean
          data_classification_default: string
          dedicated_capacity_pool: string | null
          default_model_id: string | null
          enterprise_training_lock: boolean
          last_governance_review_at: string | null
          legal_hold_enabled: boolean
          model_governance: Json
          nomita_workspace_routing: Json
          peak_priority_ceiling: number
          peak_priority_floor: number
          peak_priority_policy: string
          pii_handling_policy: string
          realtime_usage_visibility: string
          retention_policy_days: number | null
          settings: Json
          spending_limit: number | null
          training_allowed_modalities: string[]
          training_blocked_categories: string[]
          training_policy_version: string | null
          updated_at: string
          workspace_id: string
          workspace_training_opt_in: boolean
        }
        Insert: {
          allow_member_invites?: boolean
          allowed_models?: string[]
          artifact_retention_days?: number | null
          audit_export_enabled?: boolean
          data_classification_default?: string
          dedicated_capacity_pool?: string | null
          default_model_id?: string | null
          enterprise_training_lock?: boolean
          last_governance_review_at?: string | null
          legal_hold_enabled?: boolean
          model_governance?: Json
          nomita_workspace_routing?: Json
          peak_priority_ceiling?: number
          peak_priority_floor?: number
          peak_priority_policy?: string
          pii_handling_policy?: string
          realtime_usage_visibility?: string
          retention_policy_days?: number | null
          settings?: Json
          spending_limit?: number | null
          training_allowed_modalities?: string[]
          training_blocked_categories?: string[]
          training_policy_version?: string | null
          updated_at?: string
          workspace_id: string
          workspace_training_opt_in?: boolean
        }
        Update: {
          allow_member_invites?: boolean
          allowed_models?: string[]
          artifact_retention_days?: number | null
          audit_export_enabled?: boolean
          data_classification_default?: string
          dedicated_capacity_pool?: string | null
          default_model_id?: string | null
          enterprise_training_lock?: boolean
          last_governance_review_at?: string | null
          legal_hold_enabled?: boolean
          model_governance?: Json
          nomita_workspace_routing?: Json
          peak_priority_ceiling?: number
          peak_priority_floor?: number
          peak_priority_policy?: string
          pii_handling_policy?: string
          realtime_usage_visibility?: string
          retention_policy_days?: number | null
          settings?: Json
          spending_limit?: number | null
          training_allowed_modalities?: string[]
          training_blocked_categories?: string[]
          training_policy_version?: string | null
          updated_at?: string
          workspace_id?: string
          workspace_training_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          admin_notes: string | null
          billing_entity_name: string | null
          compliance_tier: string
          contractual_training_restrictions: Json
          created_at: string
          data_residency_region: string | null
          dpa_signed_at: string | null
          enterprise_account_id: string | null
          id: string
          metadata: Json
          name: string
          organization_type: string
          owner_id: string
          peak_priority_boost: number
          plan_id: string | null
          priority_tier: string
          security_review_status: string
          slug: string | null
          support_tier: string
          training_default_opt_in: boolean
          training_policy: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          billing_entity_name?: string | null
          compliance_tier?: string
          contractual_training_restrictions?: Json
          created_at?: string
          data_residency_region?: string | null
          dpa_signed_at?: string | null
          enterprise_account_id?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_type?: string
          owner_id: string
          peak_priority_boost?: number
          plan_id?: string | null
          priority_tier?: string
          security_review_status?: string
          slug?: string | null
          support_tier?: string
          training_default_opt_in?: boolean
          training_policy?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          billing_entity_name?: string | null
          compliance_tier?: string
          contractual_training_restrictions?: Json
          created_at?: string
          data_residency_region?: string | null
          dpa_signed_at?: string | null
          enterprise_account_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_type?: string
          owner_id?: string
          peak_priority_boost?: number
          plan_id?: string | null
          priority_tier?: string
          security_review_status?: string
          slug?: string | null
          support_tier?: string
          training_default_opt_in?: boolean
          training_policy?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      chat_transcripts_jsonl: {
        Row: {
          chat_id: string | null
          chat_title: string | null
          jsonl: string | null
          line_count: number | null
          started_at: string | null
          training_eligible: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_transcript_lines_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_chat_message: {
        Args: {
          p_branch_id?: string
          p_chat_id: string
          p_content: string
          p_content_json?: Json
          p_input_tokens?: number
          p_model_id?: string
          p_output_tokens?: number
          p_parent_message_id?: string
          p_role: string
        }
        Returns: {
          branch_id: string | null
          chat_id: string
          client_id: string | null
          contains_pii: boolean
          content: string | null
          content_json: Json
          content_search: unknown
          content_search_unaccent: unknown
          created_at: string
          error: Json | null
          finish_reason: string | null
          id: string
          input_tokens: number
          metadata: Json
          model_id: string | null
          output_tokens: number
          parent_message_id: string | null
          redaction_status: string
          role: string
          status: string
          token_count: number
          total_tokens: number | null
          training_eligible: boolean
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chat_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_chat_transcript_line: {
        Args: {
          p_chat_id: string
          p_message_id: string
          p_record: Json
          p_role: string
          p_schema_version?: string
          p_training_eligible?: boolean
          p_user_id: string
        }
        Returns: {
          chat_id: string
          created_at: string
          id: number
          message_id: string | null
          record: Json
          role: string
          schema_version: string
          seq: number
          training_eligible: boolean
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_transcript_lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_existing_auth_users: { Args: never; Returns: number }
      chat_id_exists: { Args: { p_id: string }; Returns: boolean }
      claim_chat_generation_job: {
        Args: {
          p_job_id: string
          p_running_stale_after?: string
          p_worker: string
        }
        Returns: {
          assistant_message_id: string | null
          attempt: number
          chat_id: string
          checkpoint: Json
          completed_at: string | null
          created_at: string
          error: string | null
          heartbeat_at: string
          id: string
          input: Json
          locked_at: string | null
          locked_by: string | null
          result: Json | null
          slice_index: number
          status: string
          updated_at: string
          user_id: string
          user_message_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chat_generation_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_chat: {
        Args: {
          p_model_id?: string
          p_project_id?: string
          p_title?: string
          p_workspace_id?: string
        }
        Returns: {
          active_leaf_message_id: string | null
          adaptive_thinking_enabled: boolean
          archived_at: string | null
          created_at: string
          id: string
          metadata: Json
          model_id: string | null
          project_id: string | null
          response_style: string | null
          starred: boolean
          status: string
          system_prompt: string | null
          title: string
          updated_at: string
          user_id: string
          web_search_enabled: boolean
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_default_workspace_for_user: {
        Args: { p_display_name: string; p_email: string; p_user_id: string }
        Returns: string
      }
      create_storage_object_record: {
        Args: {
          p_bucket: string
          p_content_type?: string
          p_file_name: string
          p_metadata?: Json
          p_object_path: string
        }
        Returns: {
          bucket: string
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          metadata: Json
          object_path: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_objects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_user_tokens: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_metadata?: Json
          p_source: string
          p_user_id: string
        }
        Returns: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          billing_context: Json
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          model_id: string | null
          model_provider: string | null
          peak_window_id: string | null
          priority_rank: number | null
          request_id: string | null
          reservation_id: string | null
          service_level: string | null
          settlement_metadata: Json
          source: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "token_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_profile_id: { Args: never; Returns: string }
      debit_user_tokens: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_model_id: string
          p_source: string
          p_user_id: string
        }
        Returns: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          billing_context: Json
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          model_id: string | null
          model_provider: string | null
          peak_window_id: string | null
          priority_rank: number | null
          request_id: string | null
          reservation_id: string | null
          service_level: string | null
          settlement_metadata: Json
          source: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "token_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enqueue_chat_job: {
        Args: { p_payload: Json; p_queue: string }
        Returns: number
      }
      ensure_updated_at_trigger: {
        Args: { p_table: unknown }
        Returns: undefined
      }
      expire_old_gift_codes: { Args: never; Returns: number }
      fetch_chat_messages_page: {
        Args: {
          p_chat_id: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_limit?: number
          p_user_id?: string
        }
        Returns: {
          chat_id: string
          client_id: string
          content: string
          content_json: Json
          created_at: string
          has_more: boolean
          id: string
          metadata: Json
          role: string
          status: string
        }[]
      }
      fetch_chat_thread_page: {
        Args: {
          p_chat_id: string
          p_depth_cursor?: number
          p_leaf?: string
          p_limit?: number
          p_user_id?: string
        }
        Returns: {
          chat_id: string
          client_id: string
          content: string
          content_json: Json
          created_at: string
          depth: number
          has_more: boolean
          id: string
          metadata: Json
          next_depth: number
          parent_message_id: string
          role: string
          status: string
          variant_count: number
          variant_index: number
        }[]
      }
      fulfill_billing_payment: {
        Args: {
          p_order_id: string
          p_payment_amount_paise?: number
          p_payment_contact: string
          p_payment_created_at: string
          p_payment_currency?: string
          p_payment_email: string
          p_payment_id: string
          p_payment_method: string
          p_payment_status: string
          p_provider_payload?: Json
          p_source: string
          p_webhook_event_id?: string
          p_webhook_event_name?: string
        }
        Returns: {
          gift_id: string
          order_id: string
          payment_id: string
          status: string
          subscription_id: string
          tokens_added: number
        }[]
      }
      gc_stale_streaming_messages: {
        Args: { p_older_than?: string }
        Returns: number
      }
      generate_gift_code: { Args: never; Returns: string }
      generate_gift_code_20: { Args: never; Returns: string }
      get_recent_chats: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          active_leaf_message_id: string | null
          adaptive_thinking_enabled: boolean
          archived_at: string | null
          created_at: string
          id: string
          metadata: Json
          model_id: string | null
          project_id: string | null
          response_style: string | null
          starred: boolean
          status: string
          system_prompt: string | null
          title: string
          updated_at: string
          user_id: string
          web_search_enabled: boolean
          workspace_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "chats"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      hash_gift_code: { Args: { p_code: string }; Returns: string }
      increment_numeric_field: {
        Args: {
          p_amount: number
          p_field_name: string
          p_row_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
      list_stalled_chat_generation_jobs: {
        Args: { p_limit?: number; p_running_stale_after?: string }
        Returns: {
          assistant_message_id: string | null
          attempt: number
          chat_id: string
          checkpoint: Json
          completed_at: string | null
          created_at: string
          error: string | null
          heartbeat_at: string
          id: string
          input: Json
          locked_at: string | null
          locked_by: string | null
          result: Json | null
          slice_index: number
          status: string
          updated_at: string
          user_id: string
          user_message_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "chat_generation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      match_document_chunks: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          chunk_id: string
          content: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      poke_generations_watchdog: { Args: never; Returns: number }
      queue_file_processing_job: {
        Args: { p_file_id: string; p_job_type?: string }
        Returns: {
          completed_at: string | null
          created_at: string
          error: Json | null
          file_id: string
          id: string
          job_type: string
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "file_processing_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      queue_gift_delivery: { Args: { p_gift_id: string }; Returns: string }
      record_model_usage: {
        Args: {
          p_chat_id: string
          p_input_tokens: number
          p_latency_ms?: number
          p_message_id: string
          p_metadata?: Json
          p_model_id: string
          p_output_tokens: number
          p_provider: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      redeem_gift_code: {
        Args: { p_code: string }
        Returns: {
          expires_at: string
          gift_id: string
          status: string
          subscription_id: string
          tokens_added: number
        }[]
      }
      replace_chat_transcript_lines: {
        Args: { p_chat_id: string; p_lines: Json; p_user_id: string }
        Returns: number
      }
      rollup_model_usage: {
        Args: { p_from?: string; p_to?: string }
        Returns: number
      }
      search_user_messages: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          chat_id: string
          content: string
          created_at: string
          message_id: string
          role: string
          title: string
        }[]
      }
      switch_chat_branch: {
        Args: { p_chat_id: string; p_target?: string; p_user_id?: string }
        Returns: string
      }
    }
    Enums: {
      artifact_kind:
        | "app"
        | "document"
        | "spreadsheet"
        | "presentation"
        | "image"
        | "code"
        | "other"
      billing_order_kind: "subscription" | "gift"
      chat_status: "active" | "archived" | "deleted"
      gift_status:
        | "pending_payment"
        | "purchased"
        | "redeemed"
        | "expired"
        | "cancelled"
        | "refunded"
      message_role: "system" | "user" | "assistant" | "tool"
      message_status:
        | "queued"
        | "streaming"
        | "complete"
        | "failed"
        | "cancelled"
      oauth_client_status: "draft" | "active" | "suspended" | "deleted"
      oauth_client_type: "confidential" | "public"
      oauth_token_status: "active" | "consumed" | "revoked" | "expired"
      payment_provider: "razorpay"
      processing_status:
        | "queued"
        | "running"
        | "complete"
        | "failed"
        | "cancelled"
      token_transaction_source:
        | "purchase"
        | "generation"
        | "chat"
        | "reward"
        | "web_search"
        | "web_extract"
        | "deep_research"
      workspace_member_role: "owner" | "admin" | "member" | "viewer"
      workspace_member_status: "active" | "invited" | "suspended" | "removed"
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
      artifact_kind: [
        "app",
        "document",
        "spreadsheet",
        "presentation",
        "image",
        "code",
        "other",
      ],
      billing_order_kind: ["subscription", "gift"],
      chat_status: ["active", "archived", "deleted"],
      gift_status: [
        "pending_payment",
        "purchased",
        "redeemed",
        "expired",
        "cancelled",
        "refunded",
      ],
      message_role: ["system", "user", "assistant", "tool"],
      message_status: [
        "queued",
        "streaming",
        "complete",
        "failed",
        "cancelled",
      ],
      oauth_client_status: ["draft", "active", "suspended", "deleted"],
      oauth_client_type: ["confidential", "public"],
      oauth_token_status: ["active", "consumed", "revoked", "expired"],
      payment_provider: ["razorpay"],
      processing_status: [
        "queued",
        "running",
        "complete",
        "failed",
        "cancelled",
      ],
      token_transaction_source: [
        "purchase",
        "generation",
        "chat",
        "reward",
        "web_search",
        "web_extract",
        "deep_research",
      ],
      workspace_member_role: ["owner", "admin", "member", "viewer"],
      workspace_member_status: ["active", "invited", "suspended", "removed"],
    },
  },
} as const

