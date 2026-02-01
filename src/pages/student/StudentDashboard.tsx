import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type SurveyListItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  teacher_id: string | null;
};

type SemesterRow = { id: string; name: string };
type TeacherRow = { id: string; name: string; email: string | null };

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [semester, setSemester] = useState<SemesterRow | null>(null);
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [teacherMap, setTeacherMap] = useState<Map<string, TeacherRow>>(new Map());

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // 1) student's semester_id
      const { data: semLink, error: semErr } = await supabase
        .from("semester_students")
        .select("semester_id")
        .eq("student_user_id", user.id)
        .maybeSingle();

      if (semErr) {
        console.error(semErr);
        setLoading(false);
        return;
      }

      if (!semLink?.semester_id) {
        setSemester(null);
        setSurveys([]);
        setTeacherMap(new Map());
        setLoading(false);
        return;
      }

      // 2) semester name
      const { data: semRow, error: semRowErr } = await supabase
        .from("semesters")
        .select("id,name")
        .eq("id", semLink.semester_id)
        .single();

      if (semRowErr) {
        console.error(semRowErr);
        setLoading(false);
        return;
      }
      setSemester(semRow);

      // 3) published surveys for this semester (NOTE: teacher_id, not teacher_user_id)
      const { data: surveyRows, error: surveyErr } = await supabase
        .from("surveys")
        .select("id,title,description,created_at,teacher_id")
        .eq("semester_id", semLink.semester_id)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (surveyErr) {
        console.error(surveyErr);
        setLoading(false);
        return;
      }

      const list = (surveyRows ?? []) as SurveyListItem[];
      setSurveys(list);

      // 4) load teacher names from teachers table
      const teacherIds = Array.from(
        new Set(list.map((s) => s.teacher_id).filter(Boolean) as string[])
      );

      if (teacherIds.length > 0) {
        const { data: tRows, error: tErr } = await supabase
          .from("teachers")
          .select("id,name,email")
          .in("id", teacherIds);

        if (!tErr && tRows) {
          setTeacherMap(new Map(tRows.map((t) => [t.id, t as TeacherRow])));
        } else {
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
      return {
        ...s,
        teacherName: t?.name || t?.email || "Teacher",
      };
    });
  }, [surveys, teacherMap]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Student Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            You can only answer surveys from your semester.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Your semester</div>
              <div className="text-xl font-semibold">
                {semester ? semester.name : "Not assigned yet"}
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>

          {!semester && (
            <div className="mt-4 text-sm text-muted-foreground">
              Ask admin to assign your account to a semester.
            </div>
          )}
        </div>

        <div className="card-elevated p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Available Surveys</h2>
            {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
          </div>

          {!loading && semester && cards.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No surveys yet for your semester.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <div className="text-sm text-muted-foreground">{s.teacherName}</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{s.title}</div>
                {s.description && (
                  <div className="mt-2 text-sm text-muted-foreground">{s.description}</div>
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
