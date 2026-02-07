export type QuestionType = 
  | 'short_answer' 
  | 'paragraph' 
  | 'multiple_choice' 
  | 'checkboxes' 
  | 'dropdown';

export interface QuestionOption {
  id: string;
  text: string;
}

export type QuestionCategory =
  | "teaching"
  | "communication"
  | "knowledge"
  | "support"
  | "overall";

export interface Question {
  id: string;
  type: QuestionType; // keep yours
  title: string;
  required: boolean;
  options?: QuestionOption[];
  category?: QuestionCategory; // ✅ ADD THIS
}


export interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  responseCount: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, string | string[]>;
  submittedAt: Date;
}
