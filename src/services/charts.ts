// src/services/charts.ts
// Single source of truth for analytics helpers used by Sem+Teacher charts (SurveyAnalytics, RatingPieChart, CategoryRadarChart).
// Also re-exports general-survey helpers from surveyAnalyticsService for AdminGeneralChart.

export {
  fetchSurveyQuestions,
  fetchSurveyResponses,
  buildChartRow,
  countOptionsForQuestion,
  getOptions,
  isOptionQuestion,
  type DbQuestion,
  type DbSurveyResponse,
  type ChartRow,
} from "@/services/surveyAnalyticsService";

// -----------------------------
// Types used by Sem+Teacher analytics UI
// -----------------------------
export type AnalyticsRatingRow = {
  questionId: string;
  question: string;
  rating: number;   // can be float; we bucket safely
  category: string; // can be missing; we normalize/guess
};

export type AnalyticsSurveyResponse = {
  id: string; // response id
  teacherId: string;
  teacherName: string;
  subject: string;
  submittedAt: string;
  responses: AnalyticsRatingRow[];
};

// Output type expected by RatingPieChart
export type RatingDistributionRow = {
  rating: string;
  value: number;
  numericRating: number;
};

// Output type expected by CategoryRadarChart
export type CategoryAverageRow = {
  category: string;
  average: number;
};

// -----------------------------
// Safe helpers
// -----------------------------
function normalizeRating(val: unknown): number | null {
  if (val === null || val === undefined) return null;

  const n =
    typeof val === "number"
      ? val
      : typeof val === "string"
      ? Number(val.trim())
      : NaN;

  if (!Number.isFinite(n)) return null;

  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

type Bucket = "teaching" | "communication" | "knowledge" | "support" | "overall";

function normalizeCategory(raw?: unknown): Bucket {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "overall";

  if (s.includes("teach") || s.includes("delivery") || s.includes("clarity") || s.includes("explain")) return "teaching";
  if (s.includes("communicat") || s.includes("feedback") || s.includes("respond") || s.includes("interaction")) return "communication";
  if (s.includes("know") || s.includes("expert") || s.includes("subject") || s.includes("content") || s.includes("material")) return "knowledge";
  if (s.includes("support") || s.includes("help") || s.includes("available") || s.includes("assist") || s.includes("guidance")) return "support";
  if (s.includes("overall") || s.includes("general")) return "overall";

  return "overall";
}

function guessCategoryFromTitle(title: string): Bucket {
  const t = title.toLowerCase();

  if (
    t.includes("teach") ||
    t.includes("explain") ||
    t.includes("clarity") ||
    t.includes("understand") ||
    t.includes("engage") ||
    t.includes("delivery") ||
    t.includes("pace")
  ) return "teaching";

  if (
    t.includes("communicat") ||
    t.includes("respond") ||
    t.includes("feedback") ||
    t.includes("question") ||
    t.includes("interaction") ||
    t.includes("discussion")
  ) return "communication";

  if (
    t.includes("knowledge") ||
    t.includes("expert") ||
    t.includes("material") ||
    t.includes("content") ||
    t.includes("subject") ||
    t.includes("concept")
  ) return "knowledge";

  if (
    t.includes("support") ||
    t.includes("help") ||
    t.includes("available") ||
    t.includes("assist") ||
    t.includes("guidance")
  ) return "support";

  return "overall";
}

function labelCategory(bucket: Bucket): string {
  return bucket.charAt(0).toUpperCase() + bucket.slice(1);
}

// -----------------------------
// Public analytics helpers used by SurveyAnalytics.tsx
// -----------------------------
export function getRatingDistribution(data: AnalyticsSurveyResponse[]): RatingDistributionRow[] {
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const row of data) {
    for (const r of row.responses) {
      const rr = normalizeRating(r.rating);
      if (!rr) continue;
      dist[rr] += 1;
    }
  }

  return Object.entries(dist).map(([rating, count]) => ({
    rating: `${rating} Star${rating !== "1" ? "s" : ""}`,
    value: count,
    numericRating: Number(rating),
  }));
}

export function getCategoryAverages(data: AnalyticsSurveyResponse[]): CategoryAverageRow[] {
  const totals: Record<Bucket, { sum: number; count: number }> = {
    teaching: { sum: 0, count: 0 },
    communication: { sum: 0, count: 0 },
    knowledge: { sum: 0, count: 0 },
    support: { sum: 0, count: 0 },
    overall: { sum: 0, count: 0 },
  };

  for (const row of data) {
    for (const r of row.responses) {
      const rr = normalizeRating(r.rating);
      if (!rr) continue;

      const bucket =
        r.category && String(r.category).trim()
          ? normalizeCategory(r.category)
          : guessCategoryFromTitle(r.question);

      totals[bucket].sum += rr;
      totals[bucket].count += 1;
    }
  }

  return (Object.entries(totals) as [Bucket, { sum: number; count: number }][])
    .filter(([, v]) => v.count > 0)
    .map(([bucket, v]) => ({
      category: labelCategory(bucket),
      average: Math.round((v.sum / v.count) * 100) / 100,
    }))
    .sort((a, b) => b.average - a.average);
}