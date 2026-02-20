import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeneralSurveyChart } from "@/components/charts/chartsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  Download,
  BarChart3,
  MessageSquareText,
  Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DbQuestion = {
  id: string;
  title: string;
  type: string;
  options: any | null;
  order_index: number | null;
};

type DbSurveyResponse = {
  id: string;
  survey_id: string;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAbortError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return msg.includes("abort");
}

function isOptionQuestion(q: DbQuestion) {
  return (
    q.type === "multiple_choice" ||
    q.type === "dropdown" ||
    q.type === "checkboxes"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabId = "analytics" | "responses";

export default function AdminSurveyResponses() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [responses, setResponses] = useState<DbSurveyResponse[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("analytics");

  // Chart controls
  const [chartMode, setChartMode] = useState<"all" | "single">("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [chartSearch, setChartSearch] = useState("");

  // Question lookup map
  const qMap = useMemo(() => {
    const m = new Map<string, DbQuestion>();
    questions.forEach((q) => m.set(q.id, q));
    return m;
  }, [questions]);

  // Load data
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
        const [qRes, rRes] = await Promise.all([
          supabase
            .from("questions")
            .select("id,title,type,options,order_index")
            .eq("survey_id", surveyId)
            .order("order_index", { ascending: true }),
          supabase
            .from("survey_responses")
            .select("id,survey_id,answers,submitted_at")
            .eq("survey_id", surveyId)
            .order("submitted_at", { ascending: false }),
        ]);

        if (qRes.error) throw qRes.error;
        if (rRes.error) throw rRes.error;
        if (!alive) return;

        const qs = (qRes.data ?? []) as DbQuestion[];
        const rs = (rRes.data ?? []) as DbSurveyResponse[];

        setQuestions(qs);
        setResponses(rs);
        setSelectedQuestionId(qs.find(isOptionQuestion)?.id ?? "");
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error(e);
        toast.error(String((e as any)?.message ?? e ?? "Failed to load data"));
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

  // Chart question list (filtered)
  const optionQuestions = useMemo(() => {
    const qs = questions.filter(isOptionQuestion);
    const s = chartSearch.trim().toLowerCase();
    return s ? qs.filter((q) => q.title.toLowerCase().includes(s)) : qs;
  }, [questions, chartSearch]);

  // Keep selection valid
  useEffect(() => {
    if (!optionQuestions.length) {
      setSelectedQuestionId("");
      return;
    }
    if (!selectedQuestionId) {
      setSelectedQuestionId(optionQuestions[0].id);
      return;
    }
    if (!optionQuestions.some((q) => q.id === selectedQuestionId)) {
      setSelectedQuestionId(optionQuestions[0].id);
    }
  }, [optionQuestions, selectedQuestionId]);

  // Export JSON
  const exportJSON = () => {
    const data = responses.map((r) => ({
      id: r.id,
      submitted_at: r.submitted_at,
      answers: r.answers ?? {},
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${surveyId}-responses.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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

  const hasChartableQuestions = optionQuestions.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ── Sticky top bar ── */}
      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/surveys")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Surveys
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportJSON}
            disabled={responses.length === 0}
          >
            <Download className="mr-1 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      <main className="container py-8 space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              Survey Insights
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {responses.length} response{responses.length !== 1 ? "s" : ""}{" "}
              collected
            </p>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
              {optionQuestions.length} chartable
            </span>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="inline-flex rounded-xl border border-border bg-card p-1 gap-1">
          <button
            onClick={() => setActiveTab("analytics")}
            className={[
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "analytics"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab("responses")}
            className={[
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === "responses"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <MessageSquareText className="h-4 w-4" />
            Responses
            {responses.length > 0 && (
              <span
                className={[
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold",
                  activeTab === "responses"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {responses.length}
              </span>
            )}
          </button>
        </div>

        {/* ════════════════════════════════════════════════
            ANALYTICS TAB
        ════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            {!hasChartableQuestions ? (
              <div className="card-elevated rounded-xl p-8 text-center space-y-2">
                <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <div className="text-base font-medium text-foreground">
                  No chartable questions
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Charts are generated for{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    multiple_choice
                  </code>
                  ,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    dropdown
                  </code>
                  , and{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    checkboxes
                  </code>{" "}
                  question types.
                </p>
              </div>
            ) : (
              <>
                {/* Chart controls */}
                <div className="card-elevated rounded-xl p-5">
                  <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                    {/* Mode */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Display mode
                      </div>
                      <div className="inline-flex rounded-lg border border-border overflow-hidden">
                        <button
                          onClick={() => setChartMode("all")}
                          className={[
                            "px-3 py-1.5 text-sm font-medium transition-colors",
                            chartMode === "all"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          ].join(" ")}
                        >
                          All questions
                        </button>
                        <button
                          onClick={() => setChartMode("single")}
                          className={[
                            "px-3 py-1.5 text-sm font-medium transition-colors",
                            chartMode === "single"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          ].join(" ")}
                        >
                          Single question
                        </button>
                      </div>
                    </div>

                    {/* Search questions */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Filter questions
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          className="pl-8 w-[280px] h-9 text-sm"
                          placeholder="Search question title..."
                          value={chartSearch}
                          onChange={(e) => setChartSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Single question picker */}
                    {chartMode === "single" && (
                      <div className="space-y-1.5 flex-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Select question
                        </div>
                        <Select
                          value={selectedQuestionId}
                          onValueChange={setSelectedQuestionId}
                          disabled={optionQuestions.length === 0}
                        >
                          <SelectTrigger className="w-full max-w-[480px] h-9 text-sm">
                            <SelectValue
                              placeholder={
                                optionQuestions.length === 0
                                  ? "No questions match filter"
                                  : "Pick a question..."
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {optionQuestions.map((q) => (
                              <SelectItem key={q.id} value={q.id}>
                                {q.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart output */}
                <div className="card-elevated rounded-xl p-5">
                  {responses.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      No responses yet — charts will appear here once students
                      submit.
                    </div>
                  ) : (
                    <GeneralSurveyChart
                      questions={
                        chartMode === "single"
                          ? optionQuestions
                              .filter((q) => q.id === selectedQuestionId)
                              .map((q) => ({
                                id: q.id,
                                title: q.title,
                                type: q.type,
                                options: q.options,
                              }))
                          : optionQuestions.map((q) => ({
                              id: q.id,
                              title: q.title,
                              type: q.type,
                              options: q.options,
                            }))
                      }
                      responses={responses.map((r) => ({
                        id: r.id,
                        answers: r.answers,
                      }))}
                      maxOptions={5}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            RESPONSES TAB  –  grouped by question
        ════════════════════════════════════════════════ */}
        {activeTab === "responses" && (
          <div className="space-y-4">
            {responses.length === 0 ? (
              <div className="card-elevated rounded-xl p-10 text-center space-y-2">
                <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <div className="text-base font-medium text-foreground">
                  No responses yet
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Once students submit, their responses will appear here. If you
                  expected results, check RLS on{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    survey_responses
                  </code>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q, qIdx) => {
                  const isText =
                    q.type === "text" ||
                    q.type === "textarea" ||
                    q.type === "short_answer" ||
                    q.type === "long_answer" ||
                    q.type === "paragraph";

                  // Collect all answers for this question across all responses
                  const answers: string[] = responses
                    .map((r) => {
                      const val = (r.answers ?? {})[q.id];
                      if (val === undefined || val === null || val === "")
                        return null;
                      if (Array.isArray(val)) return val.join(", ");
                      return String(val);
                    })
                    .filter(Boolean) as string[];

                  return (
                    <div
                      key={q.id}
                      className="card-elevated rounded-xl border border-border overflow-hidden"
                    >
                      {/* Question header */}
                      <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-muted/30">
                        <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {qIdx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground text-sm leading-snug">
                            {q.title}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide font-semibold rounded px-1.5 py-0.5 bg-muted text-muted-foreground border border-border">
                              {q.type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {answers.length} / {responses.length} answered
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Answers body — only for text-type questions */}
                      {isText ? (
                        <div className="divide-y divide-border">
                          {answers.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-muted-foreground italic">
                              No answers submitted yet.
                            </p>
                          ) : (
                            answers.map((ans, i) => (
                              <div
                                key={i}
                                className="px-5 py-3 flex items-start gap-3"
                              >
                                <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-primary/50" />
                                <p className="text-sm text-foreground break-words leading-relaxed">
                                  {ans}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        /* Non-text questions: show summary note, chart is in Analytics tab */
                        <div className="px-5 py-3">
                          <p className="text-sm text-muted-foreground">
                            This question type is visualised in the{" "}
                            <button
                              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                              onClick={() => setActiveTab("analytics")}
                            >
                              Analytics tab
                            </button>
                            .
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
