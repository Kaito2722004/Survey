import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { Question } from "@/types/survey";

interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  responseCount: number;

  // Section + Teacher surveys
  sectionId?: string | null;
  teacherId?: string | null;

  // General survey targeting
  // [] => whole school
  // ["sectionId1","sectionId2"] => only those sections
  targetSectionIds?: string[];

  deadline?: string | null;
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
    sectionId?: string | null,
    teacherId?: string | null,
    deadline?: string | null,
  ) => Promise<Survey | null>;

  updateSurvey: (id: string, updates: Partial<Survey>) => Promise<void>;
  deleteSurvey: (id: string) => Promise<void>;
  getSurvey: (id: string) => Survey | undefined;
  getSurveyPublic: (id: string) => Promise<Survey | null>;

  addQuestion: (surveyId: string, question: Question) => Promise<void>;
  updateQuestion: (
    surveyId: string,
    questionId: string,
    updates: Partial<Question>,
  ) => Promise<void>;
  deleteQuestion: (surveyId: string, questionId: string) => Promise<void>;
  reorderQuestions: (surveyId: string, questions: Question[]) => Promise<void>;

  submitResponse: (
    surveyId: string,
    userId: string,
    answers: Record<string, string | string[]>,
    role?: string,
  ) => Promise<void>;

  getResponses: (surveyId: string) => Promise<SurveyResponse[]>;
  refreshSurveys: () => Promise<void>;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

const toDbType = (uiType: Question["type"]) => {
  if (uiType === "checkboxes") return "checkboxes";
  return uiType as string;
};

const toUiType = (dbType: string) => {
  if (dbType === "checkboxes") return "checkboxes";
  return dbType as Question["type"];
};

function normalizeOptions(options: any): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && Array.isArray(options.options)) {
    return options.options.map(String);
  }
  return [];
}

const convertDbQuestion = (dbQuestion: any): Question => {
  const opts = normalizeOptions(dbQuestion.options);
  return {
    id: dbQuestion.id,
    type: toUiType(dbQuestion.type),
    title: dbQuestion.title,
    required: dbQuestion.required,
    category: (dbQuestion.category ?? undefined) as any,
    options: opts.map((text, i) => ({ id: `opt-${i}`, text })),
  };
};

