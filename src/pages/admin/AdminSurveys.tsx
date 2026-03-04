// src/pages/admin/AdminSurveys.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { publishSurvey } from "@/services/surveyQueries";
import { useAuth } from "@/contexts/AuthContext";
import { notificationsService } from "@/services/notifications";
import { useNotifications } from "@/contexts/NotificationsContext";
import { surveysService } from "@/services/surveys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Pencil,
  BarChart3,
  CheckCircle,
  Trash2,
  Search,
  SlidersHorizontal,
  X,
  FileText,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  response_count: number;
  created_at: string;
  section_id: string | null;
  teacher_id: string | null;
  target_role: string | null;
  audience: string | null;
  survey_type: string | null;
  start_at?: string | null;
  end_at?: string | null;
};

type SectionRow = {
  id: string;
  sem: number;
  year_level: number;
  program: string;
  specialization: string;
};

type SurveyKindFilter =
  | "all"
  | "section_tr"
  | "general"
  | "organization"
  | "alumni";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sectionLabel(s: SectionRow) {
  return `Y${s.year_level} ${s.specialization} — Sem ${s.sem} (${s.program})`;
}

function formatDate(val: string) {
  try {
    return new Date(val).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return val;
  }
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

function getSurveyKind(s: SurveyRow): SurveyKindFilter {
  if (s.survey_type === "alumni" || s.audience === "alumni") return "alumni";
  if (s.target_role === "organization" || s.audience === "target_group")
    return "organization";
  if (s.section_id && s.teacher_id) return "section_tr";
  return "general";
}

function getSurveyKindLabel(kind: SurveyKindFilter): string {
  switch (kind) {
    case "section_tr":
      return "Section + Teacher";
    case "general":
      return "General";
    case "organization":
      return "Organization";
    case "alumni":
      return "Alumni";
    default:
      return "All";
  }
}

function getSurveyKindBadgeClass(kind: SurveyKindFilter): string {
  switch (kind) {
    case "section_tr":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "organization":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "alumni":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-muted/50 text-muted-foreground";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminSurveys() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchNotifications } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [sectionLabelById, setSectionLabelById] = useState<Map<string, string>>(
    new Map(),
  );
  const [showFilters, setShowFilters] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<SurveyKindFilter>("all");
  const [sectionId, setSectionId] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const hasActiveFilters =
    kind !== "all" || sectionId !== "all" || !!filterDate;

  // Ensure admin notifications
  useEffect(() => {
    if (!user?.id) return;
    const run = async () => {
      try {
        const mySurveys = await surveysService.getByAdminUser(user.id);
        const pastDeadline = mySurveys.filter(
          (s) => s.deadline && new Date(s.deadline) < new Date(),
        );
        await notificationsService.ensureAdminNotifications(
          user.id,
          pastDeadline.map((s) => ({
            id: s.id,
            title: s.title,
            deadline: s.deadline,
          })),
        );
        refetchNotifications();
      } catch (e) {
        console.error("Ensure admin notifications:", e);
      }
    };
    run();
  }, [user?.id, refetchNotifications]);

  // Load sections
  const loadSections = async () => {
    try {
      const { data, error } = await supabase
        .from("sections")
        .select("id,sem,year_level,program,specialization")
        .order("year_level", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as SectionRow[];
      setSections(rows);
      const m = new Map<string, string>();
      rows.forEach((s) => m.set(s.id, sectionLabel(s)));
      setSectionLabelById(m);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to load sections");
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,created_at,section_id,teacher_id,target_role,audience,survey_type,start_at,end_at,survey_responses(count)",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: SurveyRow[] = (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        is_published: row.is_published,
        created_at: row.created_at,
        section_id: row.section_id,
        teacher_id: row.teacher_id,
        target_role: row.target_role,
        audience: row.audience,
        survey_type: row.survey_type,
        start_at: row.start_at,
        end_at: row.end_at,
        response_count: row.survey_responses?.[0]?.count ?? 0,
      }));

      setSurveys(mapped);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to load surveys");
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (surveyId: string) => {
    try {
      await publishSurvey(surveyId);
      const survey = surveys.find((s) => s.id === surveyId);
      if (user?.id && survey) {
        try {
          await notificationsService.create({
            user_id: user.id,
            type: "survey_published",
            survey_id: surveyId,
            title: "Survey published",
            message: `"${survey.title}" is now published.`,
          });
          refetchNotifications();
        } catch (e) {
          console.error("Publish notification:", e);
        }
      }
      toast.success("Survey published successfully");
      await loadSurveys();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to publish survey");
    }
  };

  const handleDelete = async (surveyId: string) => {
    const ok = window.confirm(
      "Are you sure you want to delete this survey?\nThis action cannot be undone.",
    );
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("surveys")
        .delete()
        .eq("id", surveyId);
      if (error) throw error;
      toast.success("Survey deleted");
      await loadSurveys();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete survey");
    }
  };

  useEffect(() => {
    loadSections();
    loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const dateRange = dateOnlyToRange(filterDate);
    return surveys.filter((x) => {
      const surveyKind = getSurveyKind(x);
      if (kind !== "all" && surveyKind !== kind) return false;
      if (sectionId !== "all" && x.section_id !== sectionId) return false;
      if (dateRange) {
        const created = new Date(x.created_at);
        if (created < dateRange.start || created > dateRange.end) return false;
      }
      if (!s) return true;
      return (
        (x.title ?? "").toLowerCase().includes(s) ||
        (x.description ?? "").toLowerCase().includes(s) ||
        x.id.toLowerCase().includes(s)
      );
    });
  }, [surveys, search, kind, sectionId, filterDate]);

  const clearFilters = () => {
    setSearch("");
    setKind("all");
    setSectionId("all");
    setFilterDate("");
  };

  const totalPublished = surveys.filter((s) => s.is_published).length;
  const totalResponses = surveys.reduce(
    (acc, s) => acc + (s.response_count ?? 0),
    0,
  );

  const KIND_FILTERS: SurveyKindFilter[] = [
    "all",
    "section_tr",
    "general",
    "organization",
    "alumni",
  ];

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Admin · Surveys
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Survey Manager
            </h1>
          </div>
          <Button
            onClick={() => navigate("/admin/create-survey")}
            className="self-start sm:self-auto gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Survey
          </Button>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Surveys", value: surveys.length },
            { label: "Published", value: totalPublished },
            { label: "Drafts", value: surveys.length - totalPublished },
            { label: "Total Responses", value: totalResponses },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-4 space-y-1"
            >
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Search + filter bar ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search surveys…"
                value={search}
                className="pl-8 pr-8 h-9 text-sm"
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Kind pills */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm flex-wrap">
              {KIND_FILTERS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={[
                    "px-3 py-1.5 rounded-md font-medium transition-colors",
                    kind === k
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  {getSurveyKindLabel(k)}
                </button>
              ))}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                showFilters || hasActiveFilters
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
              ].join(" ")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center">
                  !
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={loadSurveys}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* Expanded filters panel */}
          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 px-4 py-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Section
                </label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger className="h-9 w-[220px] text-sm">
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {sectionLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Created on
                </label>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="h-9 w-[180px] text-sm"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors pb-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Results count ── */}
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>{" "}
          of {surveys.length} surveys
        </p>

        {/* ── Survey list ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">No surveys found</p>
            <p className="text-sm text-muted-foreground">
              {search || hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Create your first survey to get started."}
            </p>
            {search || hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate("/admin/create-survey")}
              >
                Create Survey
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const surveyKind = getSurveyKind(s);
              const secLabel = s.section_id
                ? (sectionLabelById.get(s.section_id) ?? s.section_id)
                : null;

              return (
                <div
                  key={s.id}
                  className="relative rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow"
                >
                  {s.is_published && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}

                  {/* ── Info ── */}
                  <div className="space-y-1 mb-3 pr-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold leading-snug">{s.title}</h2>
                      <span
                        className={[
                          "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                          s.is_published
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200",
                        ].join(" ")}
                      >
                        {s.is_published ? "Published" : "Draft"}
                      </span>
                      <span
                        className={[
                          "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                          getSurveyKindBadgeClass(surveyKind),
                        ].join(" ")}
                      >
                        {getSurveyKindLabel(surveyKind)}
                      </span>
                      {surveyKind === "section_tr" && secLabel && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          {secLabel}
                        </span>
                      )}
                    </div>

                    {s.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {s.description}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(s.created_at)} · {s.response_count}{" "}
                      {s.response_count !== 1 ? "responses" : "response"} ·{" "}
                      {s.id.slice(0, 8)}…
                    </p>
                  </div>

                  {/* ── Actions ── */}
                  <div className="flex flex-wrap items-center gap-2">
                    {!s.is_published && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => handlePublish(s.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Publish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      disabled={s.is_published}
                      asChild={!s.is_published}
                    >
                      {s.is_published ? (
                        <>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </>
                      ) : (
                        <Link to={`/admin/surveys/${s.id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      asChild
                    >
                      <Link to={`/admin/surveys/${s.id}/responses`}>
                        <BarChart3 className="h-3.5 w-3.5" />
                        Responses &amp; Charts
                      </Link>
                    </Button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete survey"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}