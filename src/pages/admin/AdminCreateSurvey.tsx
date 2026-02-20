// src/pages/admin/AdminCreateSurvey.tsx
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { useSurvey } from "@/contexts/SurveyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Globe,
  Building2,
  GraduationCap,
  ChevronRight,
  ArrowLeft,
  CalendarClock,
  AlignLeft,
  Type,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = {
  id: string;
  sem: number;
  year_level: number;
  program: string;
  specialization: string;
};
type Teacher = { id: string; name: string };
type TargetGroup = { id: string; name: string; description: string | null };
type AlumniGroup = {
  id: string;
  label: string;
  start_year: number;
  end_year: number;
};
type SurveyType = "teacher" | "general" | "alumni" | "organization";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionLabel(s: Section) {
  return `Y${s.year_level} ${s.specialization} — Sem ${s.sem} (${s.program})`;
}

// ─── Survey type config ───────────────────────────────────────────────────────

const SURVEY_TYPES: {
  id: SurveyType;
  label: string;
  sub: string;
  icon: React.ElementType;
}[] = [
  {
    id: "teacher",
    label: "Section + Teacher",
    sub: "Target a specific teacher in a section",
    icon: Users,
  },
  {
    id: "general",
    label: "General Survey",
    sub: "School-wide or target specific sections",
    icon: Globe,
  },
  {
    id: "organization",
    label: "Organization",
    sub: "Assign to specific target groups",
    icon: Building2,
  },
  {
    id: "alumni",
    label: "Alumni Survey",
    sub: "Target an alumni year group",
    icon: GraduationCap,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCreateSurvey() {
  const navigate = useNavigate();
  const { createSurvey } = useSurvey();

  const [surveyType, setSurveyType] = useState<SurveyType>("teacher");

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [limitToSections, setLimitToSections] = useState(false);
  const [generalSectionIds, setGeneralSectionIds] = useState<string[]>([]);

  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [selectedTargetGroupIds, setSelectedTargetGroupIds] = useState<
    string[]
  >([]);

  const [alumniGroups, setAlumniGroups] = useState<AlumniGroup[]>([]);
  const [selectedAlumniGroupId, setSelectedAlumniGroupId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);

  // Load sections
  useEffect(() => {
    (async () => {
      const res = await supabase
        .from("sections")
        .select("id,sem,year_level,program,specialization")
        .order("year_level", { ascending: true });
      if (res.error) toast.error(res.error.message);
      setSections((res.data || []) as Section[]);
    })();
  }, []);

  // Load teachers by section
  useEffect(() => {
    if (surveyType !== "teacher") return;
    if (!selectedSectionId) {
      setTeachers([]);
      setSelectedTeacherId("");
      return;
    }
    (async () => {
      const res = await supabase
        .from("teachers")
        .select("id,name")
        .eq("section_id", selectedSectionId)
        .order("name");
      if (res.error) return toast.error(res.error.message);
      setTeachers((res.data || []) as Teacher[]);
      setSelectedTeacherId("");
    })();
  }, [selectedSectionId, surveyType]);

  // Load target groups
  useEffect(() => {
    if (surveyType !== "organization") return;
    (async () => {
      const res = await supabase
        .from("target_groups")
        .select("id,name,description")
        .order("created_at", { ascending: false });
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      setTargetGroups((res.data || []) as TargetGroup[]);
    })();
  }, [surveyType]);

  // Load alumni groups
  useEffect(() => {
    if (surveyType !== "alumni") return;
    (async () => {
      const res = await supabase
        .from("alumni_groups")
        .select("id,label,start_year,end_year")
        .order("start_year", { ascending: false });
      if (res.error) {
        toast.error(res.error.message);
        return;
      }
      setAlumniGroups((res.data || []) as AlumniGroup[]);
    })();
  }, [surveyType]);

  // Reset on type change
  useEffect(() => {
    setSelectedSectionId("");
    setSelectedTeacherId("");
    setTeachers([]);
    setLimitToSections(false);
    setGeneralSectionIds([]);
    setSelectedTargetGroupIds([]);
    setSelectedAlumniGroupId("");
  }, [surveyType]);

  const sectionLabelById = useMemo(() => {
    const m = new Map<string, string>();
    sections.forEach((s) => m.set(s.id, sectionLabel(s)));
    return m;
  }, [sections]);

  const toggleGeneralSection = (id: string) =>
    setGeneralSectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleTargetGroup = (id: string) =>
    setSelectedTargetGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleCreate = async () => {
    if (!title.trim()) return toast.error("Enter survey title.");
    if (surveyType === "teacher") {
      if (!selectedSectionId) return toast.error("Select a section.");
      if (!selectedTeacherId) return toast.error("Select a teacher.");
    }
    if (surveyType === "organization" && selectedTargetGroupIds.length === 0)
      return toast.error("Select at least 1 target group.");
    if (surveyType === "alumni" && !selectedAlumniGroupId)
      return toast.error("Select an alumni year group.");

    setCreating(true);
    try {
      const deadlineIso = deadline.trim()
        ? new Date(deadline.trim()).toISOString()
        : null;

      // Teacher survey
      if (surveyType === "teacher") {
        const survey = await createSurvey(
          title.trim(),
          description.trim(),
          selectedSectionId,
          selectedTeacherId,
          deadlineIso,
        );
        if (!survey) throw new Error("Survey create returned null");
        toast.success("Survey created. Add questions now.");
        navigate(`/admin/surveys/${survey.id}/edit`);
        return;
      }

      // Alumni survey
      if (surveyType === "alumni") {
        const survey = await createSurvey(
          title.trim(),
          description.trim(),
          null,
          null,
          deadlineIso,
        );
        if (!survey) throw new Error("Survey create returned null");
        const { error: upErr } = await supabase
          .from("surveys")
          .update({
            survey_type: "alumni",
            audience: "alumni",
            target_role: "alumni",
          })
          .eq("id", survey.id);
        if (upErr) throw upErr;
        const { error: linkErr } = await supabase
          .from("survey_alumni_groups")
          .insert({
            survey_id: survey.id,
            alumni_group_id: selectedAlumniGroupId,
          });
        if (linkErr) throw linkErr;
        toast.success("Alumni survey created. Add questions now.");
        navigate(`/admin/surveys/${survey.id}/edit`);
        return;
      }

      // Organization survey
      if (surveyType === "organization") {
        const survey = await createSurvey(
          title.trim(),
          description.trim(),
          null,
          null,
          deadlineIso,
        );
        if (!survey) throw new Error("Survey create returned null");
        const { error: upErr } = await supabase
          .from("surveys")
          .update({ target_role: "organization", audience: "target_group" })
          .eq("id", survey.id);
        if (upErr) throw upErr;
        const rows = selectedTargetGroupIds.map((target_group_id) => ({
          survey_id: survey.id,
          target_group_id,
        }));
        const { error: linkErr } = await supabase
          .from("survey_target_groups")
          .insert(rows);
        if (linkErr)
          toast.error("Survey created, but linking target groups failed.");
        toast.success("Organization survey created. Add questions now.");
        navigate(`/admin/surveys/${survey.id}/edit`);
        return;
      }

      // General survey
      const survey = await createSurvey(
        title.trim(),
        description.trim(),
        null,
        null,
        deadlineIso,
      );
      if (!survey) throw new Error("Survey create returned null");
      if (limitToSections && generalSectionIds.length > 0) {
        const rows = generalSectionIds.map((section_id) => ({
          survey_id: survey.id,
          section_id,
        }));
        const { error } = await supabase.from("survey_sections").insert(rows);
        if (error) toast.error("Targeting sections failed.");
      }
      toast.success("Survey created. Add questions now.");
      navigate(`/admin/surveys/${survey.id}/edit`);
    } catch (e) {
      console.error(e);
      toast.error(String((e as any)?.message ?? "Failed to create survey"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-10 max-w-2xl space-y-8">
        {/* ── Page header ── */}
        <div>
          <button
            onClick={() => navigate("/admin/surveys")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Surveys
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Admin · Surveys
          </p>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Create Survey
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a type, fill in the details, then build your questions.
          </p>
        </div>

        {/* ── Step 1: Survey type ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              1
            </span>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Survey Type
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SURVEY_TYPES.map(({ id, label, sub, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSurveyType(id)}
                className={[
                  "relative text-left rounded-xl border px-4 py-3 transition-all duration-150",
                  surveyType === id
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30",
                ].join(" ")}
              >
                {surveyType === id && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={[
                      "h-4 w-4",
                      surveyType === id
                        ? "text-primary"
                        : "text-muted-foreground",
                    ].join(" ")}
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {sub}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Step 2: Targeting ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              2
            </span>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Targeting
            </h2>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            {/* Teacher */}
            {surveyType === "teacher" && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Section
                  </label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    <option value="">Select section…</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {sectionLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Teacher
                  </label>
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    disabled={!selectedSectionId}
                  >
                    <option value="">
                      {selectedSectionId
                        ? "Select teacher…"
                        : "Select section first"}
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {selectedSectionId && teachers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No teachers assigned to this section yet.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* General */}
            {surveyType === "general" && (
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={limitToSections}
                    onChange={(e) => {
                      setLimitToSections(e.target.checked);
                      if (!e.target.checked) setGeneralSectionIds([]);
                    }}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">
                    Limit to specific sections{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </span>
                </label>

                {limitToSections && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sections.map((s) => (
                        <label
                          key={s.id}
                          className={[
                            "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-sm",
                            generalSectionIds.includes(s.id)
                              ? "border-primary/50 bg-primary/5 text-foreground"
                              : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/20",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={generalSectionIds.includes(s.id)}
                            onChange={() => toggleGeneralSection(s.id)}
                            className="w-4 h-4"
                          />
                          {sectionLabel(s)}
                        </label>
                      ))}
                    </div>
                    {generalSectionIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Targeting:{" "}
                        {generalSectionIds
                          .map((id) => sectionLabelById.get(id) ?? id)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {!limitToSections && (
                  <p className="text-xs text-muted-foreground">
                    Survey will be visible school-wide.
                  </p>
                )}
              </div>
            )}

            {/* Organization */}
            {surveyType === "organization" && (
              <div className="space-y-3">
                {targetGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No target groups yet. Create them in the Target Groups admin
                    page first.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {targetGroups.map((tg) => (
                        <label
                          key={tg.id}
                          className={[
                            "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                            selectedTargetGroupIds.includes(tg.id)
                              ? "border-primary/50 bg-primary/5"
                              : "border-border hover:border-border/80 hover:bg-muted/20",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTargetGroupIds.includes(tg.id)}
                            onChange={() => toggleTargetGroup(tg.id)}
                            className="w-4 h-4 mt-0.5"
                          />
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {tg.name}
                            </div>
                            {tg.description && (
                              <div className="text-xs text-muted-foreground">
                                {tg.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    {selectedTargetGroupIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedTargetGroupIds.length} group
                        {selectedTargetGroupIds.length !== 1 ? "s" : ""}{" "}
                        selected
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Alumni */}
            {surveyType === "alumni" && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Alumni Year Group
                </label>
                {alumniGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No alumni groups yet. Create them in the Alumni Groups admin
                    page first.
                  </p>
                ) : (
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={selectedAlumniGroupId}
                    onChange={(e) => setSelectedAlumniGroupId(e.target.value)}
                  >
                    <option value="">Select alumni group…</option>
                    {alumniGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label || `Alumni ${g.start_year}–${g.end_year}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Step 3: Details ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              3
            </span>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Survey Details
            </h2>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Type className="h-3 w-3" /> Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Campus Facilities Feedback"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <AlignLeft className="h-3 w-3" /> Description{" "}
                <span className="normal-case font-normal text-muted-foreground/70">
                  (optional)
                </span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description shown to respondents…"
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <CalendarClock className="h-3 w-3" /> Deadline{" "}
                <span className="normal-case font-normal text-muted-foreground/70">
                  (optional)
                </span>
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="text-sm w-auto"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no deadline.
              </p>
            </div>
          </div>
        </section>

        {/* ── Actions ── */}
        <div className="flex flex-wrap items-center gap-3 pt-2 pb-10">
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? "Creating…" : "Create & Add Questions"}
            {!creating && <ChevronRight className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/section-teachers")}
          >
            Manage Section Teachers
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/students-section")}
          >
            Manage Student Sections
          </Button>
        </div>
      </main>
    </div>
  );
}
