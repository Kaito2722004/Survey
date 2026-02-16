import { supabase } from "@/integrations/supabase/client";

export type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  role: string;
  created_at: string;
  updated_at: string;
};

export const profilesService = {
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data as ProfileRow | null;
  },

  async create(payload: {
    user_id: string;
    email: string;
    name?: string | null;
    is_admin?: boolean;
    role?: string; // ✅ add this
  }) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: payload.user_id,
        email: payload.email,
        name: payload.name ?? null,
        is_admin: payload.is_admin ?? false,
        role: payload.role ?? "student",
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as ProfileRow;
  },

async updateByUserId(
  userId: string,
  patch: Partial<Pick<ProfileRow, "name" | "is_admin" | "role">>,
) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.is_admin !== undefined ? { is_admin: patch.is_admin } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data as ProfileRow;
  },
};
