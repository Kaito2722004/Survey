import { useEffect, useMemo, useState } from "react";
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

type SurveyType = "teacher" | "general";

export default function AdminCreateSurvey() {
  const navigate = useNavigate();
  const { createSurvey } = useSurvey();

  // ✅ NEW
  const [surveyType, setSurveyType] = useState<SurveyType>("teacher");

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState(""); // used by teacher flow

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  // ✅ NEW: multi-semester targeting for General Survey (optional)
  const [limitToSemesters, setLimitToSemesters] = useState(false);
  const [generalSemesterIds, setGeneralSemesterIds] = useState<string[]>([]);

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

  // Teacher flow: load teachers by semester
  useEffect(() => {
    if (surveyType !== "teacher") return;

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
  }, [selectedSemesterId, surveyType]);

  // When switching modes, reset irrelevant states (keeps flows clean)
  useEffect(() => {
    if (surveyType === "general") {
      setSelectedSemesterId("");
      setSelectedTeacherId("");
      setTeachers([]);
    } else {
      setLimitToSemesters(false);
      setGeneralSemesterIds([]);
    }
  }, [surveyType]);

  const semesterNameById = useMemo(() => {
    const m = new Map<string, string>();
    semesters.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [semesters]);

  const toggleGeneralSemester = (id: string) => {
    setGeneralSemesterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) return toast.error("Enter survey title.");

    // ✅ Preserve existing validations for Semester + Teacher exactly
    if (surveyType === "teacher") {
      if (!selectedSemesterId) return toast.error("Select a semester.");
      if (!selectedTeacherId) return toast.error("Select a teacher.");
    }

    setCreating(true);
    try {
      // Teacher Survey (unchanged)
      if (surveyType === "teacher") {
        const survey = await createSurvey(
          title.trim(),
          description.trim(),
          selectedSemesterId,
          selectedTeacherId,
        );
        if (!survey) throw new Error("Survey create returned null");

        toast.success("Survey created. Add questions now.");
        navigate(`/admin/surveys/${survey.id}/edit`);
        return;
      }

      // ✅ General Survey:
      // - always store surveys.semester_id = null and surveys.teacher_id = null
      // - if limitToSemesters + selected semesters => insert into survey_semesters
      const survey = await createSurvey(
        title.trim(),
        description.trim(),
        null,
        null,
      );
      if (!survey) throw new Error("Survey create returned null");

      // Optional targeting: sem 1–5 (multi semesters)
      if (limitToSemesters && generalSemesterIds.length > 0) {
        // insert rows into survey_semesters
        const rows = generalSemesterIds.map((semester_id) => ({
          survey_id: survey.id,
          semester_id,
        }));

        const { error } = await supabase.from("survey_semesters").insert(rows);

        // If table doesn't exist, this will error — show a clear message
        if (error) {
          console.error(error);
          toast.error(
            "Targeting semesters failed. Create table 'survey_semesters' (SQL I sent) or disable semester targeting.",
          );
          // still let them proceed to add questions
        }
      }

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
            {surveyType === "teacher"
              ? "Create Survey (Semester + Teacher)"
              : "Create Survey (General Survey)"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {surveyType === "teacher"
              ? "Choose semester, choose teacher, then build questions dynamically."
              : "Create a school-wide survey, or target multiple semesters (optional)."}
          </p>
        </div>

        <div className="card-elevated p-6 space-y-5">
          {/* ✅ NEW: Survey type */}
          <div className="space-y-2">
            <div className="font-medium">Survey type</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer">
                <input
                  type="radio"
                  name="surveyType"
                  checked={surveyType === "teacher"}
                  onChange={() => setSurveyType("teacher")}
                />
                <div>
                  <div className="font-medium">Semester + Teacher</div>
                  <div className="text-xs text-muted-foreground">
                    Same flow as before
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer">
                <input
                  type="radio"
                  name="surveyType"
                  checked={surveyType === "general"}
                  onChange={() => setSurveyType("general")}
                />
                <div>
                  <div className="font-medium">General Survey</div>
                  <div className="text-xs text-muted-foreground">
                    School-wide (or target semesters)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Teacher Survey fields (unchanged flow) */}
          {surveyType === "teacher" && (
            <>
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
                    {selectedSemesterId
                      ? "-- Select teacher --"
                      : "Select semester first"}
                  </option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.email ? `(${t.email})` : ""}
                    </option>
                  ))}
                </select>

                {selectedSemesterId && teachers.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No teachers assigned to this semester yet. Go to “Semester →
                    Teachers”.
                  </div>
                )}
              </div>
            </>
          )}

          {/* General Survey fields */}
          {surveyType === "general" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={limitToSemesters}
                  onChange={(e) => {
                    setLimitToSemesters(e.target.checked);
                    if (!e.target.checked) setGeneralSemesterIds([]);
                  }}
                />
                <span className="text-sm">
                  Limit this general survey to selected semesters (optional)
                </span>
              </label>

              {limitToSemesters && (
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="text-sm font-medium">Select semesters</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {semesters.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={generalSemesterIds.includes(s.id)}
                          onChange={() => toggleGeneralSemester(s.id)}
                        />
                        <span className="text-sm">{s.name}</span>
                      </label>
                    ))}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    If you select none, it will behave as school-wide.
                  </div>

                  {generalSemesterIds.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Targeting:{" "}
                      {generalSemesterIds
                        .map((id) => semesterNameById.get(id) || id)
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="font-medium">Survey title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Campus Facilities Feedback"
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
            <Button
              variant="outline"
              onClick={() => navigate("/admin/semester-teachers")}
            >
              Manage Semester Teachers
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/students-semester")}
            >
              Manage Students Semester
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
