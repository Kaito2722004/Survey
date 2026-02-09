import supabase from "@/utils/supabase";

/** Matches your chart UI format */
export type AnalyticsSurveyResponse = {
  id: string;
  teacherId: string;
  teacherName: string;
  subject?: string;

  responses: {
    questionId: string;
    question: string;
    rating: number;
    category: "teaching" | "communication" | "knowledge" | "support" | "overall";
  }[];

  // ⛔ optional and NOT required to be set
  submittedAt?: string;
};

type DbSurvey = { id: string; teacher_id: string | null };
type DbTeacher = { id: string; name: string | null; email: string | null };
type DbQuestion = {
  id: string;
  title: string;
  type: string;
  options: string[] | null; // your DB uses text[]
  category: string | null;  // if you ran the SQL migration
  order_index: number | null;
};
type DbSurveyResponse = {
  id: string;
  survey_id: string;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};

/** If DB category missing, fallback guess based on title */
function guessCategory(title: string): AnalyticsSurveyResponse["responses"][number]["category"] {
  const t = title.toLowerCase();
  if (t.includes("clarity") || t.includes("explain") || t.includes("teaching") || t.includes("engage")) return "teaching";
  if (t.includes("respond") || t.includes("question") || t.includes("feedback") || t.includes("communicat")) return "communication";
  if (t.includes("expert") || t.includes("knowledge") || t.includes("material") || t.includes("subject")) return "knowledge";
  if (t.includes("help") || t.includes("available") || t.includes("support")) return "support";
  return "overall";
}

/**
 * Convert DB answer value into rating number 1–5.
 * Works with:
 * - numbers: 4
 * - numeric strings: "4"
 * - option ids: "opt-3" -> options[3] -> "4" -> 4
 */
function parseRatingFromAnswer(value: unknown, questionOptions?: string[] | null): number | null {
  if (value == null) return null;
  if (Array.isArray(value)) return null; // ignore checkbox arrays for rating charts

  if (typeof value === "number") {
    const n = Math.round(value);
    return n >= 1 && n <= 5 ? n : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    // direct number string
    const direct = Number(trimmed);
    if (Number.isFinite(direct)) {
      const n = Math.round(direct);
      return n >= 1 && n <= 5 ? n : null;
    }

    // "opt-3"
    const m = /^opt-(\d+)$/.exec(trimmed);
    if (m && questionOptions) {
      const idx = Number(m[1]);
      const optText = questionOptions[idx];
      if (!optText) return null;

      const digit = String(optText).match(/[1-5]/)?.[0];
if (!digit) return null;

const n = Number(digit);
return n >= 1 && n <= 5 ? n : null;
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
    }
  }

  return null;
}

/** MAIN: fetch real chart data for a surveyId */
export async function getSurveyAnalyticsData(surveyId: string): Promise<AnalyticsSurveyResponse[]> {
  // 1) survey -> teacher_id
  const { data: survey, error: sErr } = await supabase
    .from("surveys")
    .select("id, teacher_id")
    .eq("id", surveyId)
    .single<DbSurvey>();

  if (sErr) throw new Error(sErr.message);

  // 2) teacher info (optional)
  const teacherId = survey.teacher_id ?? "unknown";
  let teacherName = "Unknown Teacher";

  if (survey.teacher_id) {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id, name, email")
      .eq("id", survey.teacher_id)
      .single<DbTeacher>();

    if (teacher) teacherName = teacher.name ?? teacher.email ?? teacherName;
  }

  // subject not in your schema, keep placeholder
  const subject = "N/A";

  // 3) questions
  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, title, type, options, category, order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true })
    .returns<DbQuestion[]>();

  if (qErr) throw new Error(qErr.message);

  // 4) responses
  const { data: rows, error: rErr } = await supabase
    .from("survey_responses")
    .select("id, survey_id, answers, submitted_at")
    .eq("survey_id", surveyId)
    .order("submitted_at", { ascending: false })
    .returns<DbSurveyResponse[]>();

  if (rErr) throw new Error(rErr.message);

  // 5) convert rows -> chart format
  const result: AnalyticsSurveyResponse[] = (rows ?? [])
    .map((row) => {
      const answers = row.answers ?? {};

      const responses =
        (questions ?? [])
          .map((q) => {
            const rating = parseRatingFromAnswer(answers[q.id], q.options);
            if (rating == null) return null;

            const category =
              (q.category as AnalyticsSurveyResponse["responses"][number]["category"] | null) ??
              guessCategory(q.title);

            return {
              questionId: q.id,
              question: q.title,
              rating,
              category,
            };
          })
          .filter(Boolean) as AnalyticsSurveyResponse["responses"];

      return {
        id: row.id,
        teacherId,
        teacherName,
        subject,
        responses,
        submittedAt: row.submitted_at,
      };
    })
    .filter((r) => r.responses.length > 0);

  return result;
}

/* helpers for charts */
export function getRatingDistribution(data: AnalyticsSurveyResponse[]) {
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  data.forEach((row) => {
    row.responses.forEach((r) => {
      dist[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
    });
  });

  return Object.entries(dist).map(([rating, count]) => ({
    rating: `${rating} Star${rating !== "1" ? "s" : ""}`,
    value: count,
    numericRating: Number(rating),
  }));
}

export function getCategoryAverages(data: AnalyticsSurveyResponse[]) {
  const totals: Record<string, { sum: number; count: number }> = {};

  data.forEach((row) => {
    row.responses.forEach((r) => {
      if (!totals[r.category]) totals[r.category] = { sum: 0, count: 0 };
      totals[r.category].sum += r.rating;
      totals[r.category].count += 1;
    });
  });

  return Object.entries(totals).map(([category, v]) => ({
    category: category.charAt(0).toUpperCase() + category.slice(1),
    average: Math.round((v.sum / v.count) * 100) / 100,
  }));
}
