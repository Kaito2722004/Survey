// src/components/charts/SurveyChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface SurveyData {
  question: string;
  option1: number;
  option2: number;
  option3: number;
  option4: number;
  option5: number;
}

interface SurveyChartProps {
  data: SurveyData[];
  /** Optional: use real option labels (General survey) */
  optionLabels?: string[]; // length up to 5
}

const OPTION_COLORS = [
  "hsl(var(--chart-option-1))",
  "hsl(var(--chart-option-2))",
  "hsl(var(--chart-option-3))",
  "hsl(var(--chart-option-4))",
  "hsl(var(--chart-option-5))",
];

const DEFAULT_OPTION_LABELS = ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"];
const COLORS = [
  "hsl(0, 84%, 60%)",    // 1 star - red
  "hsl(38, 92%, 50%)",   // 2 stars - orange
  "hsl(48, 96%, 53%)",   // 3 stars - yellow
  "hsl(142, 71%, 55%)",  // 4 stars - light green
  "hsl(142, 71%, 45%)",  // 5 stars - green
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <p className="font-semibold text-card-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-card-foreground">{entry.value} students</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="hsl(var(--foreground))"
      textAnchor="middle"
      fontSize={11}
      fontWeight={500}
    >
      {value}
    </text>
  );
};

export function SurveyChart({ data, optionLabels }: SurveyChartProps) {
  const labels = (optionLabels && optionLabels.length ? optionLabels : DEFAULT_OPTION_LABELS)
    .slice(0, 5)
    .map((l, i) => (String(l || "").trim() ? String(l).trim() : DEFAULT_OPTION_LABELS[i]));

  const barSize =
    data.length <= 3 ? 24 : data.length <= 5 ? 18 : data.length <= 7 ? 14 : 10;

  return (
    <div className="w-full h-[500px] p-6 bg-card rounded-xl border border-border shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
          barGap={2}
          barCategoryGap={data.length <= 3 ? "20%" : data.length <= 5 ? "15%" : "10%"}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="question"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            allowDecimals={false}
            label={{
              value: "Number of Students",
              angle: -90,
              position: "insideLeft",
              style: {
                textAnchor: "middle",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 12,
              },
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span style={{ color: "hsl(var(--foreground))", fontSize: 13 }}>{value}</span>
            )}
          />

         <Bar dataKey="option1" name={labels[0]} fill={COLORS[0]} radius={[4, 4, 0, 0]} barSize={barSize}>
  <LabelList dataKey="option1" content={renderCustomizedLabel} />
</Bar>

<Bar dataKey="option2" name={labels[1]} fill={COLORS[1]} radius={[4, 4, 0, 0]} barSize={barSize}>
  <LabelList dataKey="option2" content={renderCustomizedLabel} />
</Bar>

<Bar dataKey="option3" name={labels[2]} fill={COLORS[2]} radius={[4, 4, 0, 0]} barSize={barSize}>
  <LabelList dataKey="option3" content={renderCustomizedLabel} />
</Bar>

<Bar dataKey="option4" name={labels[3]} fill={COLORS[3]} radius={[4, 4, 0, 0]} barSize={barSize}>
  <LabelList dataKey="option4" content={renderCustomizedLabel} />
</Bar>

<Bar dataKey="option5" name={labels[4]} fill={COLORS[4]} radius={[4, 4, 0, 0]} barSize={barSize}>
  <LabelList dataKey="option5" content={renderCustomizedLabel} />
</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}