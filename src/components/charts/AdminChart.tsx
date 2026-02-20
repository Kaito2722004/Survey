// src/pages/admin/AdminChart.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { SurveyAnalytics } from "@/components/analytics/SurveyAnalytics";
import { GeneralSurveyChart } from "@/components/charts/chartsx";

type DbSurvey = {
  id: string;
  title: string;
  semester_id: string | null;
  teacher_id: string | null;
};

type DbQuestion = {
  id: string;
  title: string;
  type: string;
  options: any | null;
  // If your DB does NOT have category column yet, keep this but it may always be null
  category?: string | null;
  order_index: number | null;
};

type DbSurveyResponse = {
  id: string;
  survey_id: string;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};

function parseOptionsAny(options: any): string[] {
  if (!options) return [];

  if (Array.isArray(options)) return options.map(String);

  if (typeof options === "object" && Array.isArray((options as any).options)) {
    return (options as any).options.map(String);
  }

  if (typeof options === "string") {
    const s = options.trim();
    if (!s) return [];

    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as any).options)
      ) {
        return (parsed as any).options.map(String);
      }
    } catch {
      // ignore
    }
  }

  return [];
}

function toRating(val: unknown, questionOptions?: any): number | null {
  if (val === null || val === undefined) return null;

  // number 1..5 (or float)
  if (typeof val === "number") {
    const r = Math.round(val);
    return r >= 1 && r <= 5 ? r : null;
  }

  if (typeof val === "string") {
    const s = val.trim();

    // opt-0..opt-4 -> 1..5
    const m = s.match(/^opt-(\d+)$/i);
    if (m) {
      const idx = Number(m[1]);
      if (Number.isFinite(idx) && idx >= 0 && idx <= 4) return idx + 1;
    }

    // numeric string "1".."5" or "3.2"
    const n = Number(s);
    if (Number.isFinite(n)) {
      const r = Math.round(n);
      if (r >= 1 && r <= 5) return r;
    }

    // label match -> index+1
    const opts = parseOptionsAny(questionOptions);
    if (opts.length) {
      const i = opts.findIndex((o) => String(o).trim() === s);
      if (i >= 0 && i <= 4) return i + 1;

      // if label contains digit 1..5 ("Option 4")
      const digit = s.match(/[1-5]/)?.[0];
      if (digit) return Number(digit);
    }
  }

  return null;
}

function isAbortError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return msg.includes("abort");
}

// ✅ Category guesser for Sem+Teacher charts
type RatingCategory =
  | "teaching"
  | "communication"
  | "knowledge"
  | "support"
  | "overall";

function guessCategory(title: string): RatingCategory {
  const t = title.toLowerCase();

  if (
    t.includes("teach") ||
    t.includes("explain") ||
    t.includes("clarity") ||
    t.includes("understand") ||
    t.includes("engage") ||
    t.includes("delivery") ||
    t.includes("pace")
  )
    return "teaching";

  if (
    t.includes("communicat") ||
    t.includes("respond") ||
    t.includes("feedback") ||
    t.includes("question") ||
    t.includes("interaction") ||
    t.includes("discussion")
  )
    return "communication";

  if (
    t.includes("knowledge") ||
    t.includes("expert") ||
    t.includes("material") ||
    t.includes("content") ||
    t.includes("subject") ||
    t.includes("concept")
  )
    return "knowledge";

  if (
    t.includes("support") ||
    t.includes("help") ||
    t.includes("available") ||
    t.includes("assist") ||
    t.includes("guidance")
  )
    return "support";

  return "overall";
}

// rating-like question types
function isRatingLikeQuestion(q: DbQuestion) {
  return (
    q.type === "rating" ||
    q.type === "likert" ||
    q.type === "scale" ||
    q.type === "scale_1_5" ||
    q.type === "rating_1_5"
  );
}

