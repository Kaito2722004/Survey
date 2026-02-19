// src/services/profiles.ts
import { supabase } from "@/integrations/supabase/client";

export type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  role: string | null;
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
    role?: string | null; // ✅ allow null
    organization_id?: string | null;
  }) {
    const insertRow: Record<string, any> = {
      user_id: payload.user_id,
      email: payload.email,
      name: payload.name ?? null,
      is_admin: payload.is_admin ?? false,
      organization_id: payload.organization_id ?? null,
    };

    // ✅ Only set role if provided. This allows DB to keep NULL.
    if (payload.role !== undefined) {
      insertRow.role = payload.role; // can be null
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) throw error;
    return data as ProfileRow;
  },

  async updateByUserId(
    userId: string,
    patch: Partial<
      Pick<ProfileRow, "name" | "is_admin" | "role" | "organization_id">
    >,
  ) {
    const updateRow: Record<string, any> = {};

    if (patch.name !== undefined) updateRow.name = patch.name;
    if (patch.is_admin !== undefined) updateRow.is_admin = patch.is_admin;
    if (patch.role !== undefined) updateRow.role = patch.role; // ✅ can set null intentionally
    if (patch.organization_id !== undefined)
      updateRow.organization_id = patch.organization_id;

    const { data, error } = await supabase
      .from("profiles")
      .update(updateRow)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data as ProfileRow;
  },
};