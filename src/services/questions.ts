import { supabase } from "@/integrations/supabase/client";

export type QuestionRow = {
  id: string;
  survey_id: string;
  type: string;
  title: string;
  options: string[] | null;
  required: boolean;
  order_index: number;
  created_at: string;
};

export const questionsService = {
  async getBySurvey(surveyId: string) {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("survey_id", surveyId)
      .order("order_index", { ascending: true });

    if (error) throw error;
    return (data ?? []) as QuestionRow[];
  },

  async create(payload: {
    survey_id: string;
    type: string;
    title: string;
    options?: string[];
    required?: boolean;
    order_index: number;
  }) {
    const { data, error } = await supabase
      .from("questions")
      .insert({
        survey_id: payload.survey_id,
        type: payload.type,
        title: payload.title,
        options: payload.options ?? null,
        required: payload.required ?? false,
        order_index: payload.order_index,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as QuestionRow;
  },

  async update(id: string, patch: Partial<Pick<QuestionRow, "title" | "type" | "options" | "required" | "order_index">>) {
    const { data, error } = await supabase
      .from("questions")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as QuestionRow;
  },

  async delete(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
  },
};
