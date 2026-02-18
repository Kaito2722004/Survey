import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { notificationsService } from "@/services/notifications";
import { supabase } from "@/integrations/supabase/client";
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
  deadline: string | null;
  created_at?: string;
  survey_semesters?: { semester_id: string }[] | null;
};

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

export default function OrganizationDashboard() {
  const { user } = useAuth();
  const { refetch: refetchNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);
  const [orgName, setOrgName] = useState<string>("Organization");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      try {
        // 1) Get my organization_id from profiles
        const { data: profile, error: profileErr } = await supabase
  .from("profiles")
  .select("email, organization_id")
  .eq("user_id", user.id)
  .single();

if (profileErr || !profile) {
  throw profileErr;
}

const myEmail = profile.email.toLowerCase();
        const profRes = await (supabase as any)
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        const { data: prof, error: profErr } = profRes as {
          data: { organization_id: string | null } | null;
          error: { message: string } | null;
        };

        if (profErr) throw profErr;

        const myOrgId = prof?.organization_id;
        if (!myOrgId) {
          // No org assigned => show nothing
          setSurveys([]);
          setOrgName("Not assigned");
          setLoading(false);
          return;
        }

        // 2) Fetch org name
        const orgRes = await (supabase as any)
          .from("organizations")
          .select("name")
          .eq("id", myOrgId)
          .maybeSingle();

        const { data: orgRow } = orgRes as { data: { name: string } | null };
        setOrgName(orgRow?.name ?? "Organization");

        // 3) Get target groups that include me (by org or by user)
        const { data: members, error: memberErr } = await supabase
  .from("target_group_members")
  .select("target_group_id")
  .or(
    `member_user_id.eq.${user.id},member_email.eq.${myEmail}`
  );

if (memberErr) {
  throw memberErr;
}

        const targetGroupIds = Array.from(
          new Set((members ?? []).map((m) => m.target_group_id))
        );

        // 4) Get survey ids assigned to those target groups
        let surveyIdsFromGroups: string[] = [];
        if (targetGroupIds.length > 0) {
          const stgRes = await (supabase as any)
            .from("survey_target_groups")
            .select("survey_id")
            .in("target_group_id", targetGroupIds);

          const { data: stg, error: stgErr } = stgRes as {
            data: { survey_id: string }[] | null;
            error: { message: string } | null;
          };
          if (stgErr) throw stgErr;

          surveyIdsFromGroups = Array.from(new Set((stg ?? []).map((x) => x.survey_id)));
        }

        // 5) Fetch surveys (published + org target role) AND visible to this org
        //    - either directly assigned by surveys.organization_id
        //    - or assigned via survey_target_groups
        const filters = [
          `organization_id.eq.${myOrgId}`,
          surveyIdsFromGroups.length ? `id.in.(${surveyIdsFromGroups.join(",")})` : "",
        ]
          .filter(Boolean)
          .join(",");

        const surveyRes = await (supabase as any)
          .from("surveys")
          .select("id,title,description,deadline,created_at,organization_id,is_published,target_role,survey_semesters(semester_id)")
          .eq("is_published", true)
          .eq("target_role", "organization")
          .or(filters)
          .order("created_at", { ascending: false });

        const { data: all, error: surveyErr } = surveyRes as {
          data: SurveyRow[] | null;
          error: { message: string } | null;
        };

        if (surveyErr) throw surveyErr;

        const allSurveys = (all ?? []) as SurveyRow[];

        // Your old rule: only show "school-wide" for org dashboard
        // If you ALSO want org-specific + group-specific, delete this filter.
        const visible = allSurveys.filter((s) => {
          const restricted = (s.survey_semesters ?? []).map((x) => x.semester_id);
          return restricted.length === 0;
        });

        setSurveys(visible);

        // Notifications
        try {
          await notificationsService.ensureStudentNotifications(
            user.id,
            visible.map((s) => ({ id: s.id, title: s.title, deadline: s.deadline }))
          );
          refetchNotifications();
        } catch (e) {
          console.error("Ensure organization notifications:", e);
          toast.error(
            "Notifications could not be created. Run the SQL in supabase-notification-insert-policy.sql in your Supabase SQL Editor."
          );
        }
      } catch (e) {
        console.error("OrganizationDashboard load:", e);
        setSurveys([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);
const cards = useMemo(() => {
  return surveys.map((s) => ({
    ...s,
    deadlineText: getDeadlineText(s.deadline),
    expired: isExpired(s.deadline),
  }));
}, [surveys]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Organization Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Surveys available for your organization.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Your organization</div>
              <div className="text-xl font-semibold">{orgName}</div>
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
            <div className="text-sm text-muted-foreground">
              No surveys available right now.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">Organization</div>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    Assigned to you
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
                  {s.expired ? (
                    <Button onClick={() => setShowExpiredDialog(true)}>
                      Answer Survey
                    </Button>
                  ) : (
                    <Button asChild>
                      {/* You currently reuse student route; keep it or make /organization/survey/:id */}
                      <Link to={`/student/survey/${s.id}`}>Answer Survey</Link>
                    </Button>
                  )}
                  {s.deadlineText && (
                    <span className="text-xs text-red-600">{s.deadlineText}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <AlertDialog open={showExpiredDialog} onOpenChange={setShowExpiredDialog}>
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