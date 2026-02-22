// src/components/charts/chartsx.tsx
import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export type GeneralChartQuestion = {
  id: string;
  title: string;
  type: string;
  options: any | null;
};

export type GeneralChartResponse = {
  id: string;
  answers: Record<string, unknown> | null;
};

// ── Colors for each option slot ───────────────────────────────────────────────
const OPTION_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#16a34a"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOptionQuestion(q: GeneralChartQuestion) {
  const t = (q.type ?? "").toLowerCase();
  return (
    t === "multiple_choice" ||
    t === "dropdown" ||
    t === "checkbox" ||
    t === "checkboxes"
  );
}

function parseOptionsAny(options: any): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && Array.isArray((options as any).options))
    return (options as any).options.map(String);

  if (typeof options === "string") {
    const s = options.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).options))
        return (parsed as any).options.map(String);
    } catch {}
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(",")
        .map((x) => x.trim().replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, ""))
        .filter(Boolean);
    }
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
  const optIdx = parseOptIndex(answer);
  if (optIdx !== null && counts[optIdx] !== undefined) {
    counts[optIdx] += 1;
    return;
  }
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
    if (Array.isArray(raw)) {
      for (const item of raw) countSingleAnswer(item, labels, counts);
      continue;
    }
    countSingleAnswer(raw, labels, counts);
  }

  const paddedLabels = [...labels];
  while (paddedLabels.length < 5) paddedLabels.push("");
  const paddedCounts = [...counts];
  while (paddedCounts.length < 5) paddedCounts.push(0);

  return {
    labels: paddedLabels.slice(0, 5),
    counts: paddedCounts.slice(0, 5),
  };
}

// ── Truncate long question titles for axis labels ─────────────────────────────
function truncate(str: string, max = 32) {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// Custom X-axis tick that wraps the question title under the bar group
function QuestionTick(props: any) {
  const { x, y, payload } = props;
  const words = (payload.value as string).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 20) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current.trim());

  return (
    <g transform={`translate(${x},${y + 8})`}>
      {lines.slice(0, 3).map((line, i) => (
        <text
          key={i}
          x={0}
          y={i * 14}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize={11}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
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

  // processed: one entry per question, with counts per option and labels
  const processed = useMemo(() => {
    return optionQuestions.map((q) => {
      const { labels, counts } = countOptionsForQuestion(q, responses, maxOptions);
      return { question: q, labels, counts };
    });
  }, [optionQuestions, responses, maxOptions]);

  if (optionQuestions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No chartable questions found.
        <div className="mt-2">
          General chart needs question types: <code>multiple_choice</code>,{" "}
          <code>dropdown</code>, <code>checkbox</code>/<code>checkboxes</code> and
          valid <code>options</code>.
        </div>
      </div>
    );
  }

  // ── Transposed chart data ──────────────────────────────────────────────────
  // Each row = one option slot (opt 0..4)
  // Each column key = question title (used as dataKey)
  // So X axis = option index, bars = one bar per question, grouped per option
  //
  // BUT the user wants: X axis = questions, bars = options within each question
  // That is actually the ORIGINAL layout — one group per question, 5 bars per group.
  // The difference from before: NOW we show the question title on the X axis.
  //
  // So the chart data stays the same shape, we just re-enable the X axis label.

  const chartData = useMemo(() => {
    return processed.map(({ question, labels, counts }) => ({
      // Short title for the X axis tick
      questionShort: truncate(question.title, 28),
      // Full title for tooltip
      questionFull: question.title,
      option0: counts[0],
      option1: counts[1],
      option2: counts[2],
      option3: counts[3],
      option4: counts[4],
      _labels: labels,
    }));
  }, [processed]);

  const optionKeys = ["option0", "option1", "option2", "option3", "option4"] as const;

  // For tooltip: use labels from first question as fallback
  const firstLabels = processed[0]?.labels ?? ["", "", "", "", ""];

  return (
    <div className="space-y-8">
      {/* ── Bar chart: one group per question, bars = options ── */}
      <div>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 10, bottom: 80 }}
            barCategoryGap="25%"
            barGap={2}
          >
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />

            {/* X axis — question title under each group */}
            <XAxis
              dataKey="questionShort"
              tick={<QuestionTick />}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={80}
            />

            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Number of Responses",
                angle: -90,
                position: "insideLeft",
                fill: "#9ca3af",
                fontSize: 12,
                dx: -4,
              }}
            />

            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f1f5f9",
                fontSize: 13,
              }}
              labelFormatter={(label) => label}
              formatter={(value: number, name: string) => {
                const idx = optionKeys.indexOf(name as any);
                const label = idx >= 0 ? (firstLabels[idx] || `Option ${idx + 1}`) : name;
                return [value, label];
              }}
            />

            {optionKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={OPTION_COLORS[idx]}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
              >
                <LabelList
                  dataKey={key}
                  position="top"
                  style={{ fill: "#e2e8f0", fontSize: 11, fontWeight: 600 }}
                  formatter={(v: number) => (v === 0 ? "" : v)}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* Color-only legend */}
        <div className="flex items-center justify-center gap-3 mt-1">
          {OPTION_COLORS.map((color, i) => (
            <span
              key={i}
              style={{ backgroundColor: color }}
              className="inline-block w-5 h-3 rounded-sm"
            />
          ))}
        </div>
      </div>

      {/* ── Data Summary table ──────────────────────────────────────────────
          Transposed layout:
          - Header row: one column per question (question title as header)
          - Each body row: one option (color dot + label as row header)
      ── */}
      <div className="rounded-xl border border-border p-5 bg-card">
        <div className="text-lg font-semibold text-foreground mb-4">Data Summary</div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {/* First cell: empty (row headers are option names) */}
                <th className="py-3 pr-6 text-left font-medium text-muted-foreground w-12"></th>
                {/* One column per question */}
                {processed.map(({ question }, qi) => (
                  <th
                    key={qi}
                    className="py-3 px-4 text-left font-medium text-foreground max-w-[180px]"
                  >
                    <span className="block leading-snug">{question.title}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* One row per option slot (0..4) */}
              {Array.from({ length: maxOptions }).map((_, optIdx) => {
                // Check if any question has a label or count for this slot
                const hasAny = processed.some(
                  (p) => p.labels[optIdx] || p.counts[optIdx] > 0
                );
                if (!hasAny) return null;

                // Use the label from whichever question has one for this slot
                const optionLabel =
                  processed.find((p) => p.labels[optIdx])?.labels[optIdx] ||
                  `Option ${optIdx + 1}`;

                return (
                  <tr key={optIdx} className="border-b border-border/50">
                    {/* Row header: color dot only */}
                    <td className="py-3 pr-6">
                      <span
                        style={{ backgroundColor: OPTION_COLORS[optIdx] }}
                        className="inline-block w-4 h-4 rounded-sm"
                      />
                    </td>

                    {/* One cell per question showing count for this option */}
                    {processed.map(({ counts }, qi) => (
                      <td key={qi} className="py-3 px-4 text-foreground">
                        {counts[optIdx]}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Total row */}
              <tr className="border-t-2 border-border">
                <td className="py-3 pr-6 font-semibold text-foreground">Total</td>
                {processed.map(({ counts }, qi) => (
                  <td key={qi} className="py-3 px-4 font-semibold text-foreground">
                    {counts.reduce((a, b) => a + b, 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}