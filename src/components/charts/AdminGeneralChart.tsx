// src/pages/admin/AdminGeneralChart.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft } from "lucide-react";
import { GeneralSurveyChart } from "@/components/charts/chartsx";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ✅ IMPORTANT: point this to where you placed chartsx.tsx
// If chartsx.tsx is actually in src/components/charts/SurveyChart.tsx then change import to:
// import { SurveyChart } from "@/components/charts/SurveyChart";


type DbQuestion = {
  id: string;
  title: string;
  type: string;
  options: any | null;
  order_index: number | null;
};

type DbSurveyResponse = {
  id: string;
  survey_id: string;
  answers: Record<string, unknown> | null;
  submitted_at: string;
};

type ChartRow = {
  question: string;
  option1: number;
  option2: number;
  option3: number;
  option4: number;
  option5: number;
};

function isAbortError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return msg.includes("abort");
}

// General surveys: only questions with selectable options
function isOptionQuestion(q: DbQuestion) {
  return q.type === "multiple_choice" || q.type === "dropdown" || q.type === "checkboxes";
}

// options can be: ["A","B"] OR { options: ["A","B"] }
function getOptions(q: DbQuestion): string[] {
  const o = q.options;
  if (!o) return [];

  if (Array.isArray(o)) return o.map(String);

  if (typeof o === "object" && Array.isArray((o as any).options)) {
    return (o as any).options.map(String);
  }

  return [];
}

function countOptionsForQuestion(q: DbQuestion, responses: DbSurveyResponse[], maxOptions = 5) {
  const opts = getOptions(q).slice(0, maxOptions);
  const indexByLabel = new Map<string, number>();
  opts.forEach((label, i) => indexByLabel.set(String(label), i));

  const counts = new Array(opts.length).fill(0);

  for (const r of responses) {
    const answers = r.answers ?? {};
    const raw = answers[q.id]; // ✅ binding by question.id

    // checkboxes -> array
    if (Array.isArray(raw)) {
      for (const v of raw) {
        const idx = indexByLabel.get(String(v));
        if (idx !== undefined) counts[idx] += 1;
      }
      continue;
    }

    // dropdown / multiple choice -> string or number
    if (typeof raw === "string" || typeof raw === "number") {
      const idx = indexByLabel.get(String(raw));
      if (idx !== undefined) counts[idx] += 1;
    }
  }

  // chartsx.tsx expects option1..option5 always
  while (counts.length < 5) counts.push(0);
  return counts.slice(0, 5);
}

export default function AdminGeneralChart() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [responses, setResponses] = useState<DbSurveyResponse[]>([]);

  // UI
  const [mode, setMode] = useState<"all" | "single">("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!surveyId) {
        setLoading(false);
        toast.error("Missing surveyId in URL.");
        return;
      }

      setLoading(true);
      try {
        const qRes = await supabase
          .from("questions")
          .select("id,title,type,options,order_index")
          .eq("survey_id", surveyId)
          .order("order_index", { ascending: true });

        if (qRes.error) throw qRes.error;

        const rRes = await supabase
          .from("survey_responses")
          .select("id,survey_id,answers,submitted_at")
          .eq("survey_id", surveyId);

        if (rRes.error) throw rRes.error;

        if (!alive) return;

        const qs = (qRes.data ?? []) as DbQuestion[];
        const rs = (rRes.data ?? []) as DbSurveyResponse[];

        setQuestions(qs);
        setResponses(rs);

        const firstOptionQ = qs.find(isOptionQuestion);
        setSelectedQuestionId(firstOptionQ?.id ?? "");
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        console.error(e);
        toast.error(String((e as any)?.message ?? e ?? "Failed to load general chart"));
        if (alive) {
          setQuestions([]);
          setResponses([]);
          setSelectedQuestionId("");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [surveyId]);

  const optionQuestions = useMemo(() => {
    const qs = questions.filter(isOptionQuestion);
    const s = search.trim().toLowerCase();
    if (!s) return qs;
    return qs.filter((q) => q.title.toLowerCase().includes(s));
  }, [questions, search]);

  // keep selection valid when filtering
  useEffect(() => {
    if (!optionQuestions.length) {
      setSelectedQuestionId("");
      return;
    }
    if (!selectedQuestionId) {
      setSelectedQuestionId(optionQuestions[0].id);
      return;
    }
    const exists = optionQuestions.some((q) => q.id === selectedQuestionId);
    if (!exists) setSelectedQuestionId(optionQuestions[0].id);
  }, [optionQuestions, selectedQuestionId]);

  const chartDataAll = useMemo((): ChartRow[] => {
    return optionQuestions.map((q) => {
      const counts = countOptionsForQuestion(q, responses, 5);
      return {
        question: q.title,
        option1: counts[0],
        option2: counts[1],
        option3: counts[2],
        option4: counts[3],
        option5: counts[4],
      };
    });
  }, [optionQuestions, responses]);

  const chartDataSingle = useMemo((): ChartRow[] => {
    if (!selectedQuestionId) return [];
    const q = optionQuestions.find((x) => x.id === selectedQuestionId);
    if (!q) return [];
    const counts = countOptionsForQuestion(q, responses, 5);
    return [
      {
        question: q.title,
        option1: counts[0],
        option2: counts[1],
        option3: counts[2],
        option4: counts[3],
        option5: counts[4],
      },
    ];
  }, [selectedQuestionId, optionQuestions, responses]);

  const finalData = mode === "all" ? chartDataAll : chartDataSingle;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
 

      
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">General Survey Charts</h1>
          <p className="mt-1 text-muted-foreground">
            Counts how many students chose each option using{" "}
            <code>answers[question.id]</code>.
          </p>
        </div>

        <div className="card-elevated p-5 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Chart Mode</div>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All option questions</SelectItem>
                  <SelectItem value="single">Single question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Search questions</div>
              <Input
                className="w-[320px] max-w-full"
                placeholder="Search by question title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {mode === "single" && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Select Question</div>
                <Select
                  value={selectedQuestionId}
                  onValueChange={setSelectedQuestionId}
                  disabled={optionQuestions.length === 0}
                >
                  <SelectTrigger className="w-[520px] max-w-full">
                    <SelectValue
                      placeholder={
                        optionQuestions.length === 0
                          ? "No option questions found"
                          : "Choose a question..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {optionQuestions.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {optionQuestions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No option questions found. General charts require question types:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>
                  <code>multiple_choice</code>, <code>dropdown</code>,{" "}
                  <code>checkboxes</code>
                </li>
                <li>
                  and <code>questions.options</code> must be a JSON array (recommended)
                </li>
              </ul>
            </div>
          ) : finalData.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No chart data yet (no responses or selected question not found).
            </div>
          ) : (
  <GeneralSurveyChart
    questions={optionQuestions.map((q) => ({
      id: q.id,
      title: q.title,
      type: q.type,
      options: q.options,
    }))}
    responses={responses.map((r) => ({
      id: r.id,
      answers: r.answers,
    }))}
    maxOptions={5}
  />
)}
        </div>
      </main>
    </div>
  );
}