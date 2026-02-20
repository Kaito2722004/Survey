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
  section_id: string | null; // ← renamed from semester_id
  teacher_id: string | null;
  deadline: string | null;
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

  async getBySectionAndTeacher(sectionId: string, teacherId: string) {
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("section_id", sectionId) // ← renamed from semester_id
      .eq("teacher_id", teacherId)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SurveyRow[];
  },

  async getBySectionId(sectionId: string) {
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("section_id", sectionId)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SurveyRow[];
  },

  async create(payload: {
    user_id: string;
    title: string;
    description?: string;
    section_id: string | null; // ← renamed from semester_id
    teacher_id: string | null;
    is_published?: boolean;
    deadline?: string | null;
  }) {
    const { data, error } = await supabase
      .from("surveys")
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        description: payload.description ?? null,
        section_id: payload.section_id, // ← renamed
        teacher_id: payload.teacher_id,
        is_published: payload.is_published ?? true,
        deadline: payload.deadline ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as SurveyRow;
  },
};
