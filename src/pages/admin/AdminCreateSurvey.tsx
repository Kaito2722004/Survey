import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { useSurvey } from "@/contexts/SurveyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Semester = { id: string; name: string };
type Teacher = { id: string; name: string; email: string | null };

export default function AdminCreateSurvey() {
  const navigate = useNavigate();
  const { createSurvey } = useSurvey();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Load semesters
  useEffect(() => {
    (async () => {
      const semRes = await supabase
        .from("semesters")
        .select("id,name")
        .order("created_at", { ascending: false });

      if (semRes.error) toast.error(semRes.error.message);
      setSemesters((semRes.data || []) as Semester[]);
    })();
  }, []);

  // When semester changes: load teachers that belong to that semester (from semester_teachers.teacher_id)
  useEffect(() => {
    if (!selectedSemesterId) {
      setTeachers([]);
      setSelectedTeacherId("");
      return;
    }

    (async () => {
      const st = await supabase
        .from("semester_teachers")
        .select("teacher_id")
        .eq("semester_id", selectedSemesterId);

      if (st.error) return toast.error(st.error.message);

      const ids = (st.data || [])
        .map((r: any) => r.teacher_id)
        .filter(Boolean) as string[];

      if (ids.length === 0) {
        setTeachers([]);
        setSelectedTeacherId("");
        return;
      }

      const tRes = await supabase
        .from("teachers")
        .select("id,name,email")
        .in("id", ids)
        .order("name");

      if (tRes.error) return toast.error(tRes.error.message);

      setTeachers((tRes.data || []) as Teacher[]);
      setSelectedTeacherId("");
    })();
  }, [selectedSemesterId]);

  const handleCreate = async () => {
    if (!selectedSemesterId) return toast.error("Select a semester.");
    if (!selectedTeacherId) return toast.error("Select a teacher.");
    if (!title.trim()) return toast.error("Enter survey title.");

    setCreating(true);
    try {
      // createSurvey(title, description, semesterId, teacherId)
      const survey = await createSurvey(
        title.trim(),
        description.trim(),
        selectedSemesterId,
        selectedTeacherId
      );

      if (!survey) throw new Error("Survey create returned null");

      toast.success("Survey created. Add questions now.");
      navigate(`/admin/surveys/${survey.id}/edit`);

    } catch (e) {
      console.error(e);
      toast.error("Failed to create survey");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Create Survey (Semester + Teacher)
          </h1>
          <p className="mt-1 text-muted-foreground">
            Choose semester, choose teacher, then build questions dynamically.
          </p>
        </div>

        <div className="card-elevated p-6 space-y-5">
          <div className="space-y-2">
            <div className="font-medium">Semester</div>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
            >
              <option value="">-- Select semester --</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="font-medium">Teacher</div>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={!selectedSemesterId}
            >
              <option value="">
                {selectedSemesterId ? "-- Select teacher --" : "Select semester first"}
              </option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.email ? `(${t.email})` : ""}
                </option>
              ))}
            </select>

            {selectedSemesterId && teachers.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No teachers assigned to this semester yet. Go to “Semester → Teachers”.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="font-medium">Survey title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Teacher Feedback - Midterm"
            />
          </div>

          <div className="space-y-2">
            <div className="font-medium">Description (optional)</div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create & Add Questions"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/semester-teachers")}>
              Manage Semester Teachers
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/students-semester")}>
              Manage Students Semester
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
