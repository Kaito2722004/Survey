import { supabase } from "@/integrations/supabase/client";

export type DbQuestion = {
  id: string;
  survey_id: string;
  title: string;
  type: string;
  options: any | null;
  order_index: number | null;
};

export type DbSurveyResponse = {
  id: string;
  survey_id: string;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};

export type ChartRow = {
  question: string;
  option1: number;
  option2: number;
  option3: number;
  option4: number;
  option5: number;
};

export function isOptionQuestion(q: DbQuestion) {
  return (
    q.type === "multiple_choice" || q.type === "dropdown" || q.type === "checkbox"
  );
}

// options can be: ["A","B"] OR { options: ["A","B"] }
export function getOptions(q: DbQuestion): string[] {
  const o = q.options;
  if (!o) return [];
  if (Array.isArray(o)) return o.map(String);
  if (typeof o === "object" && Array.isArray((o as any).options)) {
    return (o as any).options.map(String);
  }
  return [];
}

export async function fetchSurveyQuestions(surveyId: string) {
  const res = await supabase
    .from("questions")
    .select("id,survey_id,title,type,options,order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true });

  if (res.error) throw res.error;
  return (res.data ?? []) as DbQuestion[];
}

export async function fetchSurveyResponses(surveyId: string) {
  const res = await supabase
    .from("survey_responses")
    .select("id,survey_id,answers,submitted_at")
    .eq("survey_id", surveyId);

  if (res.error) throw res.error;
  return (res.data ?? []) as DbSurveyResponse[];
}

/** -----------------------------
 * Counting helpers (FIX)
 * Supports:
 *  - "opt-0" / "opt-1" stored answers
 *  - labels stored answers
 *  - numbers stored answers
 *  - checkbox arrays
 * ----------------------------- */

function parseOptIndex(val: unknown): number | null {
  if (typeof val !== "string") return null;
  const m = val.match(/^opt-(\d+)$/);
  if (!m) return null;
  const idx = Number(m[1]);
  return Number.isFinite(idx) ? idx : null;
}

function asString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "";
}

function countOptionAnswer(
  answer: unknown,
  optionLabels: string[],
  counts: number[]
) {
  // Case 1: stored as opt-0 / opt-1 ...
  const optIdx = parseOptIndex(answer);
  if (optIdx !== null && counts[optIdx] !== undefined) {
    counts[optIdx] += 1;
    return;
  }

  // Case 2: stored as label (or number-as-string)
  const raw = asString(answer).trim();
  if (!raw) return;

  const idxByLabel = optionLabels.findIndex((x) => String(x).trim() === raw);
  if (idxByLabel !== -1) {
    counts[idxByLabel] += 1;
  }
}

export function countOptionsForQuestion(
  q: DbQuestion,
  responses: DbSurveyResponse[],
  maxOptions = 5
) {
  const labels = getOptions(q).slice(0, maxOptions).map(String);
  const counts = new Array(labels.length).fill(0);

  for (const r of responses) {
    const raw = (r.answers ?? {})[q.id];

    // checkbox -> array
    if (Array.isArray(raw)) {
      for (const item of raw) countOptionAnswer(item, labels, counts);
      continue;
    }

    // dropdown / multiple choice -> single value
    countOptionAnswer(raw, labels, counts);
  }

  // pad to 5
  while (counts.length < 5) counts.push(0);
  return counts.slice(0, 5);
}

export function buildChartRow(q: DbQuestion, responses: DbSurveyResponse[]): ChartRow {
  const c = countOptionsForQuestion(q, responses, 5);
  return {
    question: q.title,
    option1: c[0],
    option2: c[1],
    option3: c[2],
    option4: c[3],
    option5: c[4],
  };
}