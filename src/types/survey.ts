export type QuestionType = 
  | 'short_answer' 
  | 'paragraph' 
  | 'multiple_choice' 
  | 'checkbox' 
  | 'dropdown';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: QuestionOption[];
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
