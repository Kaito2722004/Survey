import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useSurvey } from "@/contexts/SurveyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { QuestionRenderer } from "@/components/survey/QuestionRenderer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Survey } from "@/types/survey";
import { Header } from "@/components/layout/Header";

export default function StudentSurveyTaker() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getSurveyPublic, submitResponse } = useSurvey();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isLoadingSurvey, setIsLoadingSurvey] = useState(true);

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!id || !user) return;

      setIsLoadingSurvey(true);
      setIsAllowed(null);

      // 1) student semester
      const { data: semLink, error: semErr } = await supabase
        .from("semester_students")
        .select("semester_id")
        .eq("student_user_id", user.id)
        .maybeSingle();

      if (semErr) {
        console.error(semErr);
        toast.error("Failed to check your semester.");
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      if (!semLink?.semester_id) {
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      // 2) survey semester
      const { data: surveyRow, error: sErr } = await supabase
        .from("surveys")
        .select("semester_id,is_published")
        .eq("id", id)
        .maybeSingle();

      if (sErr) {
        console.error(sErr);
        toast.error("Failed to load survey.");
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      const allowed =
        !!surveyRow?.is_published && surveyRow?.semester_id === semLink.semester_id;

      setIsAllowed(allowed);

      if (!allowed) {
        setSurvey(null);
        setIsLoadingSurvey(false);
        return;
      }

      // 3) load survey + questions
      const surveyData = await getSurveyPublic(id);
      setSurvey(surveyData);

      // init answers
      if (surveyData) {
        const initial: Record<string, string | string[]> = {};
        surveyData.questions.forEach((q) => {
          // support both "checkbox" and "checkboxes"
          if (q.type === ("checkboxes" as any) || q.type === ("checkbox" as any)) {
            initial[q.id] = [];
          } else {
            initial[q.id] = "";
          }
        });
        setAnswers(initial);
      }

      setIsLoadingSurvey(false);
    };

    run();
  }, [id, user, getSurveyPublic]);

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const validateAnswers = (): boolean => {
    if (!survey) return false;

    const newErrors: Record<string, string> = {};
    survey.questions.forEach((q) => {
      if (!q.required) return;

      const ans = answers[q.id];
      if (Array.isArray(ans)) {
        if (ans.length === 0) newErrors[q.id] = "This question is required";
      } else {
        if (!ans || ans.trim() === "") newErrors[q.id] = "This question is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!id) return;

    if (!validateAnswers()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitResponse(id, answers);
      setIsSubmitted(true);
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit response. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSurvey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10 flex items-center justify-center">
          <div className="card-elevated p-8 max-w-md w-full text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Not allowed</h1>
            <p className="mt-2 text-muted-foreground">
              This survey is not for your semester (or it is not published).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-foreground">Survey Not Found</h1>
            <p className="text-muted-foreground">
              This survey doesn't exist or has been deleted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10 flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-scale-in text-center">
            <div className="card-elevated p-8">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-foreground">Thank You!</h1>
              <p className="text-muted-foreground">Your response has been recorded successfully.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-2xl py-8">
        {/* Survey Header */}
        <div className="card-elevated mb-6 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-accent" />
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">FormFlow</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">{survey.title}</h1>
            {survey.description && <p className="mt-2 text-muted-foreground">{survey.description}</p>}
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="text-destructive">*</span> Required
            </p>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {survey.questions.map((question, index) => (
            <div key={question.id} style={{ animationDelay: `${index * 100}ms` }}>
              <QuestionRenderer
                question={question}
                value={answers[question.id] || (question.type === ("checkboxes" as any) ? [] : "")}
                onChange={(value) => handleAnswerChange(question.id, value)}
                error={errors[question.id]}
              />
            </div>
          ))}
        </div>

        {/* Submit */}
        {survey.questions.length > 0 ? (
          <div className="mt-8 flex justify-end">
            <Button size="lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        ) : (
          <div className="card-elevated p-8 text-center mt-6">
            <p className="text-muted-foreground">This survey has no questions yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
