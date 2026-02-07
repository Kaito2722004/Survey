import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SurveyAnalytics } from "@/components/analytics/SurveyAnalytics";
import { getSurveyAnalyticsData, type AnalyticsSurveyResponse } from "@/services/charts";

export default function AdminChart() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [data, setData] = useState<AnalyticsSurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) {
      setError("Missing surveyId");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = await getSurveyAnalyticsData(surveyId);
        if (!cancelled) setData(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load analytics";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  if (loading) return <div className="p-6">Loading charts…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return <SurveyAnalytics data={data} title="Teacher Evaluation Survey Results" />;
}
