import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  CalendarDays,
  X,
  Users,
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
  // populated after join
  respondent_name?: string | null;
  section_label?: string | null;
};

type SurveyMeta = {
  title: string;
  survey_type: string | null;
  section_id: string | null;
  teacher_id: string | null;
  audience: string | null;
  target_role: string | null;
};

type SectionRow = {
  id: string;
  sem: number;
  year_level: number;
  program: string;
  specialization: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  section_id: string | null;
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

function sectionLabel(s: SectionRow) {
  return `Y${s.year_level} ${s.specialization} — Sem ${s.sem} (${s.program})`;
}

function getSurveyKind(meta: SurveyMeta): "section_tr" | "general" | "other" {
  if (meta.survey_type === "alumni" || meta.audience === "alumni") return "other";
  if (meta.target_role === "organization" || meta.audience === "target_group")
    return "other";
  if (meta.section_id && meta.teacher_id) return "section_tr";
  return "general";
}

function dateOnlyToRange(val: string): { start: Date; end: Date } | null {
  if (!val) return null;
  const [y, m, d] = val.split("-").map(Number);
  if (!y || !m || !d) return null;
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabId = "analytics" | "responses";

export default function AdminSurveyResponses() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [responses, setResponses] = useState<DbSurveyResponse[]>([]);
  const [surveyMeta, setSurveyMeta] = useState<SurveyMeta | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    tabParam === "responses" ? "responses" : "analytics"
  );

  useEffect(() => {
    if (tabParam === "responses") setActiveTab("responses");
    else if (tabParam === "analytics") setActiveTab("analytics");
  }, [tabParam]);

  // Chart controls
  const [chartMode, setChartMode] = useState<"all" | "single">("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [chartSearch, setChartSearch] = useState("");

  // ── NEW: Response filters ──────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("all");
  const [selectedRespondentId, setSelectedRespondentId] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    !!selectedDate || selectedSectionId !== "all" || selectedRespondentId !== "all";

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
        const [qRes, rRes, metaRes, secRes] = await Promise.all([
          supabase
            .from("questions")
            .select("id,title,type,options,order_index")
            .eq("survey_id", surveyId)
            .order("order_index", { ascending: true }),
          supabase
            .from("survey_responses")
            .select("id,survey_id,answers,submitted_at,user_id")
            .eq("survey_id", surveyId)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("surveys")
            .select("title,survey_type,section_id,teacher_id,audience,target_role")
            .eq("id", surveyId)
            .single(),
          supabase
            .from("sections")
            .select("id,sem,year_level,program,specialization")
            .order("year_level", { ascending: true }),
        ]);

        if (qRes.error) throw qRes.error;
        if (rRes.error) throw rRes.error;
        if (metaRes.error) throw metaRes.error;
        if (secRes.error) throw secRes.error;
        if (!alive) return;

        const qs = (qRes.data ?? []) as DbQuestion[];
        const meta = metaRes.data as SurveyMeta;
        const secs = (secRes.data ?? []) as SectionRow[];
        setSurveyMeta(meta);
        setSections(secs);
        setQuestions(qs);

        // Load profiles for user_ids in responses
        const userIds = [
          ...new Set(
            (rRes.data ?? [])
              .map((r: any) => r.user_id)
              .filter(Boolean)
          ),
        ] as string[];

        let profileRows: ProfileRow[] = [];
        if (userIds.length > 0) {
          const { data: pData } = await supabase
            .from("profiles")
            .select("id,full_name,section_id")
            .in("id", userIds);
          profileRows = (pData ?? []) as ProfileRow[];
        }
        if (!alive) return;
        setProfiles(profileRows);

        const profileMap = new Map<string, ProfileRow>();
        profileRows.forEach((p) => profileMap.set(p.id, p));

        const secMap = new Map<string, string>();
        secs.forEach((s) => secMap.set(s.id, sectionLabel(s)));

        const rs: DbSurveyResponse[] = (rRes.data ?? []).map((r: any) => {
          const profile = r.user_id ? profileMap.get(r.user_id) : null;
          const secLbl = profile?.section_id
            ? secMap.get(profile.section_id) ?? null
            : null;
          return {
            id: r.id,
            survey_id: r.survey_id,
            answers: r.answers,
            submitted_at: r.submitted_at,
            respondent_name: profile?.full_name ?? null,
            section_label: secLbl,
            _user_id: r.user_id,
            _section_id: profile?.section_id ?? null,
          } as any;
        });

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

  // ── Derived: survey kind ───────────────────────────────────────────────────
  const surveyKind = surveyMeta ? getSurveyKind(surveyMeta) : "other";
  const isFilterable = surveyKind === "section_tr" || surveyKind === "general";

  // ── Sections that appear in responses ─────────────────────────────────────
  const sectionsInResponses = useMemo(() => {
    const ids = new Set(
      (responses as any[]).map((r) => r._section_id).filter(Boolean)
    );
    return sections.filter((s) => ids.has(s.id));
  }, [responses, sections]);

  // ── Respondents for selected section ──────────────────────────────────────
  const respondentsInSection = useMemo(() => {
    const sectionFiltered =
      selectedSectionId === "all"
        ? (responses as any[])
        : (responses as any[]).filter(
            (r) => r._section_id === selectedSectionId
          );
    const seen = new Map<string, string>();
    sectionFiltered.forEach((r) => {
      if (r._user_id && r.respondent_name) {
        seen.set(r._user_id, r.respondent_name);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [responses, selectedSectionId]);

  // ── Filtered responses ─────────────────────────────────────────────────────
  const filteredResponses = useMemo(() => {
    const dateRange = dateOnlyToRange(selectedDate);

    return (responses as any[]).filter((r) => {
      if (dateRange) {
        const submitted = new Date(r.submitted_at);
        if (submitted < dateRange.start || submitted > dateRange.end) return false;
      }
      if (selectedSectionId !== "all" && r._section_id !== selectedSectionId)
        return false;
      if (
        selectedRespondentId !== "all" &&
        r._user_id !== selectedRespondentId
      )
        return false;
      return true;
    }) as DbSurveyResponse[];
  }, [responses, selectedDate, selectedSectionId, selectedRespondentId]);

  const clearFilters = () => {
    setSelectedDate("");
    setSelectedSectionId("all");
    setSelectedRespondentId("all");
  };

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

  // Reset respondent when section changes
  useEffect(() => {
    setSelectedRespondentId("all");
  }, [selectedSectionId]);

  // Export JSON
  const exportJSON = () => {
    const data = filteredResponses.map((r) => ({
      id: r.id,
      submitted_at: r.submitted_at,
      respondent_name: r.respondent_name ?? null,
      section: r.section_label ?? null,
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
      <div className="min-h-screen bg-background md:pl-56">
        <Header />
        <main className="container flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  const hasChartableQuestions = optionQuestions.length > 0;

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
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
            disabled={filteredResponses.length === 0}
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
            {surveyMeta?.title && (
              <p className="mt-0.5 text-sm font-medium text-primary/80">
                {surveyMeta.title}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredResponses.length === responses.length
                ? `${responses.length} response${responses.length !== 1 ? "s" : ""} collected`
                : `Showing ${filteredResponses.length} of ${responses.length} responses`}
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

        {/* ════════════════════════════════════════════════
            RESPONSE FILTERS  (date + section + name)
            Only shown for section_tr and general surveys
        ════════════════════════════════════════════════ */}
        {isFilterable && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  showFilters || hasActiveFilters
                    ? "border-primary/50 bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
                ].join(" ")}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Filter Responses
                {hasActiveFilters && (
                  <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                    !
                  </span>
                )}
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>

            {showFilters && (
              <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                {/* Single date picker */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Submitted on
                  </label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 w-[180px] text-sm"
                  />
                </div>

                {/* Section select — for general surveys show all sections that responded */}
                {sectionsInResponses.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Section
                    </label>
                    <Select
                      value={selectedSectionId}
                      onValueChange={setSelectedSectionId}
                    >
                      <SelectTrigger className="h-9 w-[240px] text-sm">
                        <SelectValue placeholder="All sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sections</SelectItem>
                        {sectionsInResponses.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {sectionLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Respondent name select */}
                {respondentsInSection.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Respondent
                    </label>
                    <Select
                      value={selectedRespondentId}
                      onValueChange={setSelectedRespondentId}
                    >
                      <SelectTrigger className="h-9 w-[220px] text-sm">
                        <SelectValue placeholder="All respondents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All respondents</SelectItem>
                        {respondentsInSection.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Active filter summary chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5">
                {selectedDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2.5 py-0.5 font-medium">
                    Date: {selectedDate}
                    <button onClick={() => setSelectedDate("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedSectionId !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 font-medium">
                    {sectionLabel(
                      sections.find((s) => s.id === selectedSectionId)!
                    )}
                    <button onClick={() => setSelectedSectionId("all")}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {selectedRespondentId !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2.5 py-0.5 font-medium">
                    {respondentsInSection.find(
                      (p) => p.id === selectedRespondentId
                    )?.name ?? selectedRespondentId}
                    <button onClick={() => setSelectedRespondentId("all")}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

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
            {filteredResponses.length > 0 && (
              <span
                className={[
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold",
                  activeTab === "responses"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {filteredResponses.length}
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

                {/* Chart output — uses filteredResponses */}
                <div className="card-elevated rounded-xl p-5">
                  {filteredResponses.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      {hasActiveFilters
                        ? "No responses match the current filters."
                        : "No responses yet — charts will appear here once students submit."}
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
                      responses={filteredResponses.map((r) => ({
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
            {filteredResponses.length === 0 ? (
              <div className="card-elevated rounded-xl p-10 text-center space-y-2">
                <MessageSquareText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <div className="text-base font-medium text-foreground">
                  {hasActiveFilters ? "No responses match filters" : "No responses yet"}
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {hasActiveFilters
                    ? "Try adjusting or clearing the filters above."
                    : "Once students submit, their responses will appear here."}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
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

                  // Collect answers from filteredResponses
                  const answersWithMeta: {
                    text: string;
                    name: string | null;
                    section: string | null;
                    date: string;
                  }[] = filteredResponses
                    .map((r) => {
                      const val = (r.answers ?? {})[q.id];
                      if (val === undefined || val === null || val === "")
                        return null;
                      return {
                        text: Array.isArray(val) ? val.join(", ") : String(val),
                        name: r.respondent_name ?? null,
                        section: r.section_label ?? null,
                        date: r.submitted_at,
                      };
                    })
                    .filter(Boolean) as any[];

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
                              {answersWithMeta.length} / {filteredResponses.length} answered
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Answers body — only for text-type questions */}
                      {isText ? (
                        <div className="divide-y divide-border">
                          {answersWithMeta.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-muted-foreground italic">
                              No answers submitted yet.
                            </p>
                          ) : (
                            answersWithMeta.map((ans, i) => (
                              <div
                                key={i}
                                className="px-5 py-3 flex items-start gap-3"
                              >
                                <span className="flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-primary/50" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground break-words leading-relaxed">
                                    {ans.text}
                                  </p>
                                  {/* Respondent meta */}
                                  {(ans.name || ans.section) && (
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      {ans.name && (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                          {ans.name}
                                        </span>
                                      )}
                                      {ans.section && (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                          {ans.section}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-muted-foreground">
                                        {new Date(ans.date).toLocaleDateString(
                                          "en-US",
                                          {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          }
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        /* Non-text questions: show summary note */
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