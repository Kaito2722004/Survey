import { supabase } from "@/integrations/supabase/client";

export type SemesterRow = {
  id: string;
  name: string;
  created_at: string;
};

export const semestersService = {
  async getAll() {
    const { data, error } = await supabase
      .from("semesters")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SemesterRow[];
  },

  async create(name: string) {
    const { data, error } = await supabase
      .from("semesters")
      .insert({ name })
      .select("*")
      .single();

    if (error) throw error;
    return data as SemesterRow;
  },

  async delete(id: string) {
    const { error } = await supabase.from("semesters").delete().eq("id", id);
    if (error) throw error;
  },
};