export const SurveyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchSurveys = useCallback(async () => {
    if (!user) {
      setSurveys([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Load surveys + their target sections via relation
      const { data: surveysData, error: surveysError } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,response_count,created_at,updated_at,section_id,teacher_id,deadline,survey_sections(section_id)",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (surveysError) throw surveysError;

      const base = (surveysData ?? []) as any[];
      if (base.length === 0) {
        setSurveys([]);
        setIsLoading(false);
        return;
      }

      const surveyIds = base.map((s) => s.id);

      const { data: qData, error: qErr } = await supabase
        .from("questions")
        .select("id,survey_id,title,type,options,required,order_index,category")
        .in("survey_id", surveyIds)
        .order("order_index", { ascending: true });

      if (qErr) throw qErr;

      const bySurvey = new Map<string, Question[]>();
      for (const q of (qData ?? []) as any[]) {
        const converted = convertDbQuestion(q);
        const arr = bySurvey.get(q.survey_id) ?? [];
        arr.push(converted);
        bySurvey.set(q.survey_id, arr);
      }

      const mapped: Survey[] = base.map((s) => {
        const targetSectionIds =
          (s.survey_sections ?? [])
            .map((x: any) => x.section_id)
            .filter(Boolean) ?? [];

        return {
          id: s.id,
          title: s.title,
          description: s.description ?? undefined,
          questions: bySurvey.get(s.id) ?? [],
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
          isPublished: !!s.is_published,
          responseCount: s.response_count ?? 0,
          sectionId: s.section_id ?? null,
          teacherId: s.teacher_id ?? null,
          targetSectionIds,
          deadline: s.deadline ?? null,
        };
      });

      setSurveys(mapped);
    } catch (e) {
      console.error(e);
      setSurveys([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const refreshSurveys = useCallback(async () => {
    await fetchSurveys();
  }, [fetchSurveys]);

  const getSurvey = (id: string) => surveys.find((s) => s.id === id);

  const getSurveyPublic = async (id: string): Promise<Survey | null> => {
    try {
      const { data: s, error: sErr } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,response_count,created_at,updated_at,section_id,teacher_id,deadline,survey_sections(section_id)",
        )
        .eq("id", id)
        .single();

      if (sErr) throw sErr;

      const { data: qs, error: qErr } = await supabase
        .from("questions")
        .select("id,survey_id,title,type,options,required,order_index,category")
        .eq("survey_id", id)
        .order("order_index", { ascending: true });

      if (qErr) throw qErr;

      const targetSectionIds =
        (s as any).survey_sections
          ?.map((x: any) => x.section_id)
          .filter(Boolean) ?? [];

      return {
        id: s.id,
        title: s.title,
        description: s.description ?? undefined,
        questions: (qs ?? []).map(convertDbQuestion),
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
        isPublished: !!s.is_published,
        responseCount: s.response_count ?? 0,
        sectionId: s.section_id ?? null,
        teacherId: s.teacher_id ?? null,
        targetSectionIds,
        deadline: (s as any).deadline ?? null,
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const createSurvey = async (
    title: string,
    description?: string,
    sectionId?: string | null,
    teacherId?: string | null,
    deadline?: string | null,
  ) => {
    if (!user) return null;

    const res = await supabase
      .from("surveys")
      .insert({
        user_id: user.id,
        title,
        description: description ?? null,
        is_published: false,
        response_count: 0,
        section_id: sectionId ?? null, // ← renamed
        teacher_id: teacherId ?? null,
        deadline: deadline ?? null,
      })
      .select("*")
      .single();

    if (res.error) throw res.error;

    const created: Survey = {
      id: res.data.id,
      title: res.data.title,
      description: res.data.description ?? undefined,
      questions: [],
      createdAt: new Date(res.data.created_at),
      updatedAt: new Date(res.data.updated_at),
      isPublished: !!res.data.is_published,
      responseCount: res.data.response_count ?? 0,
      sectionId: res.data.section_id ?? null, // ← renamed
      teacherId: res.data.teacher_id ?? null,
      targetSectionIds: [],
      deadline: res.data.deadline ?? null,
    };

    await fetchSurveys();
    return created;
  };

  const updateSurvey = async (id: string, updates: Partial<Survey>) => {
    // Optimistic update
    setSurveys((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s,
      ),
    );

    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined)
        payload.description = updates.description ?? null;
      if (updates.isPublished !== undefined)
        payload.is_published = updates.isPublished;
      if (updates.sectionId !== undefined)
        payload.section_id = updates.sectionId ?? null; // ← renamed
      if (updates.teacherId !== undefined)
        payload.teacher_id = updates.teacherId ?? null;
      if (updates.deadline !== undefined)
        payload.deadline = updates.deadline ?? null;

      // Handle general section targeting updates
      if (updates.targetSectionIds !== undefined) {
        const del = await supabase
          .from("survey_sections") // ← renamed
          .delete()
          .eq("survey_id", id);
        if (del.error) throw del.error;

        if (updates.targetSectionIds.length > 0) {
          const ins = await supabase
            .from("survey_sections") // ← renamed
            .insert(
              updates.targetSectionIds.map((sid) => ({
                survey_id: id,
                section_id: sid, // ← renamed
              })),
            );
          if (ins.error) throw ins.error;
        }
      }

      const res = await supabase.from("surveys").update(payload).eq("id", id);
      if (res.error) throw res.error;
    } catch (error) {
      console.error("Failed to update survey:", error);
      await fetchSurveys();
      throw error;
    }
  };

  const deleteSurvey = async (id: string) => {
    const res = await supabase.from("surveys").delete().eq("id", id);
    if (res.error) throw res.error;
    await fetchSurveys();
  };

  const addQuestion = async (surveyId: string, question: Question) => {
    setSurveys((prev) =>
      prev.map((s) => {
        if (s.id !== surveyId) return s;
        return {
          ...s,
          questions: [...s.questions, question],
          updatedAt: new Date(),
        };
      }),
    );

    try {
      const options = (question.options ?? []).map((o: any) => o.text);
      const res = await supabase.from("questions").insert({
        survey_id: surveyId,
        title: question.title,
        type: toDbType(question.type),
        options: options.length ? options : null,
        required: !!question.required,
        order_index: 9999,
        category: (question as any).category ?? null,
      });

      if (res.error) throw res.error;
      await fetchSurveys();
    } catch (error) {
      console.error("Failed to add question:", error);
      await fetchSurveys();
      throw error;
    }
  };

  const updateQuestion = async (
    surveyId: string,
    questionId: string,
    updates: Partial<Question>,
  ) => {
    setSurveys((prev) =>
      prev.map((s) => {
        if (s.id !== surveyId) return s;
        return {
          ...s,
          questions: s.questions.map((q) =>
            q.id === questionId ? { ...q, ...updates } : q,
          ),
          updatedAt: new Date(),
        };
      }),
    );

    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.type !== undefined)
        payload.type = toDbType(updates.type as any);
      if (updates.required !== undefined) payload.required = !!updates.required;
      if ((updates as any).category !== undefined)
        payload.category = (updates as any).category ?? null;
      if (updates.options !== undefined) {
        const arr = (updates.options ?? []).map((o: any) => o.text);
        payload.options = arr.length ? arr : null;
      }

      const res = await supabase
        .from("questions")
        .update(payload)
        .eq("id", questionId)
        .eq("survey_id", surveyId);

      if (res.error) throw res.error;
    } catch (error) {
      console.error("Failed to update question:", error);
      await fetchSurveys();
      throw error;
    }
  };

  const deleteQuestion = async (surveyId: string, questionId: string) => {
    setSurveys((prev) =>
      prev.map((s) => {
        if (s.id !== surveyId) return s;
        return {
          ...s,
          questions: s.questions.filter((q) => q.id !== questionId),
          updatedAt: new Date(),
        };
      }),
    );

    try {
      const res = await supabase
        .from("questions")
        .delete()
        .eq("id", questionId)
        .eq("survey_id", surveyId);

      if (res.error) throw res.error;
    } catch (error) {
      console.error("Failed to delete question:", error);
      await fetchSurveys();
      throw error;
    }
  };

  const reorderQuestions = async (surveyId: string, qs: Question[]) => {
    setSurveys((prev) =>
      prev.map((s) => {
        if (s.id !== surveyId) return s;
        return { ...s, questions: qs, updatedAt: new Date() };
      }),
    );

    try {
      const updates = qs.map((q, i) => ({ id: q.id, order_index: i }));
      for (const u of updates) {
        const res = await supabase
          .from("questions")
          .update({ order_index: u.order_index })
          .eq("id", u.id)
          .eq("survey_id", surveyId);

        if (res.error) throw res.error;
      }
    } catch (error) {
      console.error("Failed to reorder questions:", error);
      await fetchSurveys();
      throw error;
    }
  };

  // Now requires studentId since survey_responses.student_id references public.students
  const submitResponse = async (
    surveyId: string,
    userId: string,
    answers: Record<string, string | string[]>,
    role?: string,
  ) => {
    if (role === "organization") {
      const { error } = await supabase.from("survey_responses").insert({
        survey_id: surveyId,
        user_id: userId, // auth user id
        student_id: null, // not a student
        answers,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from("survey_responses").insert({
        survey_id: surveyId,
        student_id: userId, // public.students id
        answers,
      });
      if (error) throw error;
    }
  };

  const getResponses = async (surveyId: string): Promise<SurveyResponse[]> => {
    const res = await supabase
      .from("survey_responses")
      .select("id,survey_id,answers,submitted_at")
      .eq("survey_id", surveyId)
      .order("submitted_at", { ascending: false });

    if (res.error) throw res.error;

    const mapped: SurveyResponse[] = (res.data ?? []).map((r: any) => ({
      id: r.id,
      surveyId: r.survey_id,
      answers: (r.answers ?? {}) as Record<string, string | string[]>,
      submittedAt: new Date(r.submitted_at),
    }));

    setResponses(mapped);
    return mapped;
  };

  return (
    <SurveyContext.Provider
      value={{
        surveys,
        responses,
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
  const ctx = useContext(SurveyContext);
  if (!ctx) throw new Error("useSurvey must be used inside SurveyProvider");
  return ctx;
};
