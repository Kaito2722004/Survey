// src/pages/admin/AdminSurveys.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { publishSurvey } from "@/services/surveyQueries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle } from "lucide-react";
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
  MessageSquareText,
} from "lucide-react";

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  response_count: number | null;
  created_at: string;
  semester_id: string | null;
  teacher_id: string | null;
  start_at?: string | null; // optional (if you added columns)
  end_at?: string | null; // optional (if you added columns)
};

type SemesterRow = { id: string; name: string };

type SurveyKindFilter = "all" | "sem_tr" | "general";

function formatDate(val: string) {
  try {
    return new Date(val).toLocaleDateString();
  } catch {
    return val;
  }
}

// Converts "YYYY-MM-DDTHH:mm" (datetime-local) to Date
// Converts "YYYY-MM-DD" (date input) into a full-day range
function dateOnlyToRange(val: string): { start: Date; end: Date } | null {
  if (!val) return null;

  const [y, m, d] = val.split("-").map(Number);
  if (!y || !m || !d) return null;

  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

export default function AdminSurveys() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [semesterNameById, setSemesterNameById] = useState<Map<string, string>>(
    new Map()
  );

  // filters
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<SurveyKindFilter>("all");
  const [semesterId, setSemesterId] = useState<string>("all"); // "all" | semester uuid
  const [fromDT, setFromDT] = useState<string>(""); // created_at from
  const [toDT, setToDT] = useState<string>(""); // created_at to

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
      setSemesters([]);
      setSemesterNameById(new Map());
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      // NOTE: start_at/end_at are optional columns. If you DID NOT add them,
      // remove them from select(...) to avoid "column does not exist" error.
      const { data, error } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,response_count,created_at,semester_id,teacher_id,start_at,end_at"
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

  // ✅ Publishing (ONLY publishing-related changes)
  const handlePublish = async (surveyId: string) => {
    try {
      await publishSurvey(surveyId);
      toast.success("Survey published successfully");
      await loadSurveys(); // ✅ refresh list
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to publish survey");
    }
  };
  const handleDelete = async (surveyId: string) => {
  const ok = window.confirm(
    "Are you sure you want to delete this survey?\nThis action cannot be undone."
  );
  if (!ok) return;

  try {
    const { error } = await supabase
      .from("surveys")
      .delete()
      .eq("id", surveyId);

    if (error) throw error;

    toast.success("Survey deleted");
    await loadSurveys(); // refresh list
  } catch (e: any) {
    console.error(e);
    toast.error(e?.message ?? "Failed to delete survey");
  }
};

  useEffect(() => {
    // initial load
    loadSemesters();
    loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const fromRange = dateOnlyToRange(fromDT);
const toRange = dateOnlyToRange(toDT);

    return surveys.filter((x) => {
      // kind filter
      const isSemTr = !!x.semester_id && !!x.teacher_id;
      if (kind === "sem_tr" && !isSemTr) return false;
      if (kind === "general" && isSemTr) return false;

      // semester filter (only makes sense for sem_tr surveys)
      if (semesterId !== "all") {
        if (x.semester_id !== semesterId) return false;
      }

      // date filter (by created_at)
      const created = new Date(x.created_at);
if (fromRange && created < fromRange.start) return false;
if (toRange && created > toRange.end) return false;

      // search filter (title/desc/id)
      if (!s) return true;
      const t = (x.title ?? "").toLowerCase();
      const d = (x.description ?? "").toLowerCase();
      return t.includes(s) || d.includes(s) || x.id.toLowerCase().includes(s);
    });
  }, [surveys, search, kind, semesterId, fromDT, toDT]);

  const clearFilters = () => {
    setSearch("");
    setKind("all");
    setSemesterId("all");
    setFromDT("");
    setToDT("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Top bar */}
      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container py-3 flex flex-col gap-3">
          {/* row 1 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-[320px]"
                placeholder="Search surveys..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* Kind buttons */}
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <Button
                  type="button"
                  variant={kind === "all" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setKind("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={kind === "sem_tr" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setKind("sem_tr")}
                >
                  Sem + Teacher
                </Button>
                <Button
                  type="button"
                  variant={kind === "general" ? "default" : "ghost"}
                  size="sm"
                  className="rounded-none"
                  onClick={() => setKind("general")}
                >
                  General
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={loadSurveys}>
                Refresh
              </Button>
            </div>

            <Button size="sm" onClick={() => navigate("/admin/create-survey")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Survey
            </Button>
          </div>

          {/* row 2: semester + date filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px]">
              <div className="text-xs text-muted-foreground mb-1">
                Semester (filter)
              </div>
              <Select value={semesterId} onValueChange={setSemesterId}>
                <SelectTrigger>
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
              <div className="mt-1 text-[11px] text-muted-foreground">
                Tip: semester filter is mainly for “Sem + Teacher” surveys.
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Created from
              </div>
              <Input
  type="date"
  value={fromDT}
  onChange={(e) => setFromDT(e.target.value)}
  className="w-[220px]"
/>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Created to
              </div>
              <Input
  type="date"
  value={toDT}
  onChange={(e) => setToDT(e.target.value)}
  className="w-[220px]"
/>
            </div>

            <div className="flex gap-2 pb-[2px]">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container py-8 space-y-6">
        <section>
          <h1 className="text-3xl font-semibold text-foreground">View Surveys</h1>
          <p className="mt-1 text-muted-foreground">
            Filter:{" "}
            <span className="font-medium text-foreground">
              {kind === "all"
                ? "All"
                : kind === "sem_tr"
                ? "Semester + Teacher"
                : "General"}
            </span>
            {" • "}Showing:{" "}
            <span className="font-medium text-foreground">
              {filtered.length}
            </span>
          </p>
        </section>

        {/* Surveys list */}
        <section className="card-elevated p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-foreground">
                Your Surveys
              </div>
              <div className="text-sm text-muted-foreground">
                Total: {filtered.length} survey
                {filtered.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No surveys found.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {filtered.map((s) => {
                const isSemTr = !!s.semester_id && !!s.teacher_id;
                const semesterName = s.semester_id
                  ? semesterNameById.get(s.semester_id) ?? s.semester_id
                  : null;

                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-foreground truncate">
                          {s.title}
                        </div>

                        <span
                          className={[
                            "text-xs rounded-full border px-2 py-0.5",
                            s.is_published
                              ? "border-success/40 text-success"
                              : "border-border text-muted-foreground",
                          ].join(" ")}
                        >
                          {s.is_published ? "Published" : "Draft"}
                        </span>

                        <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                          {s.response_count ?? 0} response(s)
                        </span>

                        <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                          {isSemTr ? "Semester + Teacher" : "General"}
                        </span>

                        {isSemTr && semesterName ? (
                          <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            Semester: {semesterName}
                          </span>
                        ) : null}
                      </div>

                      {s.description ? (
                        <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {s.description}
                        </div>
                      ) : null}

                      <div className="mt-2 text-xs text-muted-foreground">
                        Created: {formatDate(s.created_at)} • ID: {s.id}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* ✅ Publish button (ONLY publishing-related change) */}
                      {!s.is_published && (
                        <Button size="sm" onClick={() => handlePublish(s.id)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Publish
                        </Button>
                      )}

                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/surveys/${s.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Questions
                        </Link>
                      </Button>

                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/surveys/${s.id}/responses`}>
                          <MessageSquareText className="mr-2 h-4 w-4" />
                          Responses
                        </Link>
                      </Button>

                      <Button asChild size="sm">
                        <Link to={`/admin/surveys/${s.id}/analytics`}>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Charts
                        </Link>
                      </Button>
                      <Button
  size="sm"
  variant="destructive"
  onClick={() => handleDelete(s.id)}
>
  Delete
</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}