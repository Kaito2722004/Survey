// Updated: show group label instead of raw UUID + one submission per survey
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { supabase } from "@/integrations/supabase/client";
import { notificationsService } from "@/services/notifications";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  start_at: string | null;
  end_at: string | null;
  deadline: string | null;
  is_published: boolean;
  survey_type: string | null;
  audience: string | null;
};

function isSurveyOpenNow(s: SurveyRow) {
  const now = new Date();

  const startAt = s.start_at ? new Date(s.start_at) : null;
  const endAt = s.end_at ? new Date(s.end_at) : null;
  const deadline = s.deadline ? new Date(s.deadline) : null;

  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;
  if (deadline && now > deadline) return false;

  return true;
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

export default function AlumniDashboard() {
  const { user } = useAuth();
  const { refetch: refetchNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);

  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [submittedSurveyIds, setSubmittedSurveyIds] = useState<Set<string>>(new Set());
  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  const [myGroupLabel, setMyGroupLabel] = useState<string | null>(null);
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);

  const load = async () => {
    if (!user) return;

    setLoading(true);
    setSurveys([]);
    setSubmittedSurveyIds(new Set());
    setMyGroupId(null);
    setMyGroupLabel(null);

    // 1) Resolve alumni group ID
    let groupId: string | null = user.studentRow?.alumni_group_id ?? null;

    if (!groupId) {
      const { data: mem, error: memErr } = await supabase
        .from("alumni_group_members")
        .select("alumni_group_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memErr) {
        console.error(memErr);
        setLoading(false);
        return;
      }

      groupId = mem?.alumni_group_id ?? null;
    }

    setMyGroupId(groupId);

    if (!groupId) {
      setLoading(false);
      return;
    }

    // 2) Fetch the group label from alumni_groups
    const { data: groupRow, error: groupErr } = await supabase
      .from("alumni_groups")
      .select("label, start_year, end_year")
      .eq("id", groupId)
      .maybeSingle();

    if (!groupErr && groupRow) {
      setMyGroupLabel(
        `${groupRow.label} (${groupRow.start_year}–${groupRow.end_year})`,
      );
    }

    // 3) get survey ids for this group
    const { data: links, error: linkErr } = await supabase
      .from("survey_alumni_groups")
      .select("survey_id")
      .eq("alumni_group_id", groupId);

    if (linkErr) {
      console.error(linkErr);
      setSurveys([]);
      setLoading(false);
      return;
    }

    const surveyIds = (links ?? [])
      .map((r: any) => r.survey_id)
      .filter(Boolean) as string[];

    if (surveyIds.length === 0) {
      setSurveys([]);
      setLoading(false);
      return;
    }

    // 4) fetch published alumni surveys
    const { data: sdata, error: sErr } = await supabase
      .from("surveys")
      .select(
        "id,title,description,created_at,start_at,end_at,deadline,is_published,survey_type,audience",
      )
      .in("id", surveyIds)
      .eq("is_published", true)
      .eq("survey_type", "alumni")
      .order("created_at", { ascending: false });

    if (sErr) {
      console.error(sErr);
      setSurveys([]);
      setLoading(false);
      return;
    }

    const rows = (sdata ?? []) as SurveyRow[];
    setSurveys(rows);

    // 5) Check which surveys the current user already submitted
    //    Match on user_id OR student_id (alumni may be stored either way)
    if (rows.length > 0) {
      const surveyIdList = rows.map((s) => s.id);

      // Try user_id match first
      const { data: byUserId } = await supabase
        .from("survey_responses")
        .select("survey_id")
        .eq("user_id", user.id)
        .in("survey_id", surveyIdList);

      // Also try student_id match — use studentRow.id from user context first,
      // then fall back to DB lookup by email
      let resolvedStudentId: string | null = (user as any).studentRow?.id ?? null;
      if (!resolvedStudentId) {
        const { data: sRow } = await supabase
          .from("students")
          .select("id")
          .eq("email", (user as any).email ?? "")
          .maybeSingle();
        resolvedStudentId = sRow?.id ?? null;
      }

      let byStudentId: { survey_id: string }[] = [];
      if (resolvedStudentId) {
        const { data } = await supabase
          .from("survey_responses")
          .select("survey_id")
          .eq("student_id", resolvedStudentId)
          .in("survey_id", surveyIdList);
        byStudentId = data ?? [];
      }

      const allSubmitted = [
        ...(byUserId ?? []),
        ...byStudentId,
      ].map((r) => r.survey_id);

      console.log("[AlumniDashboard] submitted survey ids:", allSubmitted);
      setSubmittedSurveyIds(new Set(allSubmitted));
    }

    // Notifications
    if (user?.id && rows.length > 0) {
      try {
        await notificationsService.ensureStudentNotifications(
          user.id,
          rows.map((s) => ({ id: s.id, title: s.title, deadline: s.deadline })),
        );
        refetchNotifications();
      } catch (e) {
        console.error("Ensure alumni notifications:", e);
        const err = e as { message?: string; error_description?: string };
        const msg =
          err?.message ??
          err?.error_description ??
          (e instanceof Error ? e.message : JSON.stringify(e));
        toast.error(`Notifications: ${msg}`);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const cards = useMemo(() => {
    return surveys.map((s) => ({
      ...s,
      badge: "Alumni (Group)",
      deadlineText: getDeadlineText(s.deadline),
      expired: isExpired(s.deadline),
      openNow: isSurveyOpenNow(s),
      alreadySubmitted: submittedSurveyIds.has(s.id),
    }));
  }, [surveys, submittedSurveyIds]);

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Alumni Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            You can answer surveys shared for your alumni group.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Account</div>
              <div className="text-xl font-semibold">
                {user?.name ?? "Alumni"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Group:{" "}
                {myGroupLabel ? (
                  <span className="font-medium text-foreground">
                    {myGroupLabel}
                  </span>
                ) : myGroupId ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : (
                  <span className="text-destructive">
                    Not assigned to any alumni group yet
                  </span>
                )}
              </div>
            </div>

            <Button variant="outline" onClick={load}>
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

          {!loading && !myGroupId && (
            <div className="text-sm text-muted-foreground">
              You are not assigned to an alumni group. Please contact admin to
              assign you (e.g. 2024–2025).
            </div>
          )}

          {!loading && myGroupId && cards.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No surveys available right now.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">Alumni</div>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    {s.badge}
                  </span>
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
                  {s.alreadySubmitted ? (
                    <Button disabled variant="outline">
                      Already Submitted
                    </Button>
                  ) : s.expired ? (
                    <Button onClick={() => setShowExpiredDialog(true)}>
                      Answer Survey
                    </Button>
                  ) : s.openNow ? (
                    <Button asChild>
                      <Link to={`/alumni/survey/${s.id}`}>Answer Survey</Link>
                    </Button>
                  ) : (
                    <Button disabled variant="outline">
                      Not open yet
                    </Button>
                  )}
                  {s.deadlineText && (
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