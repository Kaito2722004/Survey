import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  semester_id: string | null;
  teacher_id: string | null;
  audience: string;
  survey_semesters?: { semester_id: string }[] | null;
};

export default function AlumniDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [surveys, setSurveys] = useState<SurveyRow[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // For alumni dashboard, we only show general surveys (no teacher_id) that are published
      const { data: all, error: allErr } = await supabase
        .from("surveys")
        .select(
          "id,title,description,created_at,semester_id,teacher_id,audience"
        )
        .eq("is_published", true)
        .eq("audience", "alumni")
        .order("created_at", { ascending: false });

      if (allErr) {
        console.error(allErr);
        setSurveys([]);
        setLoading(false);
        return;
      }

      const allSurveys = (all ?? []) as SurveyRow[];

      // ✅ Alumni: show ONLY general surveys (no teacher surveys)
      // (Later we can filter by survey audience = 'alumni' once you add that column)
      //const visible = allSurveys.filter((s) => !s.teacher_id);
      //setSurveys(visible);
      setSurveys(allSurveys);
      setLoading(false);
    };

    load();
  }, [user]);

  const cards = useMemo(() => {
    return surveys.map((s) => {
      const restricted = (s.survey_semesters ?? []).map((x) => x.semester_id);

      const badge =
        restricted.length > 0 ? "General (Targeted)" : "General (School-wide)";

      return { ...s, badge };
    });
  }, [surveys]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Alumni Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            You can answer surveys shared for alumni.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Account</div>
              <div className="text-xl font-semibold">
                {user?.name ?? "Alumni"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Showing published general surveys.
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="card-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Available Surveys</h2>
            {loading && (
              <span className="text-sm text-muted-foreground">Loading...</span>
            )}
          </div>

          {!loading && cards.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No surveys available right now.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">General</div>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    {s.badge}
                  </span>
                </div>

                <div className="mt-1 text-lg font-semibold text-foreground">
                  {s.title}
                </div>

                {s.description && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {s.description}
                  </div>
                )}

                <div className="mt-4">
                  <Button asChild>
                    <Link to={`/alumni/survey/${s.id}`}>Answer Survey</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
