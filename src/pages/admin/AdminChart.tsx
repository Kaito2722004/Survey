import { SurveyAnalytics } from "@/components/analytics/SurveyAnalytics";
import { mockSurveyData } from "@/lib/mockData";

const AdminChart = () => {
  return (
    <SurveyAnalytics
      data={mockSurveyData}
      title="Teacher Evaluation Survey Results"
    />
  );
};

export default AdminChart;
