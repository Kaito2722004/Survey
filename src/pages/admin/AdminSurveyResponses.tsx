import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download } from "lucide-react";

type DbQuestion = {
  id: string;
  title: string;
  type: string;
  options: any | null; // keep loose; your DB may store text[] or json
  order_index: number | null;
};

type DbSurveyResponse = {
  id: string;
  survey_id: string;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};

function isAbortError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return msg.includes("abort");
}

export default function AdminSurveyResponses() {
  // ✅ IMPORTANT: route is /admin/surveys/:surveyId/responses
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [responses, setResponses] = useState<DbSurveyResponse[]>([]);

  const qMap = useMemo(() => {
    const m = new Map<string, DbQuestion>();
    questions.forEach((q) => m.set(q.id, q));
    return m;
  }, [questions]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!surveyId) {
        setLoading(false);
        toast.error("Missing surveyId in URL.");
        return;
      }

      setLoading(true);
      try {
        const qRes = await supabase
          .from("questions")
          .select("id,title,type,options,order_index")
          .eq("survey_id", surveyId)
          .order("order_index", { ascending: true });

        if (qRes.error) throw qRes.error;

        const rRes = await supabase
          .from("survey_responses")
          .select("id,survey_id,answers,submitted_at")
          .eq("survey_id", surveyId)
          .order("submitted_at", { ascending: false });

        if (rRes.error) throw rRes.error;

        if (!alive) return;

        setQuestions((qRes.data ?? []) as DbQuestion[]);
        setResponses((rRes.data ?? []) as DbSurveyResponse[]);
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error("AdminSurveyResponses load error:", e);
        toast.error(String((e as any)?.message ?? e ?? "Failed to load responses"));

        if (alive) {
          setQuestions([]);
          setResponses([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [surveyId]);

  const exportJSON = () => {
    const data = responses.map((r) => ({
      id: r.id,
      submitted_at: r.submitted_at,
      answers: r.answers ?? {},
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${surveyId}-responses.json`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/surveys")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportJSON} disabled={responses.length === 0}>
              <Download className="mr-1 h-4 w-4" />
              JSON
            </Button>

            {/* optional: if you have chart route */}
            <Button asChild size="sm">
              <Link to={`/admin/surveys/${surveyId}/chart`}>View Charts</Link>
            </Button>
          </div>
        </div>
      </div>

      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Survey Responses</h1>
          <p className="mt-1 text-muted-foreground">
            Total: {responses.length} response{responses.length !== 1 ? "s" : ""}
          </p>
        </div>

        {responses.length === 0 ? (
          <div className="card-elevated p-8">
            <div className="text-lg font-medium">No responses yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              If you expected responses here, it’s usually RLS on <code>survey_responses</code>.
            </div>
          </div>
        ) : (
          <div className="card-elevated p-6 space-y-4">
            {responses.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">Response</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {Object.entries(r.answers ?? {}).map(([qid, val]) => {
                    const q = qMap.get(qid);
                    return (
                      <div key={qid} className="text-sm">
                        <div className="font-medium text-foreground">{q?.title ?? `Question ${qid}`}</div>
                        <div className="text-muted-foreground break-words">
                          {typeof val === "string" || typeof val === "number"
                            ? String(val)
                            : JSON.stringify(val)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}