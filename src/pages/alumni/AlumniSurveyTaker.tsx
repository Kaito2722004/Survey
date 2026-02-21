import { useState, useEffect, useRef } from "react";
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

type SurveyAccessRow = {
  id: string;
  is_published: boolean;
  survey_type: string | null;
  start_at: string | null;
  end_at: string | null;
  deadline: string | null;
};

function isSurveyOpenNow(s: SurveyAccessRow) {
  const now = new Date();
  const startAt = s.start_at ? new Date(s.start_at) : null;
  const endAt = s.end_at ? new Date(s.end_at) : null;
  const deadline = s.deadline ? new Date(s.deadline) : null;

  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;
  if (deadline && now > deadline) return false;

  return true;
}

export default function AlumniSurveyTaker() {
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
  const submitLockRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (!id || !user) return;

      setIsLoadingSurvey(true);
      setIsAllowed(null);

      // 1) load basic survey access info
      const { data: surveyRow, error: sErr } = await supabase
        .from("surveys")
        .select("id,is_published,survey_type,start_at,end_at,deadline")
        .eq("id", id)
        .maybeSingle();

      if (sErr || !surveyRow) {
        console.error(sErr);
        toast.error("Failed to load survey.");
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      const access = surveyRow as SurveyAccessRow;

      // must be published + alumni type + open now
      if (
        !access.is_published ||
        access.survey_type !== "alumni" ||
        !isSurveyOpenNow(access)
      ) {
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      // 2) Resolve alumni group ID:
      //    - First try studentRow.alumni_group_id (students with is_alumni=true)
      //    - Fall back to alumni_group_members table (portal alumni users)
      let myGroupId: string | null = user.studentRow?.alumni_group_id ?? null;

      if (!myGroupId) {
        const { data: mem, error: memErr } = await supabase
          .from("alumni_group_members")
          .select("alumni_group_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (memErr) {
          console.error(memErr);
          toast.error("Failed to check alumni group.");
          setIsAllowed(false);
          setIsLoadingSurvey(false);
          return;
        }

        myGroupId = mem?.alumni_group_id ?? null;
      }

      if (!myGroupId) {
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      // 3) check link survey -> my group
      const { data: link, error: linkErr } = await supabase
        .from("survey_alumni_groups")
        .select("id")
        .eq("survey_id", id)
        .eq("alumni_group_id", myGroupId)
        .maybeSingle();

      if (linkErr) {
        console.error(linkErr);
        toast.error("Failed to check survey access.");
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      if (!link) {
        setIsAllowed(false);
        setIsLoadingSurvey(false);
        return;
      }

      // Allowed ✅
      setIsAllowed(true);

      const surveyData = await getSurveyPublic(id);
      setSurvey(surveyData);

      if (surveyData) {
        const initial: Record<string, string | string[]> = {};
        surveyData.questions.forEach((q) => {
          if (q.type === ("checkbox" as any)) initial[q.id] = [];
          else initial[q.id] = "";
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
        if (!ans || ans.trim() === "")
          newErrors[q.id] = "This question is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (submitLockRef.current) return;
    if (isSubmitted) return;

    if (!validateAnswers()) {
      toast.error("Please fill in all required fields");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await submitResponse(id, user!.id, answers);
      setIsSubmitted(true);
    } catch (err: unknown) {
      const anyErr = err as any;
      const code = anyErr?.code;
      const msg = String(anyErr?.message ?? "").toLowerCase();

      if (code === "23505" || msg.includes("duplicate key")) {
        setIsSubmitted(true);
        toast.success("You already submitted this survey.");
        return;
      }

      console.error(err);
      toast.error("Failed to submit response. Please try again.");
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
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
            <h1 className="text-xl font-semibold text-foreground">
              Not allowed
            </h1>
            <p className="mt-2 text-muted-foreground">
              This survey is not for you (not published, closed, or not assigned
              to your alumni group).
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
            <h1 className="mb-2 text-xl font-semibold text-foreground">
              Survey Not Found
            </h1>
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
              <h1 className="mb-2 text-2xl font-semibold text-foreground">
                Thank You!
              </h1>
              <p className="text-muted-foreground">
                Your response has been recorded successfully.
              </p>
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
        <div className="card-elevated mb-6 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary to-accent" />
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                FormFlow
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              {survey.title}
            </h1>
            {survey.description && (
              <p className="mt-2 text-muted-foreground">{survey.description}</p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="text-destructive">*</span> Required
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {survey.questions.map((question, index) => (
            <div
              key={question.id}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <QuestionRenderer
                question={question}
                value={
                  answers[question.id] ||
                  (question.type === ("checkbox" as any) ? [] : "")
                }
                onChange={(value) => handleAnswerChange(question.id, value)}
                error={errors[question.id]}
              />
            </div>
          ))}
        </div>

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
            <p className="text-muted-foreground">
              This survey has no questions yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
