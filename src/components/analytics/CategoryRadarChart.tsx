import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CategoryData {
  category: string;
  average: number;
}

interface CategoryRadarChartProps {
  data: CategoryData[];
  title: string;
  description?: string;
}

const COLORS = [
  'hsl(221, 83%, 53%)',  // primary
  'hsl(142, 71%, 45%)',  // success
  'hsl(38, 92%, 50%)',   // warning
  'hsl(262, 83%, 58%)',  // accent
  'hsl(199, 89%, 48%)',  // info
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-elevated">
        <p className="font-medium text-foreground">{payload[0].payload.category}</p>
        <p className="text-sm text-muted-foreground">
          Average: <span className="font-semibold text-foreground">{payload[0].value.toFixed(2)}</span> / 5
        </p>
      </div>
    );
  }
  return null;
};

export const CategoryRadarChart = ({ data, title, description }: CategoryRadarChartProps) => {
  return (
    <Card className="glass-card animate-slide-up" style={{ animationDelay: '500ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="category" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                domain={[0, 5]} 
                tickCount={6}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
              <Bar 
                dataKey="average" 
                radius={[4, 4, 0, 0]}
                animationBegin={0}
                animationDuration={800}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
