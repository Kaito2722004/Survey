import { supabase } from "@/integrations/supabase/client";

export type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  role: string;
  organization_id: string | null;
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
    role?: string;
    organization_id?: string | null;
  }) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        user_id: payload.user_id,
        email: payload.email,
        name: payload.name ?? null,
        is_admin: payload.is_admin ?? false,
        role: payload.role ?? "student",
        organization_id: payload.organization_id ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as ProfileRow;
  },

  async updateByUserId(
    userId: string,
    patch: Partial<Pick<ProfileRow, "name" | "is_admin" | "role" | "organization_id">>,
  ) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.is_admin !== undefined ? { is_admin: patch.is_admin } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.organization_id !== undefined ? { organization_id: patch.organization_id } : {}),
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data as ProfileRow;
  },
};