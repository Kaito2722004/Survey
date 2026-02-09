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
  survey_semesters?: { semester_id: string }[] | null;
};

type SemesterRow = { id: string; name: string };
type TeacherRow = { id: string; name: string; email: string | null };

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [semester, setSemester] = useState<SemesterRow | null>(null);
  const [studentSemesterId, setStudentSemesterId] = useState<string | null>(null);

  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [teacherMap, setTeacherMap] = useState<Map<string, TeacherRow>>(new Map());

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // 1) student's semester_id (optional)
      const { data: semLink, error: semErr } = await supabase
        .from("semester_students")
        .select("semester_id")
        .eq("student_user_id", user.id)
        .maybeSingle();

      if (semErr) console.error(semErr);

      const semId = semLink?.semester_id ?? null;
      setStudentSemesterId(semId);

      // 2) semester name (only if assigned)
      if (semId) {
        const { data: semRow, error: semRowErr } = await supabase
          .from("semesters")
          .select("id,name")
          .eq("id", semId)
          .single();

        if (!semRowErr) setSemester(semRow);
        else {
          console.error(semRowErr);
          setSemester(null);
        }
      } else {
        setSemester(null);
      }

      // 3) Load all published surveys + targeted mapping
      const { data: all, error: allErr } = await supabase
        .from("surveys")
        .select("id,title,description,created_at,semester_id,teacher_id,survey_semesters(semester_id)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (allErr) {
        console.error(allErr);
        setSurveys([]);
        setTeacherMap(new Map());
        setLoading(false);
        return;
      }

      const allSurveys = (all ?? []) as SurveyRow[];

      // 4) Filter what student can see
      const visible = allSurveys.filter((s) => {
        const isTeacherSurvey = !!s.teacher_id;

        // Teacher surveys: only for student's semester
        if (isTeacherSurvey) {
          if (!semId) return false;
          return s.semester_id === semId;
        }

        // General surveys:
        const restricted = (s.survey_semesters ?? []).map((x) => x.semester_id);

        // If student has no semester: only show school-wide general (no restriction)
        if (!semId) {
          return restricted.length === 0;
        }

        // If survey is restricted to semesters:
        if (restricted.length > 0) {
          return restricted.includes(semId);
        }

        // Otherwise: school-wide general
        return true;
      });

      setSurveys(visible);

      // 5) Load teacher names for teacher surveys
      const teacherIds = Array.from(
        new Set(visible.map((s) => s.teacher_id).filter(Boolean) as string[])
      );

      if (teacherIds.length > 0) {
        const { data: tRows, error: tErr } = await supabase
          .from("teachers")
          .select("id,name,email")
          .in("id", teacherIds);

        if (!tErr && tRows) {
          setTeacherMap(new Map(tRows.map((t) => [t.id, t as TeacherRow])));
        } else {
          console.error(tErr);
          setTeacherMap(new Map());
        }
      } else {
        setTeacherMap(new Map());
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const cards = useMemo(() => {
    return surveys.map((s) => {
      const t = s.teacher_id ? teacherMap.get(s.teacher_id) : null;
      const restricted = (s.survey_semesters ?? []).map((x) => x.semester_id);

      const badge = s.teacher_id
        ? "Teacher Survey"
        : restricted.length > 0
        ? "General (Targeted)"
        : "General (School-wide)";

      const subLabel = s.teacher_id ? (t?.name || t?.email || "Teacher") : "General";

      return { ...s, badge, subLabel };
    });
  }, [surveys, teacherMap]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Student Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            You can answer school-wide surveys, targeted general surveys, and surveys from your semester.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Your semester</div>
              <div className="text-xl font-semibold">
                {semester ? semester.name : "Not assigned yet"}
              </div>
              {!semester && (
                <div className="mt-1 text-sm text-muted-foreground">
                  You will only see <span className="font-medium">school-wide</span> general surveys.
                </div>
              )}
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
            <div className="text-sm text-muted-foreground">No surveys available right now.</div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">{s.subLabel}</div>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    {s.badge}
                  </span>
                </div>

                <div className="mt-1 text-lg font-semibold text-foreground">{s.title}</div>

                {s.description && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {s.description}
                  </div>
                )}

                <div className="mt-4">
                  <Button asChild>
                    <Link to={`/student/survey/${s.id}`}>Answer Survey</Link>
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