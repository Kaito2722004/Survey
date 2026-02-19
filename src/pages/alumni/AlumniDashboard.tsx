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

export default function AlumniDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [myGroupId, setMyGroupId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;

    setLoading(true);
    setSurveys([]);
    setMyGroupId(null);

    // 1) get my alumni group
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

    const groupId = mem?.alumni_group_id ?? null;
    setMyGroupId(groupId);

    if (!groupId) {
      // not assigned -> no surveys
      setLoading(false);
      return;
    }

    // 2) get survey ids for this group
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

    const surveyIds = (links ?? []).map((r: any) => r.survey_id).filter(Boolean) as string[];
    if (surveyIds.length === 0) {
      setSurveys([]);
      setLoading(false);
      return;
    }

    // 3) fetch published alumni surveys
    const { data: sdata, error: sErr } = await supabase
      .from("surveys")
      .select("id,title,description,created_at,start_at,end_at,deadline,is_published,survey_type,audience")
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

    // optional: filter by time window
    const visible = rows.filter(isSurveyOpenNow);

    setSurveys(visible);
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
    }));
  }, [surveys]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Alumni Dashboard</h1>
          <p className="mt-1 text-muted-foreground">You can answer surveys shared for your alumni group.</p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Account</div>
              <div className="text-xl font-semibold">{user?.name ?? "Alumni"}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Group:{" "}
                {myGroupId ? (
                  <code>{myGroupId}</code>
                ) : (
                  <span className="text-destructive">Not assigned to any alumni group yet</span>
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
            {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
          </div>

          {!loading && !myGroupId && (
            <div className="text-sm text-muted-foreground">
              You are not assigned to an alumni group. Please contact admin to assign you (e.g. 2024–2025).
            </div>
          )}

          {!loading && myGroupId && cards.length === 0 && (
            <div className="text-sm text-muted-foreground">No surveys available right now.</div>
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

                <div className="mt-1 text-lg font-semibold text-foreground">{s.title}</div>

                {s.description && <div className="mt-2 text-sm text-muted-foreground">{s.description}</div>}

                <div className="mt-4">
                  <Button asChild>
                    <Link to={`/alumni/survey/${s.id}`}>Answer Survey</Link>
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