import { useMemo, useState } from "react";
import { Users, FileText, Star, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RatingPieChart } from "./RatingPieChart";

import { CategoryRadarChart } from "./CategoryRadarChart";
import {
  SurveyResponse,
  getRatingDistribution,
  getAverageByQuestion,
  getAverageByTeacher,
  getCategoryAverages,
  teachers,
} from "@/lib/mockData";

interface SurveyAnalyticsProps {
  data: SurveyResponse[];
  title?: string;
}

export const SurveyAnalytics = ({
  data,
  title = "Survey Analytics Dashboard",
}: SurveyAnalyticsProps) => {
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");

  const filteredData = useMemo(() => {
    if (selectedTeacher === "all") return data;
    return data.filter((response) => response.teacherId === selectedTeacher);
  }, [data, selectedTeacher]);

  const stats = useMemo(() => {
    const totalResponses = filteredData.length;
    const allRatings = filteredData.flatMap((r) =>
      r.responses.map((resp) => resp.rating),
    );
    const averageRating =
      allRatings.length > 0
        ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2)
        : "0";
    const teacherCount = new Set(filteredData.map((r) => r.teacherId)).size;
    const highRatings = allRatings.filter((r) => r >= 4).length;
    const satisfactionRate =
      allRatings.length > 0
        ? Math.round((highRatings / allRatings.length) * 100)
        : 0;

    return { totalResponses, averageRating, teacherCount, satisfactionRate };
  }, [filteredData]);

  const ratingDistribution = useMemo(
    () => getRatingDistribution(filteredData),
    [filteredData],
  );
  const questionAverages = useMemo(
    () => getAverageByQuestion(filteredData),
    [filteredData],
  );
  const teacherAverages = useMemo(
    () => getAverageByTeacher(filteredData),
    [filteredData],
  );
  const categoryAverages = useMemo(
    () => getCategoryAverages(filteredData),
    [filteredData],
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-display gradient-text">
              {title}
            </h1>
            <p className="text-muted-foreground mt-2">
              Analyze student feedback and teacher performance metrics
            </p>
          </div>
          <div className="w-full md:w-64">
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="glass-card">
                <SelectValue placeholder="Filter by teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RatingPieChart
            data={ratingDistribution}
            title="Rating Distribution"
            description="Breakdown of all survey ratings"
          />
          <CategoryRadarChart
            data={categoryAverages}
            title="Performance by Category"
            description="Average scores across evaluation categories"
          />
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4 animate-fade-in">
          <p>
            Data based on {data.length} survey responses • Last updated:{" "}
            {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};
