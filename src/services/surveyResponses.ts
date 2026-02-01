import { supabase } from "@/integrations/supabase/client";

export type SurveyResponseRow = {
  id: string;
  survey_id: string;
  answers: Record<string, any>;
  submitted_at: string;
};

export const surveyResponsesService = {
  async getBySurvey(surveyId: string) {
    const { data, error } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId)
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SurveyResponseRow[];
  },

  async submit(payload: { survey_id: string; answers: Record<string, any> }) {
    const { data, error } = await supabase
      .from("survey_responses")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data as SurveyResponseRow;
  },
};
