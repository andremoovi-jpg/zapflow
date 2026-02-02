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
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          permissions: string[] | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          permissions?: string[] | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          permissions?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          read_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_count: number | null
          audience_filter: Json | null
          audience_type: string | null
          batch_size: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          paused_at: string | null
          phone_number_id: string | null
          scheduled_at: string | null
          send_rate: number | null
          started_at: string | null
          stats: Json | null
          status: string | null
          template_id: string | null
          template_variables: Json | null
          timezone: string | null
          updated_at: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          audience_count?: number | null
          audience_filter?: Json | null
          audience_type?: string | null
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          paused_at?: string | null
          phone_number_id?: string | null
          scheduled_at?: string | null
          send_rate?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string | null
          template_id?: string | null
          template_variables?: Json | null
          timezone?: string | null
          updated_at?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          audience_count?: number | null
          audience_filter?: Json | null
          audience_type?: string | null
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          paused_at?: string | null
          phone_number_id?: string | null
          scheduled_at?: string | null
          send_rate?: number | null
          started_at?: string | null
          stats?: Json | null
          status?: string | null
          template_id?: string | null
          template_variables?: Json | null
          timezone?: string | null
          updated_at?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          conversation_state: string | null
          created_at: string | null
          current_flow_id: string | null
          current_node_id: string | null
          custom_fields: Json | null
          email: string | null
          first_interaction_at: string | null
          flow_context: Json | null
          id: string
          last_interaction_at: string | null
          name: string | null
          opted_in: boolean | null
          opted_in_at: string | null
          opted_out_at: string | null
          organization_id: string
          phone_number: string
          profile_picture_url: string | null
          tags: string[] | null
          total_messages_received: number | null
          total_messages_sent: number | null
          updated_at: string | null
          wa_id: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          conversation_state?: string | null
          created_at?: string | null
          current_flow_id?: string | null
          current_node_id?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_interaction_at?: string | null
          flow_context?: Json | null
          id?: string
          last_interaction_at?: string | null
          name?: string | null
          opted_in?: boolean | null
          opted_in_at?: string | null
          opted_out_at?: string | null
          organization_id: string
          phone_number: string
          profile_picture_url?: string | null
          tags?: string[] | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string | null
          wa_id?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          conversation_state?: string | null
          created_at?: string | null
          current_flow_id?: string | null
          current_node_id?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_interaction_at?: string | null
          flow_context?: Json | null
          id?: string
          last_interaction_at?: string | null
          name?: string | null
          opted_in?: boolean | null
          opted_in_at?: string | null
          opted_out_at?: string | null
          organization_id?: string
          phone_number?: string
          profile_picture_url?: string | null
          tags?: string[] | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string | null
          wa_id?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          active_flow_id: string | null
          assigned_to: string | null
          contact_id: string
          created_at: string | null
          flow_paused: boolean | null
          id: string
          last_message_at: string | null
          last_message_direction: string | null
          organization_id: string
          phone_number_id: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
          whatsapp_account_id: string | null
          window_expires_at: string | null
          window_type: string | null
        }
        Insert: {
          active_flow_id?: string | null
          assigned_to?: string | null
          contact_id: string
          created_at?: string | null
          flow_paused?: boolean | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          organization_id: string
          phone_number_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          whatsapp_account_id?: string | null
          window_expires_at?: string | null
          window_type?: string | null
        }
        Update: {
          active_flow_id?: string | null
          assigned_to?: string | null
          contact_id?: string
          created_at?: string | null
          flow_paused?: boolean | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          organization_id?: string
          phone_number_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
          whatsapp_account_id?: string | null
          window_expires_at?: string | null
          window_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_edges: {
        Row: {
          created_at: string | null
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          created_at?: string | null
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_node_id: string
        }
        Update: {
          created_at?: string | null
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_execution_logs: {
        Row: {
          error_message: string | null
          executed_at: string | null
          execution_id: string
          id: string
          input_data: Json | null
          node_id: string | null
          output_data: Json | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          execution_id: string
          id?: string
          input_data?: Json | null
          node_id?: string | null
          output_data?: Json | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          execution_id?: string
          id?: string
          input_data?: Json | null
          node_id?: string | null
          output_data?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "flow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_execution_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          error_message: string | null
          flow_id: string
          id: string
          started_at: string | null
          status: string | null
          trigger_data: Json | null
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          error_message?: string | null
          flow_id: string
          id?: string
          started_at?: string | null
          status?: string | null
          trigger_data?: Json | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          error_message?: string | null
          flow_id?: string
          id?: string
          started_at?: string | null
          status?: string | null
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          config: Json
          created_at: string | null
          flow_id: string
          id: string
          name: string | null
          position_x: number | null
          position_y: number | null
          type: string
        }
        Insert: {
          config: Json
          created_at?: string | null
          flow_id: string
          id?: string
          name?: string | null
          position_x?: number | null
          position_y?: number | null
          type: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          flow_id?: string
          id?: string
          name?: string | null
          position_x?: number | null
          position_y?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          failed_executions: number | null
          folder: string | null
          id: string
          is_active: boolean | null
          last_execution_at: string | null
          n8n_webhook_url: string | null
          n8n_workflow_id: string | null
          name: string
          organization_id: string
          published_at: string | null
          published_by: string | null
          status: string | null
          successful_executions: number | null
          total_executions: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
          version: number | null
          whatsapp_account_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          failed_executions?: number | null
          folder?: string | null
          id?: string
          is_active?: boolean | null
          last_execution_at?: string | null
          n8n_webhook_url?: string | null
          n8n_workflow_id?: string | null
          name: string
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          status?: string | null
          successful_executions?: number | null
          total_executions?: number | null
          trigger_config: Json
          trigger_type: string
          updated_at?: string | null
          version?: number | null
          whatsapp_account_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          failed_executions?: number | null
          folder?: string | null
          id?: string
          is_active?: boolean | null
          last_execution_at?: string | null
          n8n_webhook_url?: string | null
          n8n_workflow_id?: string | null
          name?: string
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: string | null
          successful_executions?: number | null
          total_executions?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
          version?: number | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flows_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string | null
          components: Json
          created_at: string | null
          example_values: Json | null
          id: string
          language: string
          name: string
          status: string | null
          synced_at: string | null
          template_id: string
          updated_at: string | null
          whatsapp_account_id: string
        }
        Insert: {
          category?: string | null
          components: Json
          created_at?: string | null
          example_values?: Json | null
          id?: string
          language: string
          name: string
          status?: string | null
          synced_at?: string | null
          template_id: string
          updated_at?: string | null
          whatsapp_account_id: string
        }
        Update: {
          category?: string | null
          components?: Json
          created_at?: string | null
          example_values?: Json | null
          id?: string
          language?: string
          name?: string
          status?: string | null
          synced_at?: string | null
          template_id?: string
          updated_at?: string | null
          whatsapp_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contact_id: string
          content: Json
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          status: string | null
          type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          contact_id: string
          content: Json
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          type: string
          whatsapp_message_id?: string | null
        }
        Update: {
          contact_id?: string
          content?: Json
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
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
          created_at: string | null
          id: string
          name: string
          plan: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      phone_number_metrics: {
        Row: {
          avg_delivery_time_ms: number | null
          id: string
          max_throughput_achieved: number | null
          messages_delivered: number | null
          messages_failed: number | null
          messages_read: number | null
          messages_sent: number | null
          period_start: string
          period_type: string
          phone_number_id: string | null
          rate_limit_hits: number | null
        }
        Insert: {
          avg_delivery_time_ms?: number | null
          id?: string
          max_throughput_achieved?: number | null
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_read?: number | null
          messages_sent?: number | null
          period_start: string
          period_type: string
          phone_number_id?: string | null
          rate_limit_hits?: number | null
        }
        Update: {
          avg_delivery_time_ms?: number | null
          id?: string
          max_throughput_achieved?: number | null
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_read?: number | null
          messages_sent?: number | null
          period_start?: string
          period_type?: string
          phone_number_id?: string | null
          rate_limit_hits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_number_metrics_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          is_default: boolean | null
          phone_number: string
          phone_number_id: string
          quality_rating: string | null
          status: string | null
          updated_at: string | null
          whatsapp_account_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_default?: boolean | null
          phone_number: string
          phone_number_id: string
          quality_rating?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_account_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_default?: boolean | null
          phone_number?: string
          phone_number_id?: string
          quality_rating?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      queue_metrics: {
        Row: {
          active: number | null
          avg_processing_time_ms: number | null
          completed: number | null
          delayed: number | null
          failed: number | null
          id: string
          recorded_at: string | null
          throughput_per_second: number | null
          waiting: number | null
          whatsapp_account_id: string | null
        }
        Insert: {
          active?: number | null
          avg_processing_time_ms?: number | null
          completed?: number | null
          delayed?: number | null
          failed?: number | null
          id?: string
          recorded_at?: string | null
          throughput_per_second?: number | null
          waiting?: number | null
          whatsapp_account_id?: string | null
        }
        Update: {
          active?: number | null
          avg_processing_time_ms?: number | null
          completed?: number | null
          delayed?: number | null
          failed?: number | null
          id?: string
          recorded_at?: string | null
          throughput_per_second?: number | null
          waiting?: number | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_metrics_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          error_message: string | null
          event_type: string | null
          id: string
          organization_id: string | null
          payload: Json | null
          processed: boolean | null
          received_at: string | null
          source: string | null
          whatsapp_account_id: string | null
        }
        Insert: {
          error_message?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          received_at?: string | null
          source?: string | null
          whatsapp_account_id?: string | null
        }
        Update: {
          error_message?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          received_at?: string | null
          source?: string | null
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          access_token_encrypted: string | null
          app_id: string | null
          app_secret_encrypted: string | null
          business_manager_id: string | null
          business_name: string | null
          business_vertical: string | null
          created_at: string | null
          health_status: string | null
          id: string
          last_error_message: string | null
          last_health_check_at: string | null
          messages_sent_today: number | null
          meta_data: Json | null
          name: string
          organization_id: string
          proxy_enabled: boolean | null
          proxy_password_encrypted: string | null
          proxy_type: string | null
          proxy_url: string | null
          proxy_username: string | null
          rate_limit_per_day: number | null
          rate_limit_per_second: number | null
          rate_limit_reset_at: string | null
          status: string | null
          updated_at: string | null
          waba_id: string
          webhook_secret: string | null
          webhook_url: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          app_id?: string | null
          app_secret_encrypted?: string | null
          business_manager_id?: string | null
          business_name?: string | null
          business_vertical?: string | null
          created_at?: string | null
          health_status?: string | null
          id?: string
          last_error_message?: string | null
          last_health_check_at?: string | null
          messages_sent_today?: number | null
          meta_data?: Json | null
          name: string
          organization_id: string
          proxy_enabled?: boolean | null
          proxy_password_encrypted?: string | null
          proxy_type?: string | null
          proxy_url?: string | null
          proxy_username?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_second?: number | null
          rate_limit_reset_at?: string | null
          status?: string | null
          updated_at?: string | null
          waba_id: string
          webhook_secret?: string | null
          webhook_url?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          app_id?: string | null
          app_secret_encrypted?: string | null
          business_manager_id?: string | null
          business_name?: string | null
          business_vertical?: string | null
          created_at?: string | null
          health_status?: string | null
          id?: string
          last_error_message?: string | null
          last_health_check_at?: string | null
          messages_sent_today?: number | null
          meta_data?: Json | null
          name?: string
          organization_id?: string
          proxy_enabled?: boolean | null
          proxy_password_encrypted?: string | null
          proxy_type?: string | null
          proxy_url?: string | null
          proxy_username?: string | null
          rate_limit_per_day?: number | null
          rate_limit_per_second?: number | null
          rate_limit_reset_at?: string | null
          status?: string | null
          updated_at?: string | null
          waba_id?: string
          webhook_secret?: string | null
          webhook_url?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_pools: {
        Row: {
          id: string
          organization_id: string
          name: string
          status: string | null
          rotation_strategy: string | null
          daily_limit_per_waba: number | null
          rate_limit_buffer: number | null
          max_failures_percent: number | null
          max_concurrent_wabas: number | null
          emergency_stop_failures: number | null
          pause_on_quality: string | null
          auto_resume: boolean | null
          resume_after_days: number | null
          min_quality_to_resume: string | null
          warmup_enabled: boolean | null
          warmup_days: number | null
          warmup_start_volume: number | null
          warmup_end_volume: number | null
          warmup_curve: string | null
          time_window_enabled: boolean | null
          time_window_start: string | null
          time_window_end: string | null
          timezone: string | null
          allowed_days: number[] | null
          min_delay_seconds: number | null
          max_delay_seconds: number | null
          cooldown_after_batch: number | null
          cooldown_duration_seconds: number | null
          total_messages_sent: number | null
          total_messages_today: number | null
          last_message_at: string | null
          consecutive_failures: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          status?: string | null
          rotation_strategy?: string | null
          daily_limit_per_waba?: number | null
          rate_limit_buffer?: number | null
          max_failures_percent?: number | null
          max_concurrent_wabas?: number | null
          emergency_stop_failures?: number | null
          pause_on_quality?: string | null
          auto_resume?: boolean | null
          resume_after_days?: number | null
          min_quality_to_resume?: string | null
          warmup_enabled?: boolean | null
          warmup_days?: number | null
          warmup_start_volume?: number | null
          warmup_end_volume?: number | null
          warmup_curve?: string | null
          time_window_enabled?: boolean | null
          time_window_start?: string | null
          time_window_end?: string | null
          timezone?: string | null
          allowed_days?: number[] | null
          min_delay_seconds?: number | null
          max_delay_seconds?: number | null
          cooldown_after_batch?: number | null
          cooldown_duration_seconds?: number | null
          total_messages_sent?: number | null
          total_messages_today?: number | null
          last_message_at?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          status?: string | null
          rotation_strategy?: string | null
          daily_limit_per_waba?: number | null
          rate_limit_buffer?: number | null
          max_failures_percent?: number | null
          max_concurrent_wabas?: number | null
          emergency_stop_failures?: number | null
          pause_on_quality?: string | null
          auto_resume?: boolean | null
          resume_after_days?: number | null
          min_quality_to_resume?: string | null
          warmup_enabled?: boolean | null
          warmup_days?: number | null
          warmup_start_volume?: number | null
          warmup_end_volume?: number | null
          warmup_curve?: string | null
          time_window_enabled?: boolean | null
          time_window_start?: string | null
          time_window_end?: string | null
          timezone?: string | null
          allowed_days?: number[] | null
          min_delay_seconds?: number | null
          max_delay_seconds?: number | null
          cooldown_after_batch?: number | null
          cooldown_duration_seconds?: number | null
          total_messages_sent?: number | null
          total_messages_today?: number | null
          last_message_at?: string | null
          consecutive_failures?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_pools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_pool_members: {
        Row: {
          id: string
          warming_pool_id: string
          whatsapp_account_id: string
          custom_daily_limit: number | null
          priority: number | null
          warmup_phase_day: number | null
          warmup_started_at: string | null
          current_daily_limit: number | null
          messages_sent_today: number | null
          messages_failed_today: number | null
          messages_delivered_today: number | null
          last_message_at: string | null
          status: string | null
          pause_reason: string | null
          paused_at: string | null
          current_quality: string | null
          quality_updated_at: string | null
          last_selected_at: string | null
          selection_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          warming_pool_id: string
          whatsapp_account_id: string
          custom_daily_limit?: number | null
          priority?: number | null
          warmup_phase_day?: number | null
          warmup_started_at?: string | null
          current_daily_limit?: number | null
          messages_sent_today?: number | null
          messages_failed_today?: number | null
          messages_delivered_today?: number | null
          last_message_at?: string | null
          status?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          current_quality?: string | null
          quality_updated_at?: string | null
          last_selected_at?: string | null
          selection_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          warming_pool_id?: string
          whatsapp_account_id?: string
          custom_daily_limit?: number | null
          priority?: number | null
          warmup_phase_day?: number | null
          warmup_started_at?: string | null
          current_daily_limit?: number | null
          messages_sent_today?: number | null
          messages_failed_today?: number | null
          messages_delivered_today?: number | null
          last_message_at?: string | null
          status?: string | null
          pause_reason?: string | null
          paused_at?: string | null
          current_quality?: string | null
          quality_updated_at?: string | null
          last_selected_at?: string | null
          selection_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_pool_members_warming_pool_id_fkey"
            columns: ["warming_pool_id"]
            isOneToOne: false
            referencedRelation: "warming_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_pool_members_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_pool_flows: {
        Row: {
          id: string
          warming_pool_id: string
          flow_id: string
          delay_days: number | null
          delay_hours: number | null
          sequence_order: number | null
          is_active: boolean | null
          only_if_engaged: boolean | null
          skip_if_replied: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          warming_pool_id: string
          flow_id: string
          delay_days?: number | null
          delay_hours?: number | null
          sequence_order?: number | null
          is_active?: boolean | null
          only_if_engaged?: boolean | null
          skip_if_replied?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          warming_pool_id?: string
          flow_id?: string
          delay_days?: number | null
          delay_hours?: number | null
          sequence_order?: number | null
          is_active?: boolean | null
          only_if_engaged?: boolean | null
          skip_if_replied?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_pool_flows_warming_pool_id_fkey"
            columns: ["warming_pool_id"]
            isOneToOne: false
            referencedRelation: "warming_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_pool_flows_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_contact_history: {
        Row: {
          id: string
          warming_pool_id: string
          contact_id: string
          whatsapp_account_id: string
          status: string | null
          flows_total: number | null
          flows_completed: number | null
          current_flow_id: string | null
          next_flow_at: string | null
          messages_sent: number | null
          messages_delivered: number | null
          messages_read: number | null
          messages_failed: number | null
          has_replied: boolean | null
          replied_at: string | null
          entered_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          warming_pool_id: string
          contact_id: string
          whatsapp_account_id: string
          status?: string | null
          flows_total?: number | null
          flows_completed?: number | null
          current_flow_id?: string | null
          next_flow_at?: string | null
          messages_sent?: number | null
          messages_delivered?: number | null
          messages_read?: number | null
          messages_failed?: number | null
          has_replied?: boolean | null
          replied_at?: string | null
          entered_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          warming_pool_id?: string
          contact_id?: string
          whatsapp_account_id?: string
          status?: string | null
          flows_total?: number | null
          flows_completed?: number | null
          current_flow_id?: string | null
          next_flow_at?: string | null
          messages_sent?: number | null
          messages_delivered?: number | null
          messages_read?: number | null
          messages_failed?: number | null
          has_replied?: boolean | null
          replied_at?: string | null
          entered_at?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_contact_history_warming_pool_id_fkey"
            columns: ["warming_pool_id"]
            isOneToOne: false
            referencedRelation: "warming_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_contact_history_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_contact_history_current_flow_id_fkey"
            columns: ["current_flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_events_log: {
        Row: {
          id: string
          warming_pool_id: string | null
          whatsapp_account_id: string | null
          contact_id: string | null
          event_type: string
          event_data: Json | null
          severity: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          warming_pool_id?: string | null
          whatsapp_account_id?: string | null
          contact_id?: string | null
          event_type: string
          event_data?: Json | null
          severity?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          warming_pool_id?: string | null
          whatsapp_account_id?: string | null
          contact_id?: string | null
          event_type?: string
          event_data?: Json | null
          severity?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_events_log_warming_pool_id_fkey"
            columns: ["warming_pool_id"]
            isOneToOne: false
            referencedRelation: "warming_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_events_log_whatsapp_account_id_fkey"
            columns: ["whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_events_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_member_messages: {
        Row: {
          id: string
          warming_pool_member_id: string
          sequence_order: number | null
          template_id: string | null
          template_name: string
          template_language: string | null
          template_variables: Json | null
          delay_days: number | null
          delay_hours: number | null
          delay_minutes: number | null
          only_if_no_reply: boolean | null
          skip_if_clicked: boolean | null
          require_previous_delivered: boolean | null
          is_active: boolean | null
          total_sent: number | null
          total_delivered: number | null
          total_read: number | null
          total_replied: number | null
          total_failed: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          warming_pool_member_id: string
          sequence_order?: number | null
          template_id?: string | null
          template_name: string
          template_language?: string | null
          template_variables?: Json | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_minutes?: number | null
          only_if_no_reply?: boolean | null
          skip_if_clicked?: boolean | null
          require_previous_delivered?: boolean | null
          is_active?: boolean | null
          total_sent?: number | null
          total_delivered?: number | null
          total_read?: number | null
          total_replied?: number | null
          total_failed?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          warming_pool_member_id?: string
          sequence_order?: number | null
          template_id?: string | null
          template_name?: string
          template_language?: string | null
          template_variables?: Json | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_minutes?: number | null
          only_if_no_reply?: boolean | null
          skip_if_clicked?: boolean | null
          require_previous_delivered?: boolean | null
          is_active?: boolean | null
          total_sent?: number | null
          total_delivered?: number | null
          total_read?: number | null
          total_replied?: number | null
          total_failed?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_member_messages_warming_pool_member_id_fkey"
            columns: ["warming_pool_member_id"]
            isOneToOne: false
            referencedRelation: "warming_pool_members"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_message_executions: {
        Row: {
          id: string
          warming_contact_history_id: string
          warming_member_message_id: string
          status: string | null
          scheduled_for: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          failed_at: string | null
          whatsapp_message_id: string | null
          error_message: string | null
          skip_reason: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          warming_contact_history_id: string
          warming_member_message_id: string
          status?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          failed_at?: string | null
          whatsapp_message_id?: string | null
          error_message?: string | null
          skip_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          warming_contact_history_id?: string
          warming_member_message_id?: string
          status?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          failed_at?: string | null
          whatsapp_message_id?: string | null
          error_message?: string | null
          skip_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warming_message_executions_warming_contact_history_id_fkey"
            columns: ["warming_contact_history_id"]
            isOneToOne: false
            referencedRelation: "warming_contact_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_message_executions_warming_member_message_id_fkey"
            columns: ["warming_member_message_id"]
            isOneToOne: false
            referencedRelation: "warming_member_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_metrics: { Args: { org_id: string }; Returns: Json }
      get_message_status_distribution: {
        Args: { org_id: string }
        Returns: Json
      }
      get_messages_per_day: { Args: { org_id: string }; Returns: Json }
      get_pending_conversations: {
        Args: { hours_threshold?: number; org_id: string }
        Returns: Json
      }
      get_phone_performance: {
        Args: { period_type_param?: string; phone_id: string }
        Returns: Json
      }
      get_queue_status: { Args: { waba_id: string }; Returns: Json }
      get_recent_activity: {
        Args: { limit_count?: number; org_id: string }
        Returns: Json
      }
      get_top_flows: {
        Args: { limit_count?: number; org_id: string }
        Returns: Json
      }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      select_warming_waba: {
        Args: { pool_id: string }
        Returns: string | null
      }
      calculate_warmup_daily_limit: {
        Args: { pool_id: string; member_id: string }
        Returns: number
      }
      reset_warming_daily_counters: {
        Args: Record<string, never>
        Returns: void
      }
      get_warming_pool_stats: {
        Args: { pool_id: string }
        Returns: Json
      }
      schedule_warming_messages: {
        Args: { p_contact_history_id: string; p_pool_member_id: string }
        Returns: void
      }
      get_pending_warming_messages: {
        Args: { p_limit?: number }
        Returns: {
          execution_id: string
          contact_history_id: string
          contact_id: string
          contact_phone: string
          contact_name: string
          waba_id: string
          waba_phone_id: string
          waba_token: string
          template_name: string
          template_language: string
          template_variables: Json
          only_if_no_reply: boolean
          pool_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "member" | "viewer"
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
      app_role: ["admin", "member", "viewer"],
    },
  },
} as const
