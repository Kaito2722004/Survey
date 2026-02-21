import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";

// these must exist already
import AdminChart from "@/components/charts/AdminChart";
import AdminGeneralChart from "@/components/charts/AdminGeneralChart";

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  semester_id: string | null;
  teacher_id: string | null;
};

export default function AdminSurveyAnalytics() {
  // ✅ route is /admin/surveys/:surveyId/analytics
  const { surveyId } = useParams<{ surveyId: string }>();

  const [survey, setSurvey] = useState<SurveyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!surveyId) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("surveys")
        .select("id,title,description,semester_id,teacher_id")
        .eq("id", surveyId)
        .maybeSingle();

      if (error || !data) {
        console.error(error);
        setSurvey(null);
        setLoading(false);
        return;
      }

      setSurvey(data as SurveyRow);
      setLoading(false);
    };

    run();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background md:pl-56">
        <Header />
        <div className="container py-10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10 space-y-4">
          <p className="text-muted-foreground">Survey not found.</p>
          <Button asChild variant="outline">
            <Link to="/admin/surveys">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isSemTeacher = !!survey.semester_id && !!survey.teacher_id;

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Survey Charts
            </h1>
            <p className="text-muted-foreground">
              {isSemTeacher
                ? "Sem + Teacher survey analytics"
                : "General survey analytics"}
            </p>
          </div>

          <Button asChild variant="outline">
            <Link to="/admin/surveys">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        {/* ✅ Decide which chart UI to show */}
        {isSemTeacher ? <AdminChart /> : <AdminGeneralChart />}
      </div>
    </div>
  );
}
