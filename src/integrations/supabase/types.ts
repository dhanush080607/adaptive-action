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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      contexts: {
        Row: {
          applied: boolean
          available_time: Json
          constraints: Json
          created_at: string
          dependencies: Json
          engine: string
          extracted_deadlines: Json
          extracted_goals: Json
          extracted_tasks: Json
          id: string
          progress: Json
          raw_input: string
          summary: string | null
          user_id: string
        }
        Insert: {
          applied?: boolean
          available_time?: Json
          constraints?: Json
          created_at?: string
          dependencies?: Json
          engine?: string
          extracted_deadlines?: Json
          extracted_goals?: Json
          extracted_tasks?: Json
          id?: string
          progress?: Json
          raw_input: string
          summary?: string | null
          user_id?: string
        }
        Update: {
          applied?: boolean
          available_time?: Json
          constraints?: Json
          created_at?: string
          dependencies?: Json
          engine?: string
          extracted_deadlines?: Json
          extracted_goals?: Json
          extracted_tasks?: Json
          id?: string
          progress?: Json
          raw_input?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          created_at: string
          due_at: string
          id: string
          importance: number
          related_task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at: string
          id?: string
          importance?: number
          related_task_id?: string | null
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: string
          importance?: number
          related_task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          actual_minutes: number | null
          created_at: string
          id: string
          kind: string
          note: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          task_id?: string | null
          user_id?: string
        }
        Update: {
          actual_minutes?: number | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          importance: number
          progress: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          importance?: number
          progress?: number
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          importance?: number
          progress?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_items: {
        Row: {
          created_at: string
          end_at: string
          estimated_minutes: number
          id: string
          kind: string
          plan_id: string
          position: number
          priority: string
          reason: string | null
          start_at: string
          status: string
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          estimated_minutes?: number
          id?: string
          kind?: string
          plan_id: string
          position?: number
          priority?: string
          reason?: string | null
          start_at: string
          status?: string
          task_id?: string | null
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          estimated_minutes?: number
          id?: string
          kind?: string
          plan_id?: string
          position?: number
          priority?: string
          reason?: string | null
          start_at?: string
          status?: string
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          available_minutes: number
          created_at: string
          engine: string
          id: string
          is_replan: boolean
          plan_date: string
          reasoning: string | null
          summary: string | null
          user_id: string
          warnings: Json
        }
        Insert: {
          available_minutes?: number
          created_at?: string
          engine?: string
          id?: string
          is_replan?: boolean
          plan_date?: string
          reasoning?: string | null
          summary?: string | null
          user_id?: string
          warnings?: Json
        }
        Update: {
          available_minutes?: number
          created_at?: string
          engine?: string
          id?: string
          is_replan?: boolean
          plan_date?: string
          reasoning?: string | null
          summary?: string | null
          user_id?: string
          warnings?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_minutes: number | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          depends_on: string[]
          description: string | null
          estimated_minutes: number
          goal_id: string | null
          id: string
          importance: number
          priority: string
          priority_score: number
          progress: number
          reasoning: string | null
          source: string
          status: string
          title: string
          updated_at: string
          urgency: number
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          depends_on?: string[]
          description?: string | null
          estimated_minutes?: number
          goal_id?: string | null
          id?: string
          importance?: number
          priority?: string
          priority_score?: number
          progress?: number
          reasoning?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          urgency?: number
          user_id?: string
        }
        Update: {
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          depends_on?: string[]
          description?: string | null
          estimated_minutes?: number
          goal_id?: string | null
          id?: string
          importance?: number
          priority?: string
          priority_score?: number
          progress?: number
          reasoning?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          urgency?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
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
