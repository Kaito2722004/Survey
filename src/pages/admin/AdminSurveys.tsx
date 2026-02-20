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
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  response_count: number | null;
  created_at: string;
  semester_id: string | null;
  teacher_id: string | null;
  start_at?: string | null;
  end_at?: string | null;
};

type SemesterRow = { id: string; name: string };
type SurveyKindFilter = "all" | "sem_tr" | "general";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSurveys() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchNotifications } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [semesterNameById, setSemesterNameById] = useState<Map<string, string>>(
    new Map(),
  );
  const [showFilters, setShowFilters] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<SurveyKindFilter>("all");
  const [semesterId, setSemesterId] = useState<string>("all");
  const [fromDT, setFromDT] = useState<string>("");
  const [toDT, setToDT] = useState<string>("");

  const hasActiveFilters =
    kind !== "all" || semesterId !== "all" || !!fromDT || !!toDT;

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

  const loadSemesters = async () => {
    try {
      const { data, error } = await supabase
        .from("semesters")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as SemesterRow[];
      setSemesters(rows);
      const m = new Map<string, string>();
      rows.forEach((s) => m.set(s.id, s.name));
      setSemesterNameById(m);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to load semesters");
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,response_count,created_at,semester_id,teacher_id,start_at,end_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSurveys((data ?? []) as unknown as SurveyRow[]);
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
    loadSemesters();
    loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const fromRange = dateOnlyToRange(fromDT);
    const toRange = dateOnlyToRange(toDT);

    return surveys.filter((x) => {
      const isSemTr = !!x.semester_id && !!x.teacher_id;
      if (kind === "sem_tr" && !isSemTr) return false;
      if (kind === "general" && isSemTr) return false;
      if (semesterId !== "all" && x.semester_id !== semesterId) return false;
      const created = new Date(x.created_at);
      if (fromRange && created < fromRange.start) return false;
      if (toRange && created > toRange.end) return false;
      if (!s) return true;
      return (
        (x.title ?? "").toLowerCase().includes(s) ||
        (x.description ?? "").toLowerCase().includes(s) ||
        x.id.toLowerCase().includes(s)
      );
    });
  }, [surveys, search, kind, semesterId, fromDT, toDT]);

  const clearFilters = () => {
    setSearch("");
    setKind("all");
    setSemesterId("all");
    setFromDT("");
    setToDT("");
  };

  const totalPublished = surveys.filter((s) => s.is_published).length;
  const totalResponses = surveys.reduce(
    (acc, s) => acc + (s.response_count ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-10 space-y-8">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Admin · Surveys
            </p>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
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
              className="rounded-xl border border-border bg-card px-5 py-4"
            >
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {stat.value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + filter bar ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-9 h-9 text-sm"
                placeholder="Search surveys..."
                value={search}
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
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {(["all", "sem_tr", "general"] as SurveyKindFilter[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={[
                    "px-3 py-1.5 font-medium transition-colors",
                    kind === k
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  {k === "all"
                    ? "All"
                    : k === "sem_tr"
                      ? "Sem + Teacher"
                      : "General"}
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
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* Expanded filters panel */}
          {showFilters && (
            <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-wrap gap-4 items-end">
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Semester
                </label>
                <Select value={semesterId} onValueChange={setSemesterId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All semesters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All semesters</SelectItem>
                    {semesters.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Created from
                </label>
                <Input
                  type="date"
                  value={fromDT}
                  onChange={(e) => setFromDT(e.target.value)}
                  className="h-9 w-[180px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Created to
                </label>
                <Input
                  type="date"
                  value={toDT}
                  onChange={(e) => setToDT(e.target.value)}
                  className="h-9 w-[180px] text-sm"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors pb-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Results count ── */}
        <div className="flex items-center justify-between -mt-2">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>{" "}
            of {surveys.length} surveys
          </p>
        </div>

        {/* ── Survey list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 flex flex-col items-center gap-3 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <div className="text-base font-medium text-foreground">
              No surveys found
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search || hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Create your first survey to get started."}
            </p>
            {search || hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:underline mt-1"
              >
                Clear filters
              </button>
            ) : (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => navigate("/admin/create-survey")}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Survey
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const isSemTr = !!s.semester_id && !!s.teacher_id;
              const semesterName = s.semester_id
                ? (semesterNameById.get(s.semester_id) ?? s.semester_id)
                : null;

              return (
                <div
                  key={s.id}
                  className="group relative rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-200"
                >
                  {/* Published left accent */}
                  {s.is_published && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary/60 ml-px" />
                  )}

                  <div className="flex flex-col md:flex-row md:items-center gap-4 px-5 py-4">
                    {/* ── Info ── */}
                    <div className="flex-1 min-w-0 pl-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-[15px] truncate">
                          {s.title}
                        </span>

                        <span
                          className={[
                            "inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5",
                            s.is_published
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "w-1.5 h-1.5 rounded-full",
                              s.is_published
                                ? "bg-primary"
                                : "bg-muted-foreground/50",
                            ].join(" ")}
                          />
                          {s.is_published ? "Published" : "Draft"}
                        </span>

                        <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                          {isSemTr ? "Sem + Teacher" : "General"}
                        </span>

                        {isSemTr && semesterName && (
                          <span className="text-[11px] rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            {semesterName}
                          </span>
                        )}
                      </div>

                      {s.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {s.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Created {formatDate(s.created_at)}</span>
                        <span className="opacity-30">·</span>
                        <span className="font-medium text-foreground">
                          {s.response_count ?? 0}{" "}
                          {(s.response_count ?? 0) !== 1
                            ? "responses"
                            : "response"}
                        </span>
                        <span className="opacity-30">·</span>
                        <span className="font-mono text-[10px] opacity-40">
                          {s.id.slice(0, 8)}…
                        </span>
                      </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!s.is_published && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/60"
                          onClick={() => handlePublish(s.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Publish
                        </Button>
                      )}

                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                      >
                        <Link to={`/admin/surveys/${s.id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>

                      <Button asChild size="sm" className="gap-1.5">
                        <Link to={`/admin/surveys/${s.id}/responses`}>
                          <BarChart3 className="h-3.5 w-3.5" />
                          Responses &amp; Charts
                          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
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
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
