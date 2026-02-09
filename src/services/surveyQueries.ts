import { supabase } from "@/integrations/supabase/client";

export async function publishSurvey(surveyId: string) {
  const { error } = await supabase
    .from("surveys")
    .update({ is_published: true })
    .eq("id", surveyId);

  if (error) throw error;
}