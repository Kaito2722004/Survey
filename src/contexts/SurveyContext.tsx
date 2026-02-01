import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Question, QuestionOption } from '@/types/survey';

interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  responseCount: number;

  semesterId?: string | null;
  teacherId?: string | null;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, string | string[]>;
  submittedAt: Date;
}

interface SurveyContextType {
  surveys: Survey[];
  responses: SurveyResponse[];
  isLoading: boolean;
  createSurvey: (
  title: string,
  description?: string,
  semesterId?: string | null,
  teacherId?: string | null
) => Promise<Survey | null>;
  updateSurvey: (id: string, updates: Partial<Survey>) => Promise<void>;
  deleteSurvey: (id: string) => Promise<void>;
  getSurvey: (id: string) => Survey | undefined;
  getSurveyPublic: (id: string) => Promise<Survey | null>;
  addQuestion: (surveyId: string, question: Question) => Promise<void>;
  updateQuestion: (surveyId: string, questionId: string, updates: Partial<Question>) => Promise<void>;
  deleteQuestion: (surveyId: string, questionId: string) => Promise<void>;
  reorderQuestions: (surveyId: string, questions: Question[]) => Promise<void>;
  submitResponse: (surveyId: string, answers: Record<string, string | string[]>) => Promise<void>;
  getResponses: (surveyId: string) => Promise<SurveyResponse[]>;
  refreshSurveys: () => Promise<void>;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

// Helper to convert DB question to frontend format
const convertDbQuestion = (dbQuestion: {
  id: string;
  type: string;
  title: string;
  options: string[] | null;
  required: boolean;
  order_index: number;
}): Question => ({
  id: dbQuestion.id,
  type: dbQuestion.type as Question['type'],
  title: dbQuestion.title,
  required: dbQuestion.required,
  options: dbQuestion.options?.map((text, i) => ({
    id: `opt-${i}`,
    text,
  })),
});

export const SurveyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchSurveys = useCallback(async () => {
    if (!user) {
      setSurveys([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data: surveysData, error: surveysError } = await supabase
  .from('surveys')
  .select('*')
  .eq('user_id', user.id)
  .order('updated_at', { ascending: false });


      if (surveysError) throw surveysError;

      if (!surveysData || surveysData.length === 0) {
        setSurveys([]);
        setIsLoading(false);
        return;
      }

      // Fetch questions for each survey
      const surveyIds = surveysData.map(s => s.id);
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('survey_id', surveyIds)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      const surveysWithQuestions: Survey[] = surveysData.map(survey => ({
  id: survey.id,
  title: survey.title,
  description: survey.description || undefined,
  isPublished: survey.is_published,
  responseCount: survey.response_count,
  createdAt: new Date(survey.created_at),
  updatedAt: new Date(survey.updated_at),
  semesterId: survey.semester_id ?? null,
  teacherId: survey.teacher_id ?? null,
  questions: (questionsData || [])
    .filter(q => q.survey_id === survey.id)
    .map(convertDbQuestion),
}));



      setSurveys(surveysWithQuestions);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const refreshSurveys = async () => {
    setIsLoading(true);
    await fetchSurveys();
  };
 /* ===== CRUD SURVEY ===== */
 
  const createSurvey = async (
  title: string,
  description?: string,
  semesterId?: string | null,
  teacherId?: string | null
): Promise<Survey | null> => {
  if (!user) return null;

  const { data, error } = await supabase
    .from('surveys')
   .insert({
  user_id: user.id,
  title,
  description: description || null,
  is_published: true,
  semester_id: semesterId ?? null,
  teacher_id: teacherId ?? null, // <-- now teacher_id
})

    .select()
    .single();

  if (error) {
    console.error('Error creating survey:', error);
    return null;
  }

  const newSurvey: Survey = {
  id: data.id,
  title: data.title,
  description: data.description || undefined,
  questions: [],
  createdAt: new Date(data.created_at),
  updatedAt: new Date(data.updated_at),
  isPublished: data.is_published,
  responseCount: data.response_count,
  semesterId: data.semester_id ?? null,
  teacherId: data.teacher_id ?? null,
};



  setSurveys(prev => [newSurvey, ...prev]);
  return newSurvey;
};


  const updateSurvey = async (id: string, updates: Partial<Survey>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.isPublished !== undefined) dbUpdates.is_published = updates.isPublished;

    const { error } = await supabase
      .from('surveys')
.update(dbUpdates)
.eq('id', id)
.eq('user_id', user?.id);


    if (error) {
      console.error('Error updating survey:', error);
      return;
    }

    setSurveys(prev =>
      prev.map(survey =>
        survey.id === id
          ? { ...survey, ...updates, updatedAt: new Date() }
          : survey
      )
    );
  };

  const deleteSurvey = async (id: string) => {
    const { error } = await supabase
      .from('surveys')
.delete()
.eq('id', id)
.eq('user_id', user?.id);


    if (error) {
      console.error('Error deleting survey:', error);
      return;
    }

    setSurveys(prev => prev.filter(survey => survey.id !== id));
  };

  const getSurvey = (id: string) => surveys.find(s => s.id === id);

  const getSurveyPublic = async (id: string): Promise<Survey | null> => {
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (surveyError || !surveyData) {
        console.error('Error fetching public survey:', surveyError);
        return null;
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('survey_id', id)
        .order('order_index', { ascending: true });

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        return null;
      }

      return {
        id: surveyData.id,
        title: surveyData.title,
        description: surveyData.description || undefined,
        isPublished: surveyData.is_published,
        responseCount: surveyData.response_count,
        createdAt: new Date(surveyData.created_at),
        updatedAt: new Date(surveyData.updated_at),
        questions: (questionsData || []).map(convertDbQuestion),
      };
    } catch (error) {
      console.error('Error in getSurveyPublic:', error);
      return null;
    }
  };

  const addQuestion = async (surveyId: string, question: Question) => {
    const survey = surveys.find(s => s.id === surveyId);
    const orderIndex = survey?.questions.length || 0;

    const dbQuestion = {
      survey_id: surveyId,
      type: question.type,
      title: question.title,
      options: question.options?.map(o => o.text) || [],
      required: question.required,
      order_index: orderIndex,
    };

    const { data, error } = await supabase
      .from('questions')
      .insert(dbQuestion)
      .select()
      .single();

    if (error) {
      console.error('Error adding question:', error);
      return;
    }

    const newQuestion = convertDbQuestion(data);

    setSurveys(prev =>
      prev.map(s =>
        s.id === surveyId
          ? { ...s, questions: [...s.questions, newQuestion], updatedAt: new Date() }
          : s
      )
    );
  };

  const updateQuestion = async (surveyId: string, questionId: string, updates: Partial<Question>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.required !== undefined) dbUpdates.required = updates.required;
    if (updates.options !== undefined) {
      dbUpdates.options = updates.options.map(o => o.text);
    }

    const { error } = await supabase
      .from('questions')
      .update(dbUpdates)
      .eq('id', questionId);

    if (error) {
      console.error('Error updating question:', error);
      return;
    }

    setSurveys(prev =>
      prev.map(survey =>
        survey.id === surveyId
          ? {
              ...survey,
              questions: survey.questions.map(q =>
                q.id === questionId ? { ...q, ...updates } : q
              ),
              updatedAt: new Date(),
            }
          : survey
      )
    );
  };

  const deleteQuestion = async (surveyId: string, questionId: string) => {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (error) {
      console.error('Error deleting question:', error);
      return;
    }

    setSurveys(prev =>
      prev.map(survey =>
        survey.id === surveyId
          ? {
              ...survey,
              questions: survey.questions.filter(q => q.id !== questionId),
              updatedAt: new Date(),
            }
          : survey
      )
    );
  };

  const reorderQuestions = async (surveyId: string, questions: Question[]) => {
    // Update order_index for each question
    const updates = questions.map((q, index) => 
      supabase
        .from('questions')
        .update({ order_index: index })
        .eq('id', q.id)
    );

    await Promise.all(updates);

    setSurveys(prev =>
      prev.map(survey =>
        survey.id === surveyId
          ? { ...survey, questions, updatedAt: new Date() }
          : survey
      )
    );
  };

  const submitResponse = async (surveyId: string, answers: Record<string, string | string[]>) => {
    const { error } = await supabase
      .from('survey_responses')
      .insert({
        survey_id: surveyId,
        answers,
      });

    if (error) {
      console.error('Error submitting response:', error);
      throw error;
    }

    // Update local state response count
    setSurveys(prev =>
      prev.map(survey =>
        survey.id === surveyId
          ? { ...survey, responseCount: survey.responseCount + 1 }
          : survey
      )
    );
  };

  const getResponses = async (surveyId: string): Promise<SurveyResponse[]> => {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching responses:', error);
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      surveyId: r.survey_id,
      answers: r.answers as Record<string, string | string[]>,
      submittedAt: new Date(r.submitted_at),
    }));
  };

  return (
    <SurveyContext.Provider
      value={{
        surveys,
        responses: [],
        isLoading,
        createSurvey,
        updateSurvey,
        deleteSurvey,
        getSurvey,
        getSurveyPublic,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        reorderQuestions,
        submitResponse,
        getResponses,
        refreshSurveys,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
};

export const useSurvey = () => {
  const context = useContext(SurveyContext);
  if (context === undefined) {
    throw new Error('useSurvey must be used within a SurveyProvider');
  }
  return context;
};
