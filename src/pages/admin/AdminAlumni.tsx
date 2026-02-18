import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
  role: string | null;
  is_admin: boolean;
  created_at: string;
};

export default function AdminAlumni() {
  const [loading, setLoading] = useState(true);
  const [alumni, setAlumni] = useState<ProfileRow[]>([]);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,user_id,name,email,role,is_admin,created_at")
      .eq("is_admin", false)
      .eq("role", "alumni")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error(error.message);
      setAlumni([]);
      setLoading(false);
      return;
    }

    setAlumni((data ?? []) as ProfileRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (user_id: string, role: "student" | "alumni") => {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("user_id", user_id);

    if (error) {
      console.error(error);
      toast.error(error.message);
      return;
    }

    toast.success("Updated role");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Manage Alumni</h1>
          <p className="mt-1 text-muted-foreground">
            Alumni are users with <code>profiles.role = 'alumni'</code>. Not linked to semesters.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alumni accounts</h2>
            <Button variant="outline" onClick={load}>
              Refresh
            </Button>
          </div>

          {loading && <div className="mt-4 text-sm text-muted-foreground">Loading...</div>}

          {!loading && alumni.length === 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              No alumni found yet. (A user becomes alumni when their role is set to "alumni".)
            </div>
          )}

          <div className="mt-4 space-y-3">
            {alumni.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{p.name ?? "(No name)"}</div>
                  <div className="text-sm text-muted-foreground">{p.email}</div>
                  <div className="text-xs text-muted-foreground">role: {p.role ?? "student"}</div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRole(p.user_id, "student")}>
                    Make Student
                  </Button>
                  <Button onClick={() => setRole(p.user_id, "alumni")}>
                    Keep Alumni
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            Note: This page manages existing users. Creating brand-new auth users requires a server/admin
            function (not safe to do directly in frontend).
          </div>
        </div>
      </main>
    </div>
  );
}
