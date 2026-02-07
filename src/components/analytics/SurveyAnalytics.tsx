import { useMemo, useState } from "react";
import { Users, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { RatingPieChart } from "./RatingPieChart";
import { CategoryRadarChart } from "./CategoryRadarChart";

import {
  type AnalyticsSurveyResponse,
  getRatingDistribution,
  getCategoryAverages,
} from "@/services/charts";

interface SurveyAnalyticsProps {
  data: AnalyticsSurveyResponse[];
  title?: string;
}

export const SurveyAnalytics = ({ data, title = "Survey Analytics Dashboard" }: SurveyAnalyticsProps) => {
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");

  const teachers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    data.forEach((r) => {
      if (!map.has(r.teacherId)) map.set(r.teacherId, { id: r.teacherId, name: r.teacherName });
    });
    return Array.from(map.values());
  }, [data]);

  const filteredData = useMemo(() => {
    if (selectedTeacher === "all") return data;
    return data.filter((r) => r.teacherId === selectedTeacher);
  }, [data, selectedTeacher]);

  const stats = useMemo(() => {
    const totalResponses = filteredData.length;
    const allRatings = filteredData.flatMap((r) => r.responses.map((x) => x.rating));

    const averageRating =
      allRatings.length > 0 ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2) : "0";

    const teacherCount = new Set(filteredData.map((r) => r.teacherId)).size;
    const highRatings = allRatings.filter((r) => r >= 4).length;
    const satisfactionRate = allRatings.length > 0 ? Math.round((highRatings / allRatings.length) * 100) : 0;

    return { totalResponses, averageRating, teacherCount, satisfactionRate };
  }, [filteredData]);

  const ratingDistribution = useMemo(() => getRatingDistribution(filteredData), [filteredData]);
  const categoryAverages = useMemo(() => getCategoryAverages(filteredData), [filteredData]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
            <p className="text-muted-foreground mt-2">Analyze student feedback and teacher performance metrics</p>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-card p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users size={16} /> Responses</div>
                <div className="text-2xl font-bold">{stats.totalResponses}</div>
              </div>

              <div className="glass-card p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Star size={16} /> Avg Rating</div>
                <div className="text-2xl font-bold">{stats.averageRating}</div>
              </div>

              <div className="glass-card p-3">
                <div className="text-sm text-muted-foreground">Teachers</div>
                <div className="text-2xl font-bold">{stats.teacherCount}</div>
              </div>

              <div className="glass-card p-3">
                <div className="text-sm text-muted-foreground">Satisfaction</div>
                <div className="text-2xl font-bold">{stats.satisfactionRate}%</div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-64">
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="glass-card">
                <SelectValue placeholder="Filter by teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RatingPieChart data={ratingDistribution} title="Rating Distribution" description="Breakdown of all survey ratings" />
          <CategoryRadarChart data={categoryAverages} title="Performance by Category" description="Average scores across evaluation categories" />
        </div>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Data based on {filteredData.length} responses • Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};
