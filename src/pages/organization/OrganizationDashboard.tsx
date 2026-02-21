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
  survey_sections?: { section_id: string }[] | null;
  is_published?: boolean;
  target_role?: string | null;
  organization_id?: string | null;
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
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);

      console.groupCollapsed("[OrgDashboard] load()");
      console.log("auth user.id:", user.id);

      try {
        // Step 1: Load my profile
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("email, role, organization_id")
          .eq("user_id", user.id)
          .single();

        console.log("Step 1 profile:", profile, "error:", profileErr);

        if (profileErr || !profile) throw profileErr;

        const myEmail = (profile.email ?? "").toLowerCase();
        const myOrgId = profile.organization_id;

        console.log("Derived myEmail:", myEmail);
        console.log("Derived myOrgId:", myOrgId);

        // Step 2: Show org name
        if (!myOrgId) {
          setOrgName("Not assigned");
          console.log("Step 2 orgName: Not assigned (no org id)");
        } else {
          const { data: orgRow, error: orgErr } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", myOrgId)
            .maybeSingle();

          console.log("Step 2 orgRow:", orgRow, "error:", orgErr);

          if (orgErr) throw orgErr;
          setOrgName(orgRow?.name ?? "Organization");
        }

        // Step 3: Get my target group ids by organization_id
        let targetGroupIds: string[] = [];
        if (!myOrgId) {
          console.log(
            "Step 3 skipped: no org_id, so cannot match target_group_members.organization_id",
          );
        } else {
          const { data: members, error: memberErr } = await supabase
            .from("target_group_members")
            .select("target_group_id, organization_id")
            .eq("organization_id", myOrgId);

          console.log("Step 3 members:", members, "error:", memberErr);

          if (memberErr) throw memberErr;

          targetGroupIds = Array.from(
            new Set((members ?? []).map((m) => m.target_group_id)),
          );
        }

        console.log("Step 3 targetGroupIds:", targetGroupIds);

        // Step 4: Find survey ids assigned to those groups
        let surveyIdsFromGroups: string[] = [];
        if (targetGroupIds.length > 0) {
          const { data: stg, error: stgErr } = await supabase
            .from("survey_target_groups")
            .select("survey_id, target_group_id")
            .in("target_group_id", targetGroupIds);

          console.log("Step 4 survey_target_groups:", stg, "error:", stgErr);

          if (stgErr) throw stgErr;

          surveyIdsFromGroups = Array.from(
            new Set((stg ?? []).map((x) => x.survey_id)),
          );
        }

        console.log("Step 4 surveyIdsFromGroups:", surveyIdsFromGroups);

        // Step 5: Fetch surveys
        if (surveyIdsFromGroups.length === 0) {
          console.log("Step 5: no survey ids -> setSurveys([])");
          setSurveys([]);
          return;
        }

        const { data: all, error: surveyErr } = await supabase
          .from("surveys")
          .select(
            "id,title,description,deadline,created_at,is_published,target_role,survey_sections(section_id),organization_id",
          )
          .eq("is_published", true)
          .eq("target_role", "organization")
          .in("id", surveyIdsFromGroups)
          .order("created_at", { ascending: false });

        console.log("Step 5 surveys fetched:", all, "error:", surveyErr);

        if (surveyErr) throw surveyErr;

        // Step 6: Deduplicate by id
        const map = new Map<string, SurveyRow>();
        (all ?? []).forEach((s: any) => map.set(s.id, s as SurveyRow));
        const allSurveys = Array.from(map.values());

        console.log("Step 6 allSurveys (deduped):", allSurveys);

        const visible = allSurveys.filter((s) => {
          const restricted = (s.survey_sections ?? []).map((x) => x.section_id);
          return restricted.length === 0;
        });

        console.log("Step 6 visible after semester filter:", visible);

        setSurveys(visible);

        // Notifications
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
          console.error("Ensure organization notifications:", e);
          toast.error(
            "Notifications could not be created. Run the SQL in supabase-notification-insert-policy.sql in your Supabase SQL Editor.",
          );
        }
      } catch (e) {
        console.error("OrganizationDashboard load error:", e);
        setSurveys([]);
      } finally {
        setLoading(false);
        console.groupEnd();
      }
    };

    load();
  }, [user?.id, refetchNotifications]);

  const cards = useMemo(() => {
    return surveys.map((s) => ({
      ...s,
      deadlineText: getDeadlineText(s.deadline),
      expired: isExpired(s.deadline),
    }));
  }, [surveys]);

  return (
    <div className="min-h-screen bg-background md:pl-56">
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
              <div className="text-sm text-muted-foreground">
                Your organization
              </div>
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
                  <div className="text-sm text-muted-foreground">
                    Organization
                  </div>
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
                      <Link to={`/student/survey/${s.id}`}>Answer Survey</Link>
                    </Button>
                  )}

                  {s.deadlineText && (
                    <span className="text-xs text-red-600">
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
