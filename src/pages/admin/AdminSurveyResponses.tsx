import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSurvey } from '@/contexts/SurveyContext';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  FileText,
  BarChart3,
  Table as TableIcon,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = [
  'hsl(243, 75%, 59%)',
  'hsl(12, 76%, 61%)',
  'hsl(142, 76%, 36%)',
  'hsl(48, 96%, 53%)',
  'hsl(280, 75%, 55%)',
];

interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, string | string[]>;
  submittedAt: Date;
}

const SurveyResponses = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSurvey, getResponses, isLoading } = useSurvey();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);

  const survey = getSurvey(id!);

 useEffect(() => {
  let cancelled = false;

  const fetchResponses = async () => {
    if (!id) return;

    setIsLoadingResponses(true);

    try {
      const data = await getResponses(id);
      if (!cancelled) setResponses(data);
    } catch (e: any) {
      // ✅ Ignore abort errors
      const msg = String(e?.message || e || "").toLowerCase();
      if (msg.includes("aborted") || msg.includes("aborterror")) return;

      console.error("getResponses failed:", e);
      toast.error(e?.message ?? "Failed to load responses");
      if (!cancelled) setResponses([]);
    } finally {
      if (!cancelled) setIsLoadingResponses(false);
    }
  };

  fetchResponses();

  return () => {
    cancelled = true;
  };
}, [id, getResponses]);


  if (isLoading || isLoadingResponses) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!survey) {
    navigate('/dashboard');
    return null;
  }

  const getAnswerText = (questionId: string, answer: string | string[]): string => {
    const question = survey.questions.find((q) => q.id === questionId);
    if (!question) return '';

    if (question.options && (question.type === 'multiple_choice' || question.type === 'dropdown')) {
      const option = question.options.find((o) => o.id === answer);
      return option?.text || String(answer);
    }

    if (question.options && question.type === 'checkbox' && Array.isArray(answer)) {
      return answer
        .map((a) => question.options?.find((o) => o.id === a)?.text || a)
        .filter(Boolean)
        .join(', ');
    }

    return typeof answer === 'string' ? answer : answer.join(', ');
  };

  const getChartData = (questionId: string) => {
    const question = survey.questions.find((q) => q.id === questionId);
    if (!question || !question.options) return [];

    const counts: Record<string, number> = {};
    question.options.forEach((opt) => {
      counts[opt.id] = 0;
    });

    responses.forEach((response) => {
      const answer = response.answers[questionId];
      if (Array.isArray(answer)) {
        answer.forEach((a) => {
          if (counts[a] !== undefined) counts[a]++;
        });
      } else if (answer && counts[answer] !== undefined) {
        counts[answer]++;
      }
    });

    return question.options.map((opt) => ({
      name: opt.text,
      value: counts[opt.id],
    }));
  };

  const handleExport = (format: 'csv' | 'json') => {
    const exportData = responses.map((response) => {
      const row: Record<string, string> = {
        submittedAt: response.submittedAt.toISOString(),
      };
      survey.questions.forEach((q) => {
        row[q.title] = getAnswerText(q.id, response.answers[q.id] || '');
      });
      return row;
    });

    let content: string;
    let filename: string;
    let type: string;

    if (format === 'csv') {
      const headers = ['Submitted At', ...survey.questions.map((q) => q.title)];
      const rows = exportData.map((row) => [
        row.submittedAt,
        ...survey.questions.map((q) => `"${row[q.title] || ''}"`),
      ]);
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      filename = `${survey.title}-responses.csv`;
      type = 'text/csv';
    } else {
      content = JSON.stringify(exportData, null, 2);
      filename = `${survey.title}-responses.json`;
      type = 'application/json';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const choiceQuestions = survey.questions.filter((q) =>
    ['multiple_choice', 'checkbox', 'dropdown'].includes(q.type)
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="sticky top-16 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/survey/${id}/edit`)}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Edit Survey
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="mr-1 h-4 w-4" />
              JSON
            </Button>
          </div>
        </div>
      </div>

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">{survey.title}</h1>
          <p className="mt-2 text-muted-foreground">
            {responses.length} response{responses.length !== 1 ? 's' : ''}
          </p>
        </div>

        {responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-foreground">No responses yet</h3>
            <p className="mb-4 text-center text-muted-foreground">
              Share your survey to start collecting responses
            </p>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/survey/${id}`);
                toast.success('Link copied!');
              }}
            >
              Copy Survey Link
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="table" className="gap-2">
                <TableIcon className="h-4 w-4" />
                Table
              </TabsTrigger>
              <TabsTrigger value="charts" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Charts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <div className="card-elevated overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-40">Submitted</TableHead>
                        {survey.questions.map((q) => (
                          <TableHead key={q.id}>{q.title}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((response) => (
                        <TableRow key={response.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(response.submittedAt)}
                          </TableCell>
                          {survey.questions.map((q) => (
                            <TableCell key={q.id}>
                              {getAnswerText(q.id, response.answers[q.id] || '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="charts">
              {choiceQuestions.length === 0 ? (
                <div className="card-elevated p-8 text-center">
                  <p className="text-muted-foreground">
                    Add multiple choice, checkbox, or dropdown questions to see charts.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {choiceQuestions.map((question) => (
                    <div key={question.id} className="card-elevated p-6">
                      <h3 className="mb-4 font-medium text-foreground">{question.title}</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          {question.type === 'checkbox' ? (
                            <BarChart data={getChartData(question.id)} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                              <YAxis
                                dataKey="name"
                                type="category"
                                width={100}
                                stroke="hsl(var(--muted-foreground))"
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                              />
                              <Bar dataKey="value" fill="hsl(243, 75%, 59%)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          ) : (
                            <PieChart>
                              <Pie
                                data={getChartData(question.id)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) =>
                                  percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                                }
                              >
                                {getChartData(question.id).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                              />
                              <Legend />
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default SurveyResponses;
