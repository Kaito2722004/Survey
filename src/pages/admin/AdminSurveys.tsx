import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import supabase from "@/utils/supabase";
import { toast } from "sonner";

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  response_count: number | null; // ✅ can be null in DB
  created_at: string;
  semester_id: string | null;
  teacher_id: string | null;
};

export default function AdminSurveys() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!alive) return;
      setLoading(true);

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData.user?.id;
        if (!userId) throw new Error("Not logged in");

        const { data, error } = await supabase
          .from("surveys")
          .select(
            "id,title,description,is_published,response_count,created_at,semester_id,teacher_id,user_id"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (alive) setRows((data ?? []) as SurveyRow[]);
      } catch (e: any) {
        // ✅ Abort is NOT a real error; ignore it
        if (e?.name === "AbortError") return;

        console.error(e);
        if (alive) toast.error(e?.message || "Failed to load surveys");
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.title ?? "").toLowerCase().includes(s));
  }, [q, rows]);

  const reload = async () => {
    // simple reload function (no AbortError crash)
    setLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData.user?.id;
      if (!userId) throw new Error("Not logged in");

      const { data, error } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,response_count,created_at,semester_id,teacher_id,user_id"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as SurveyRow[]);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error(e);
      toast.error(e?.message || "Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <h1 className="text-3xl font-semibold flex-1">My Surveys</h1>
          <Button onClick={() => navigate("/admin/create-survey")}>
            Create Survey
          </Button>
        </div>

        <div className="card-elevated p-4 flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Search by title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" onClick={reload} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="card-elevated p-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No surveys found. Create one first.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((s) => {
                const responses = s.response_count ?? 0;

                return (
                  <div key={s.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.is_published ? "Published" : "Draft"} • Responses:{" "}
                        {responses}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => navigate("/admin/surveys/" + s.id + "/edit")}
                    >
                      Edit Questions
                    </Button>

                    <Button
                      onClick={() =>
                        navigate("/admin/surveys/" + s.id + "/responses")
                      }
                    >
                      Responses
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
