import { supabase } from "@/integrations/supabase/client";

export type SurveyRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  response_count: number;
  created_at: string;
  updated_at: string;
  semester_id: string | null;
  teacher_id: string | null;
};

export const surveysService = {
  async getById(id: string) {
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as SurveyRow;
  },

  async getByAdminUser(adminUserId: string) {
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("user_id", adminUserId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SurveyRow[];
  },

  async getBySemesterAndTeacher(semesterId: string, teacherId: string) {
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("semester_id", semesterId)
      .eq("teacher_id", teacherId)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SurveyRow[];
  },

  async create(payload: {
    user_id: string;
    title: string;
    description?: string;
    semester_id: string;
    teacher_id: string;
    is_published?: boolean;
  }) {
    const { data, error } = await supabase
      .from("surveys")
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        description: payload.description ?? null,
        semester_id: payload.semester_id,
        teacher_id: payload.teacher_id,
        is_published: payload.is_published ?? true,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as SurveyRow;
  },
};
