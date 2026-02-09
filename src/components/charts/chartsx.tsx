// src/components/charts/chartsx.tsx
import React, { useMemo } from "react";
import { SurveyChart } from "@/components/charts/SurveyChart";

export type GeneralChartQuestion = {
  id: string;
  title: string;
  type: string;
  options: any | null; // can be array, object, or string (json)
};

export type GeneralChartResponse = {
  id: string;
  answers: Record<string, unknown> | null;
};

type ChartRow = {
  question: string;
  option1: number;
  option2: number;
  option3: number;
  option4: number;
  option5: number;
  _labels: string[];
};

function isOptionQuestion(q: GeneralChartQuestion) {
  const t = (q.type ?? "").toLowerCase();
  return (
    t === "multiple_choice" ||
    t === "dropdown" ||
    t === "checkbox" ||
    t === "checkboxes"
  );
}

/** ✅ handles:
 * - ["A","B"]
 * - { options: ["A","B"] }
 * - '["A","B"]'  (json string)
 * - '{A,B}'      (postgres text[] string just in case)
 * - "A,B" or "A\nB"
 */
function parseOptionsAny(options: any): string[] {
  if (!options) return [];

  // already array
  if (Array.isArray(options)) return options.map(String);

  // object { options: [...] }
  if (typeof options === "object" && Array.isArray((options as any).options)) {
    return (options as any).options.map(String);
  }

  // string (very common in your schema)
  if (typeof options === "string") {
    const s = options.trim();
    if (!s) return [];

    // try JSON
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).options)) {
        return (parsed as any).options.map(String);
      }
    } catch {
      // ignore
    }

    // postgres array style: {A,B} or {"A","B"}
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      // split by comma not inside quotes (simple enough for most cases)
      const parts = inner.split(",").map((x) => x.trim());
      return parts
        .map((p) => p.replace(/^"+|"+$/g, "")) // remove surrounding quotes
        .map((p) => p.replace(/^'+|'+$/g, ""))
        .filter(Boolean);
    }

    // fallback: comma or newline separated
    const parts = s.includes("\n") ? s.split("\n") : s.split(",");
    return parts.map((x) => x.trim()).filter(Boolean);
  }

  return [];
}

function parseOptIndex(val: unknown): number | null {
  if (typeof val !== "string") return null;
  const m = val.trim().match(/^opt-(\d+)$/i);
  if (!m) return null;
  const idx = Number(m[1]);
  return Number.isFinite(idx) ? idx : null;
}

function countSingleAnswer(answer: unknown, labels: string[], counts: number[]) {
  // Case 1: opt-0 / opt-1 ...
  const optIdx = parseOptIndex(answer);
  if (optIdx !== null && counts[optIdx] !== undefined) {
    counts[optIdx] += 1;
    return;
  }

  // Case 2: direct label match
  const raw =
    typeof answer === "string" || typeof answer === "number"
      ? String(answer).trim()
      : "";

  if (!raw) return;

  const idx = labels.findIndex((l) => String(l).trim() === raw);
  if (idx !== -1) counts[idx] += 1;
}

function countOptionsForQuestion(
  q: GeneralChartQuestion,
  responses: GeneralChartResponse[],
  maxOptions = 5
) {
  const labels = parseOptionsAny(q.options).slice(0, maxOptions).map(String);
  const counts = new Array(labels.length).fill(0);

  for (const r of responses) {
    const ans = r.answers ?? {};
    const raw = ans[q.id];

    // checkboxes -> array
    if (Array.isArray(raw)) {
      for (const item of raw) countSingleAnswer(item, labels, counts);
      continue;
    }

    // dropdown/mcq -> single
    countSingleAnswer(raw, labels, counts);
  }

  // pad to 5 for SurveyChart
  const paddedLabels = [...labels];
  while (paddedLabels.length < 5) paddedLabels.push("");

  const paddedCounts = [...counts];
  while (paddedCounts.length < 5) paddedCounts.push(0);

  return {
    labels: paddedLabels.slice(0, 5),
    counts: paddedCounts.slice(0, 5),
  };
}

export function GeneralSurveyChart({
  questions,
  responses,
  maxOptions = 5,
}: {
  questions: GeneralChartQuestion[];
  responses: GeneralChartResponse[];
  maxOptions?: number;
}) {
  const optionQuestions = useMemo(
    () => questions.filter(isOptionQuestion),
    [questions]
  );

  const data = useMemo<ChartRow[]>(() => {
    return optionQuestions.map((q) => {
      const { labels, counts } = countOptionsForQuestion(q, responses, maxOptions);
      return {
        question: q.title || "Untitled Question",
        option1: counts[0],
        option2: counts[1],
        option3: counts[2],
        option4: counts[3],
        option5: counts[4],
        _labels: labels,
      };
    });
  }, [optionQuestions, responses, maxOptions]);

  if (optionQuestions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No chartable questions found.
        <div className="mt-2">
          General chart needs question types: <code>multiple_choice</code>,{" "}
          <code>dropdown</code>, <code>checkbox</code>/<code>checkboxes</code> and valid{" "}
          <code>options</code>.
        </div>
      </div>
    );
  }

  const headerLabels = data[0]?._labels ?? ["", "", "", "", ""];

  return (
    <div className="space-y-8">
      <SurveyChart data={data} optionLabels={headerLabels} />

      <div className="rounded-xl border border-border p-5 bg-card">
        <div className="text-lg font-semibold text-foreground">Data Summary</div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="py-3 pr-4 font-medium">Question</th>
                <th className="py-3 pr-4 font-medium">{headerLabels[0] || "Option 1"}</th>
                <th className="py-3 pr-4 font-medium">{headerLabels[1] || "Option 2"}</th>
                <th className="py-3 pr-4 font-medium">{headerLabels[2] || "Option 3"}</th>
                <th className="py-3 pr-4 font-medium">{headerLabels[3] || "Option 4"}</th>
                <th className="py-3 pr-4 font-medium">{headerLabels[4] || "Option 5"}</th>
                <th className="py-3 pr-2 font-medium">Total</th>
              </tr>
            </thead>

            <tbody>
              {data.map((row, idx) => {
                const total =
                  row.option1 + row.option2 + row.option3 + row.option4 + row.option5;

                return (
                  <tr key={idx} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium">{row.question}</td>
                    <td className="py-3 pr-4">{row.option1}</td>
                    <td className="py-3 pr-4">{row.option2}</td>
                    <td className="py-3 pr-4">{row.option3}</td>
                    <td className="py-3 pr-4">{row.option4}</td>
                    <td className="py-3 pr-4">{row.option5}</td>
                    <td className="py-3 pr-2 font-semibold">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 text-xs text-muted-foreground">
            Note: For <code>checkboxes</code>, one student can increment multiple options.
          </div>
        </div>
      </div>
    </div>
  );
}