export default function AdminChart() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [survey, setSurvey] = useState<DbSurvey | null>(null);
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [responses, setResponses] = useState<DbSurveyResponse[]>([]);
  const [teacherName, setTeacherName] = useState<string>("Teacher");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!surveyId) {
        toast.error("Missing surveyId in URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // 1) Survey meta
        const sRes = await supabase
          .from("surveys")
          .select("id,title,semester_id,teacher_id")
          .eq("id", surveyId)
          .single();

        if (sRes.error) throw sRes.error;

        // 2) Questions
        // ✅ If your DB HAS category column, use this:
        const qSelectWithCategory =
          "id,title,type,options,category,order_index";

        // ✅ If your DB does NOT have category column, use this instead:
        const qSelectNoCategory = "id,title,type,options,order_index";

        // ---- Choose ONE of these:
        const qRes = await supabase
          .from("questions")
          .select(qSelectWithCategory) // <-- change to qSelectNoCategory if needed
          .eq("survey_id", surveyId)
          .order("order_index", { ascending: true });

        if (qRes.error) throw qRes.error;

        // 3) Responses
        const rRes = await supabase
          .from("survey_responses")
          .select("id,survey_id,answers,submitted_at")
          .eq("survey_id", surveyId);

        if (rRes.error) throw rRes.error;

        if (!alive) return;

        const sv = sRes.data as DbSurvey;
        const qs = (qRes.data ?? []) as DbQuestion[];
        const rs = (rRes.data ?? []) as DbSurveyResponse[];

        setSurvey(sv);
        setQuestions(qs);
        setResponses(rs);

        // 4) Teacher name (optional)
        if (sv.teacher_id) {
          const tRes = await supabase
            .from("teachers")
            .select("name")
            .eq("id", sv.teacher_id)
            .maybeSingle();

          if (!tRes.error && tRes.data?.name) {
            setTeacherName(tRes.data.name);
          } else {
            setTeacherName("Teacher");
          }
        } else {
          setTeacherName("Teacher");
        }
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error(e);
        toast.error(
          String((e as any)?.message ?? e ?? "Failed to load charts"),
        );
        if (alive) {
          setSurvey(null);
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

  const isSemTeacherSurvey = useMemo(() => {
    return !!survey?.semester_id && !!survey?.teacher_id;
  }, [survey]);

  // Build Sem+Teacher analytics data for SurveyAnalytics
  const semTeacherAnalyticsData = useMemo(() => {
    if (!survey || !survey.teacher_id) return [];

    const ratingQuestions = questions.filter((q) => isRatingLikeQuestion(q));

    return responses.map((r) => {
      const ans = r.answers ?? {};
      const rows: {
        questionId: string;
        question: string;
        rating: number;
        category: string;
      }[] = [];

      const toIterate = ratingQuestions.length ? ratingQuestions : questions;

      for (const q of toIterate) {
        const raw = ans[q.id];

        const rating = toRating(raw, q.options);
        if (!rating) continue;

        // ✅ Use DB category if available, otherwise guess from title
        const category = q.category
          ? String(q.category).toLowerCase()
          : guessCategory(q.title);

        rows.push({
          questionId: q.id,
          question: q.title,
          rating,
          category,
        });
      }

      return {
        id: r.id,
        teacherId: survey.teacher_id!,
        teacherName,
        subject: survey.title ?? "Survey",
        submittedAt: r.submitted_at ?? "",
        responses: rows,
      };
    });
  }, [survey, teacherName, questions, responses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-10">
          <Button variant="ghost" onClick={() => navigate("/admin/surveys")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="mt-6 text-muted-foreground">Survey not found.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ✅ SEM+TEACHER */}
      {isSemTeacherSurvey ? (
        <SurveyAnalytics
          title={`Survey Analytics — ${survey.title}`}
          data={semTeacherAnalyticsData}
        />
      ) : (
        /* ✅ GENERAL */
        <main className="container py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              Survey Charts
            </h1>
            <p className="mt-1 text-muted-foreground">
              General chart (MCQ/Dropdown/Checkboxes) counts selected options
              using <code>answers[question.id]</code>.
            </p>
          </div>

          <div className="card-elevated p-5">
            <GeneralSurveyChart
              questions={questions.map((q) => ({
                id: q.id,
                title: q.title,
                type: q.type,
                options: q.options,
              }))}
              responses={responses.map((r) => ({
                id: r.id,
                answers: r.answers,
              }))}
              maxOptions={5}
            />
          </div>
        </main>
      )}
    </div>
  );
}
