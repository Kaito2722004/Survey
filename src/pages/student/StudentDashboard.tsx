import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { notificationsService } from "@/services/notifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  section_id: string | null;
  teacher_id: string | null;
  deadline: string | null;
  survey_sections?: { section_id: string }[] | null;
};

type SectionRow = {
  id: string;
  sem: number;
  year_level: number;
  program: string;
  specialization: string;
};

type TeacherRow = { id: string; name: string };

function sectionLabel(s: SectionRow) {
  return `Y${s.year_level} ${s.specialization} — Sem ${s.sem} (${s.program})`;
}

function getDeadlineText(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  const now = new Date();
  const msLeft = end.getTime() - now.getTime();
  if (msLeft <= 0) return "EXPIRED";
  const msPerMin = 60 * 1000;
  const msPerHour = 60 * msPerMin;
  const msPerDay = 24 * msPerHour;
  if (msLeft < msPerHour) {
    const mins = Math.max(1, Math.ceil(msLeft / msPerMin));
    return mins === 1 ? "1 minute left" : `${mins} minutes left`;
  }
  if (msLeft < msPerDay) {
    const hours = Math.ceil(msLeft / msPerHour);
    return hours === 1 ? "1 hour left" : `${hours} hours left`;
  }
  const daysLeft = Math.ceil(msLeft / msPerDay);
  return daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
}

function isExpired(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { refetch: refetchNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);

  const [section, setSection] = useState<SectionRow | null>(null);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [teacherMap, setTeacherMap] = useState<Map<string, TeacherRow>>(
    new Map(),
  );
  const [answeredSurveyIds, setAnsweredSurveyIds] = useState<Set<string>>(
    new Set(),
  );
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // 1) Get section_id from AuthContext (set on student login)
      const sectionId = user.sectionId ?? null;

      // 2) Load section details
      if (sectionId) {
        const { data: secRow, error: secErr } = await supabase
          .from("sections")
          .select("id,sem,year_level,program,specialization")
          .eq("id", sectionId)
          .single();
        if (!secErr && secRow) setSection(secRow as SectionRow);
        else setSection(null);
      } else {
        setSection(null);
      }

      // 3) Load all published surveys
      const { data: all, error: allErr } = await supabase
        .from("surveys")
        .select(
          "id,title,description,created_at,section_id,teacher_id,deadline,survey_sections(section_id)",
        )
        .eq("is_published", true)
        .in("audience", ["student", "all"])
        .order("created_at", { ascending: false });

      if (allErr) {
        console.error(allErr);
        setSurveys([]);
        setTeacherMap(new Map());
        setLoading(false);
        return;
      }

      const allSurveys = (all ?? []) as SurveyRow[];

      // 4) Filter visible surveys for this student
      const visible = allSurveys.filter((s) => {
        const isTeacherSurvey = !!s.teacher_id;
        if (isTeacherSurvey) {
          if (!sectionId) return false;
          return s.section_id === sectionId;
        }
        const restricted = (s.survey_sections ?? []).map((x) => x.section_id);
        if (restricted.length > 0) {
          if (!sectionId) return false;
          return restricted.includes(sectionId);
        }
        return true;
      });

      setSurveys(visible);

      // 5) Check which surveys this student already answered
      if (visible.length > 0) {
        const surveyIds = visible.map((s) => s.id);
        const { data: responses, error: rErr } = await supabase
          .from("survey_responses")
          .select("survey_id")
          .eq("student_id", user.id)
          .in("survey_id", surveyIds);

        if (!rErr && responses) {
          setAnsweredSurveyIds(new Set(responses.map((r: any) => r.survey_id)));
        }
      }

      // 6) Load teacher names
      const teacherIds = Array.from(
        new Set(visible.map((s) => s.teacher_id).filter(Boolean) as string[]),
      );
      if (teacherIds.length > 0) {
        const { data: tRows, error: tErr } = await supabase
          .from("teachers")
          .select("id,name")
          .in("id", teacherIds);
        if (!tErr && tRows) {
          setTeacherMap(new Map(tRows.map((t) => [t.id, t as TeacherRow])));
        }
      } else {
        setTeacherMap(new Map());
      }

      setLoading(false);

      // 7) Notifications
      try {
        await notificationsService.ensureStudentNotifications(
          user.id,
          visible.map((s) => ({
            id: s.id,
            title: s.title,
            deadline: s.deadline,
          })),
        );
        refetchNotifications();
      } catch (e) {
        console.error("Ensure student notifications:", e);
        const err = e as { message?: string; error_description?: string };
        const msg =
          err?.message ??
          err?.error_description ??
          (e instanceof Error ? e.message : JSON.stringify(e));
        toast.error(`Notifications: ${msg}`);
      }
    };

    load();
  }, [user, refetchNotifications]);

  const cards = useMemo(() => {
    return surveys.map((s) => {
      const t = s.teacher_id ? teacherMap.get(s.teacher_id) : null;
      const restricted = (s.survey_sections ?? []).map((x) => x.section_id);

      const badge = s.teacher_id
        ? "Teacher Survey"
        : restricted.length > 0
          ? "General (Targeted)"
          : "General (School-wide)";

      const subLabel = s.teacher_id ? (t?.name ?? "Teacher") : "General";
      const deadlineText = getDeadlineText(s.deadline);
      const expired = isExpired(s.deadline);
      const alreadyAnswered = answeredSurveyIds.has(s.id);

      return { ...s, badge, subLabel, deadlineText, expired, alreadyAnswered };
    });
  }, [surveys, teacherMap, answeredSurveyIds]);

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Student Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and answer surveys assigned to your section.
          </p>
        </div>

        {/* Section info */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Your section</div>
              <div className="text-xl font-semibold">
                {section ? sectionLabel(section) : "Not assigned yet"}
              </div>
              {!section && (
                <div className="mt-1 text-sm text-muted-foreground">
                  You will only see{" "}
                  <span className="font-medium">school-wide</span> general
                  surveys.
                </div>
              )}
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Surveys */}
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
              <div
                key={s.id}
                className={[
                  "rounded-lg border p-4 transition-colors",
                  s.alreadyAnswered
                    ? "border-primary/30 bg-primary/5"
                    : "border-border",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    {s.subLabel}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.alreadyAnswered && (
                      <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Answered
                      </span>
                    )}
                    <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                      {s.badge}
                    </span>
                  </div>
                </div>

                <div className="mt-1 text-lg font-semibold text-foreground">
                  {s.title}
                </div>

                {s.description && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {s.description}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-2">
                  {s.alreadyAnswered ? (
                    <Button disabled variant="outline" className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Already Submitted
                    </Button>
                  ) : s.expired ? (
                    <Button onClick={() => setShowExpiredDialog(true)}>
                      Answer Survey
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link to={`/student/survey/${s.id}`}>Answer Survey</Link>
                    </Button>
                  )}
                  {s.deadlineText && !s.alreadyAnswered && (
                    <span
                      className={[
                        "text-xs",
                        s.deadlineText === "EXPIRED"
                          ? "text-destructive"
                          : "text-orange-500",
                      ].join(" ")}
                    >
                      {s.deadlineText}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <AlertDialog
          open={showExpiredDialog}
          onOpenChange={setShowExpiredDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Survey expired</AlertDialogTitle>
              <AlertDialogDescription>
                This survey has expired and can&apos;t be taken.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowExpiredDialog(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
