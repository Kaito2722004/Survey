import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  CheckSquare,
  CircleDot,
  Eye,
  Link as LinkIcon,
  Loader2,
  Plus,
  Type,
  AlignLeft,
  Star,
} from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSurvey } from "@/contexts/SurveyContext";
import { QuestionEditor } from "@/components/survey/QuestionEditor";
import { Question, QuestionType } from "@/types/survey";
import { useDebounce } from "@/hooks/useDebounce";

const questionTypes: {
  value: QuestionType;
  label: string;
  icon: JSX.Element;
}[] = [
  {
    value: "short_answer",
    label: "Short Answer",
    icon: <Type className="h-4 w-4" />,
  },
  {
    value: "paragraph",
    label: "Paragraph",
    icon: <AlignLeft className="h-4 w-4" />,
  },
  {
    value: "multiple_choice",
    label: "Multiple Choice",
    icon: <CircleDot className="h-4 w-4" />,
  },
  {
    value: "checkboxes",
    label: "Checkboxes",
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    value: "dropdown",
    label: "Dropdown",
    icon: <ChevronDown className="h-4 w-4" />,
  },
];

const HAS_OPTIONS = new Set<QuestionType>([
  "multiple_choice",
  "checkboxes",
  "dropdown",
]);

export default function SurveyEditor() {
  const params = useParams<{
    surveyId?: string;
    id?: string;
    survey_id?: string;
  }>();
  const navigate = useNavigate();

  const {
    getSurvey,
    updateSurvey,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    isLoading,
  } = useSurvey();

  const surveyId = params.surveyId || params.id || params.survey_id || "";
  const survey = surveyId ? getSurvey(surveyId) : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const hasCheckedSurvey = useRef(false);
  const initializedSurveyId = useRef<string>("");

  // ✅ Debounced save functions - only save, not state updates
  const debouncedSaveTitle = useDebounce(async (newTitle: string) => {
    if (surveyId) {
      await updateSurvey(surveyId, { title: newTitle });
    }
  }, 500);

  const debouncedSaveDescription = useDebounce(
    async (newDescription: string) => {
      if (surveyId) {
        await updateSurvey(surveyId, { description: newDescription });
      }
    },
    500,
  );

  useEffect(() => {
    if (!surveyId) {
      toast.error("Missing survey id");
      navigate("/admin/surveys");
    }
  }, []);

  // ✅ FIXED: Only initialize state once when survey loads or changes
  useEffect(() => {
    if (survey && survey.id !== initializedSurveyId.current) {
      setTitle(survey.title ?? "");
      setDescription(survey.description ?? "");
      initializedSurveyId.current = survey.id;
    }
  }, [survey?.id]); // Only run when survey ID changes

  useEffect(() => {
    if (!isLoading && surveyId) {
      if (!survey && !hasCheckedSurvey.current) {
        hasCheckedSurvey.current = true;
        toast.error("Survey not found");
        navigate("/admin/surveys");
      } else if (survey) {
        hasCheckedSurvey.current = true;
      }
    }
  }, [isLoading, surveyId, survey?.id, navigate]);

  // ✅ Simple handlers - update UI immediately, save is debounced
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSaveTitle(newTitle);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    debouncedSaveDescription(newDescription);
  };

  const handleAddQuestion = async (type: QuestionType) => {
    if (!surveyId) return;

    const newQuestion: Question = {
      id: crypto.randomUUID(),
      type,
      title: "Untitled Question",
      required: false,
      options: HAS_OPTIONS.has(type)
        ? [
            { id: crypto.randomUUID(), text: "Option 1" },
            { id: crypto.randomUUID(), text: "Option 2" },
          ]
        : undefined,
    };

    await addQuestion(surveyId, newQuestion);
  };

  const handleAddRatingQuestion = async () => {
    if (!surveyId) return;

    const ratingQuestion: Question = {
      id: crypto.randomUUID(),
      type: "multiple_choice",
      title: "Overall teaching effectiveness",
      required: true,
      options: ["1", "2", "3", "4", "5"].map((t, i) => ({
        id: `opt-${i}`,
        text: t,
      })),
    };

    await addQuestion(surveyId, ratingQuestion);
    toast.success("Rating question added (1–5)");
  };

  const handleCopyLink = () => {
    if (!surveyId) return;
    const url = window.location.origin + "/survey/" + surveyId;
    navigator.clipboard.writeText(url);
    toast.success("Survey link copied!");
  };

  const handlePreview = () => {
    if (!surveyId) return;
    window.open("/survey/" + surveyId, "_blank");
  };

  if (isLoading && !hasCheckedSurvey.current) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!survey && hasCheckedSurvey.current) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="text-sm text-muted-foreground">Survey not found</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/surveys")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Surveys
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <LinkIcon className="mr-2 h-4 w-4" />
              Copy Link
            </Button>

            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddRatingQuestion}
            >
              <Star className="mr-2 h-4 w-4" />
              Add Rating (1–5)
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                {questionTypes.map((t) => (
                  <DropdownMenuItem
                    key={t.value}
                    onClick={() => handleAddQuestion(t.value)}
                    className="flex items-center gap-2"
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <main className="container py-8 space-y-8">
        <div className="card-elevated p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Survey title
            </label>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Description (optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Questions</h2>

          {survey?.questions?.length ? (
            <div className="space-y-4">
              {survey.questions.map((q: Question) => (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onUpdate={(updates) =>
                    updateQuestion(surveyId, q.id, updates)
                  }
                  onDelete={() => deleteQuestion(surveyId, q.id)}
                />
              ))}
            </div>
          ) : (
            <div className="card-elevated p-6 text-sm text-muted-foreground">
              No questions yet. Click "Add Question".
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
