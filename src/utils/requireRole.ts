import supabase from "@/utils/supabase";

export async function requireAdmin() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single();

  if (error || !profile?.is_admin) {
    throw new Error("Admin access required");
  }

  return user;
}

export async function requireStudent() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");
  return user;
}
