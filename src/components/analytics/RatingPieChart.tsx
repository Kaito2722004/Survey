import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface RatingData {
  rating: string;
  value: number;
  numericRating: number;
}

interface RatingPieChartProps {
  data: RatingData[];
  title: string;
  description?: string;
}

const COLORS = [
  'hsl(0, 84%, 60%)',    // 1 star - red
  'hsl(38, 92%, 50%)',   // 2 stars - orange
  'hsl(48, 96%, 53%)',   // 3 stars - yellow
  'hsl(142, 71%, 55%)',  // 4 stars - light green
  'hsl(142, 71%, 45%)',  // 5 stars - green
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-elevated">
        <p className="font-medium text-foreground">{data.rating}</p>
        <p className="text-sm text-muted-foreground">{data.value} responses</p>
      </div>
    );
  }
  return null;
};

export const RatingPieChart = ({ data, title, description }: RatingPieChartProps) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card className="glass-card animate-slide-up" style={{ animationDelay: '200ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.numericRating - 1]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center">
          <p className="text-sm text-muted-foreground">
            Total responses: <span className="font-medium text-foreground">{total}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
