export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          updated_at: string
          user_id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
          is_admin?: boolean
        }
        Relationships: []
      }

      semesters: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }

      semester_teachers: {
  Row: {
    id: string
    semester_id: string
    teacher_user_id: string | null
    teacher_id: string | null
    created_at: string
  }
  Insert: {
    id?: string
    semester_id: string
    teacher_user_id?: string | null
    teacher_id?: string | null
    created_at?: string
  }
  Update: {
    id?: string
    semester_id?: string
    teacher_user_id?: string | null
    teacher_id?: string | null
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "semester_teachers_semester_id_fkey"
      columns: ["semester_id"]
      isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "semester_teachers_teacher_id_fkey"
      columns: ["teacher_id"]
      isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },
  ]
}

      teachers: {
  Row: {
    id: string
    name: string
    email: string | null
    created_at: string
  }
  Insert: {
    id?: string
    name: string
    email?: string | null
    created_at?: string
  }
  Update: {
    id?: string
    name?: string
    email?: string | null
    created_at?: string
  }
  Relationships: []
}


      semester_students: {
        Row: {
          id: string
          semester_id: string
          student_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          semester_id: string
          student_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          semester_id?: string
          student_user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_students_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }

      questions: {
        Row: {
          created_at: string
          id: string
          options: string[] | null
          order_index: number
          required: boolean
          survey_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          options?: string[] | null
          order_index?: number
          required?: boolean
          survey_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          options?: string[] | null
          order_index?: number
          required?: boolean
          survey_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }

      survey_responses: {
        Row: {
          answers: Json
          id: string
          submitted_at: string
          survey_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          submitted_at?: string
          survey_id: string
        }
        Update: {
          answers?: Json
          id?: string
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }

      surveys: {
  Row: {
    created_at: string
    description: string | null
    id: string
    is_published: boolean
    response_count: number
    title: string
    updated_at: string
    user_id: string
    semester_id: string | null
    teacher_user_id: string | null
    teacher_id: string | null
  }
  Insert: {
    created_at?: string
    description?: string | null
    id?: string
    is_published?: boolean
    response_count?: number
    title: string
    updated_at?: string
    user_id: string
    semester_id?: string | null
    teacher_user_id?: string | null
    teacher_id?: string | null
  }
  Update: {
    created_at?: string
    description?: string | null
    id?: string
    is_published?: boolean
    response_count?: number
    title?: string
    updated_at?: string
    user_id?: string
    semester_id?: string | null
    teacher_user_id?: string | null
    teacher_id?: string | null
  }
  Relationships: [
    {
      foreignKeyName: "surveys_semester_id_fkey"
      columns: ["semester_id"]
      isOneToOne: false
      referencedRelation: "semesters"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "surveys_teacher_id_fkey"
      columns: ["teacher_id"]
      isOneToOne: false
      referencedRelation: "teachers"
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
