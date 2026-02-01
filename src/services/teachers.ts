import { supabase } from "@/integrations/supabase/client";

export type Teacher = { id: string; name: string; email: string | null };

export const teachersService = {
  async getAll(): Promise<Teacher[]> {
    const { data, error } = await supabase
      .from("teachers")
      .select("id,name,email")
      .order("name");

    if (error) throw error;
    return data ?? [];
  },

  async create(name: string, email?: string | null): Promise<Teacher> {
    const { data, error } = await supabase
      .from("teachers")
      .insert({ name, email: email ?? null })
      .select("id,name,email")
      .single();

    if (error) throw error;
    return data!;
  },
};
