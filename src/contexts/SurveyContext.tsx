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

  // Sem+Teacher surveys (existing)
  semesterId?: string | null;
  teacherId?: string | null;

  // General survey targeting (new)
  // [] => whole school
  // ["semId1","semId2"] => only those semesters
  targetSemesterIds?: string[];

  /** When the survey closes (ISO string or null) */
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
    semesterId?: string | null,
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
    answers: Record<string, string | string[]>,
  ) => Promise<void>;

  getResponses: (surveyId: string) => Promise<SurveyResponse[]>;
  refreshSurveys: () => Promise<void>;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

/** UI types sometimes use "checkboxes" — DB must be "checkbox" */
const toDbType = (uiType: Question["type"]) => {
  if (uiType === ("checkboxes" as any) || uiType === ("checkbox" as any))
    return "checkbox";
  return uiType as string;
};
const toUiType = (dbType: string) => {
  if (dbType === "checkboxes" || dbType === "checkbox")
    return "checkbox" as Question["type"];
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
      // Load surveys (+ their target semesters via relation)
      const { data: surveysData, error: surveysError } = await supabase
        .from("surveys")
        .select(
          "id,title,description,is_published,response_count,created_at,updated_at,semester_id,teacher_id,deadline,survey_semesters(semester_id)",
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

      // Load questions for those surveys
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
        const targetSemesterIds =
          (s.survey_semesters ?? [])
            .map((x: any) => x.semester_id)
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
          semesterId: s.semester_id ?? null,
          teacherId: s.teacher_id ?? null,
          targetSemesterIds,
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
          "id,title,description,is_published,response_count,created_at,updated_at,semester_id,teacher_id,deadline,survey_semesters(semester_id)",
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

      const targetSemesterIds =
        (s as any).survey_semesters
          ?.map((x: any) => x.semester_id)
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
        semesterId: s.semester_id ?? null,
        teacherId: s.teacher_id ?? null,
        targetSemesterIds,
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
    semesterId?: string | null,
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
        semester_id: semesterId ?? null,
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
      semesterId: res.data.semester_id ?? null,
      teacherId: res.data.teacher_id ?? null,
      targetSemesterIds: [],
      deadline: res.data.deadline ?? null,
    };

    await fetchSurveys();
    return created;
  };

  // ✅ OPTIMISTIC UPDATE - Instant UI feedback
  const updateSurvey = async (id: string, updates: Partial<Survey>) => {
    // ✅ 1. Update local state immediately (optimistic)
    setSurveys((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s,
      ),
    );

    try {
      // ✅ 2. Prepare database payload
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined)
        payload.description = updates.description ?? null;
      if (updates.isPublished !== undefined)
        payload.is_published = updates.isPublished;
      if (updates.semesterId !== undefined)
        payload.semester_id = updates.semesterId ?? null;
      if (updates.teacherId !== undefined)
        payload.teacher_id = updates.teacherId ?? null;
      if (updates.deadline !== undefined)
        payload.deadline = updates.deadline ?? null;

      // For general targeting updates:
      if (updates.targetSemesterIds !== undefined) {
        // Remove old
        const del = await supabase
          .from("survey_semesters")
          .delete()
          .eq("survey_id", id);
        if (del.error) throw del.error;

        // Insert new (empty => whole school)
        if (updates.targetSemesterIds.length > 0) {
          const ins = await supabase
            .from("survey_semesters")
            .insert(
              updates.targetSemesterIds.map((sid) => ({
                survey_id: id,
                semester_id: sid,
              })),
            );
          if (ins.error) throw ins.error;
        }
      }

      // ✅ 3. Update database in background
      const res = await supabase.from("surveys").update(payload).eq("id", id);
      if (res.error) throw res.error;

      // ✅ No fetchSurveys() here - optimistic update already done!
    } catch (error) {
      // ❌ If database update fails, revert to server state
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
    // ✅ Optimistic update
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
      // Store options in DB as string[]
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

      // ✅ Fetch only to get the real question ID from database
      await fetchSurveys();
    } catch (error) {
      console.error("Failed to add question:", error);
      await fetchSurveys();
      throw error;
    }
  };

  // ✅ OPTIMISTIC UPDATE for questions - Instant typing
  const updateQuestion = async (
    surveyId: string,
    questionId: string,
    updates: Partial<Question>,
  ) => {
    // ✅ 1. Update local state immediately
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
      // ✅ 2. Prepare database payload
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

      // ✅ 3. Update database in background
      const res = await supabase
        .from("questions")
        .update(payload)
        .eq("id", questionId)
        .eq("survey_id", surveyId);

      if (res.error) throw res.error;

      // ✅ No fetchSurveys() here - optimistic update already done!
    } catch (error) {
      // ❌ If database update fails, revert to server state
      console.error("Failed to update question:", error);
      await fetchSurveys();
      throw error;
    }
  };

  const deleteQuestion = async (surveyId: string, questionId: string) => {
    // ✅ Optimistic delete
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
    // ✅ Optimistic reorder
    setSurveys((prev) =>
      prev.map((s) => {
        if (s.id !== surveyId) return s;
        return {
          ...s,
          questions: qs,
          updatedAt: new Date(),
        };
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

  const submitResponse = async (
    surveyId: string,
    answers: Record<string, string | string[]>,
  ) => {
    const { error } = await supabase.from("survey_responses").insert({
      survey_id: surveyId,
      answers,
    });

    if (error) throw error;
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
