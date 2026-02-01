export interface SurveyResponse {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  responses: {
    questionId: string;
    question: string;
    rating: number; // 1-5 scale
    category:
      | "teaching"
      | "communication"
      | "knowledge"
      | "support"
      | "overall";
  }[];
  submittedAt: string;
}

export interface Question {
  id: string;
  text: string;
  category: "teaching" | "communication" | "knowledge" | "support" | "overall";
}

export const questions: Question[] = [
  { id: "q1", text: "Clarity of explanations", category: "teaching" },
  { id: "q2", text: "Responsiveness to questions", category: "communication" },
  { id: "q3", text: "Subject matter expertise", category: "knowledge" },
  { id: "q4", text: "Availability for help", category: "support" },
  { id: "q5", text: "Overall teaching effectiveness", category: "overall" },
  { id: "q6", text: "Engagement in class", category: "teaching" },
  { id: "q7", text: "Feedback quality", category: "communication" },
  { id: "q8", text: "Course material preparation", category: "knowledge" },
];

export const teachers = [
  { id: "t1", name: "Dr. Sarah Johnson", subject: "Mathematics" },
  { id: "t2", name: "Prof. Michael Chen", subject: "Physics" },
  { id: "t3", name: "Dr. Emily Williams", subject: "Chemistry" },
  { id: "t4", name: "Prof. David Brown", subject: "Biology" },
];

// Generate mock survey responses
const generateResponses = (): SurveyResponse[] => {
  const responses: SurveyResponse[] = [];

  teachers.forEach((teacher) => {
    // Generate 25-40 responses per teacher
    const numResponses = Math.floor(Math.random() * 16) + 25;

    for (let i = 0; i < numResponses; i++) {
      const baseRating = Math.random() * 2 + 3; // Base rating between 3-5

      responses.push({
        id: `${teacher.id}-${i}`,
        teacherId: teacher.id,
        teacherName: teacher.name,
        subject: teacher.subject,
        responses: questions.map((q) => ({
          questionId: q.id,
          question: q.text,
          rating: Math.min(
            5,
            Math.max(1, Math.round(baseRating + (Math.random() - 0.5) * 2)),
          ),
          category: q.category,
        })),
        submittedAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }
  });

  return responses;
};

export const mockSurveyData = generateResponses();

// Helper functions for data analysis
export const getRatingDistribution = (
  data: SurveyResponse[],
  questionId?: string,
) => {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  data.forEach((survey) => {
    survey.responses.forEach((response) => {
      if (!questionId || response.questionId === questionId) {
        distribution[response.rating as keyof typeof distribution]++;
      }
    });
  });

  return Object.entries(distribution).map(([rating, count]) => ({
    rating: `${rating} Star${rating !== "1" ? "s" : ""}`,
    value: count,
    numericRating: parseInt(rating),
  }));
};

export const getAverageByQuestion = (data: SurveyResponse[]) => {
  const questionTotals: Record<
    string,
    { sum: number; count: number; question: string }
  > = {};

  data.forEach((survey) => {
    survey.responses.forEach((response) => {
      if (!questionTotals[response.questionId]) {
        questionTotals[response.questionId] = {
          sum: 0,
          count: 0,
          question: response.question,
        };
      }
      questionTotals[response.questionId].sum += response.rating;
      questionTotals[response.questionId].count++;
    });
  });

  return Object.entries(questionTotals).map(([id, data]) => ({
    questionId: id,
    question: data.question,
    average: Math.round((data.sum / data.count) * 100) / 100,
  }));
};

export const getAverageByTeacher = (data: SurveyResponse[]) => {
  const teacherTotals: Record<
    string,
    { sum: number; count: number; name: string; subject: string }
  > = {};

  data.forEach((survey) => {
    if (!teacherTotals[survey.teacherId]) {
      teacherTotals[survey.teacherId] = {
        sum: 0,
        count: 0,
        name: survey.teacherName,
        subject: survey.subject,
      };
    }
    survey.responses.forEach((response) => {
      teacherTotals[survey.teacherId].sum += response.rating;
      teacherTotals[survey.teacherId].count++;
    });
  });

  return Object.entries(teacherTotals).map(([id, data]) => ({
    teacherId: id,
    name: data.name,
    subject: data.subject,
    average: Math.round((data.sum / data.count) * 100) / 100,
    responseCount: data.count / questions.length,
  }));
};

export const getCategoryAverages = (data: SurveyResponse[]) => {
  const categoryTotals: Record<string, { sum: number; count: number }> = {};

  data.forEach((survey) => {
    survey.responses.forEach((response) => {
      if (!categoryTotals[response.category]) {
        categoryTotals[response.category] = { sum: 0, count: 0 };
      }
      categoryTotals[response.category].sum += response.rating;
      categoryTotals[response.category].count++;
    });
  });

  return Object.entries(categoryTotals).map(([category, data]) => ({
    category: category.charAt(0).toUpperCase() + category.slice(1),
    average: Math.round((data.sum / data.count) * 100) / 100,
  }));
};
