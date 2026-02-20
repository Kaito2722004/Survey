// src/pages/admin/AdminAlumni.tsx
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, RefreshCw, UserCheck, UserMinus, Users } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type StudentRow = {
  id: string;
  student_id: string;
  student_number: string;
  name: string;
  email: string | null;
  section_id: string;
  is_alumni: boolean;
  alumni_group_id: string | null;
  created_at: string;
};

type AlumniGroup = {
  id: string;
  label: string;
  start_year: number;
  end_year: number;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminAlumni() {
  const [loading, setLoading] = useState(true);

  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [alumniGroups, setAlumniGroups] = useState<AlumniGroup[]>([]);

  // Promote
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [promoting, setPromoting] = useState(false);

  // Assign group
  const [alumniQuery, setAlumniQuery] = useState("");
  const [selectedAlumniId, setSelectedAlumniId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Create group
  const [newStartYear, setNewStartYear] = useState("");
  const [newEndYear, setNewEndYear] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const groupLabelById = useMemo(() => {
    const m = new Map<string, string>();
    alumniGroups.forEach((g) =>
      m.set(g.id, g.label || `Alumni ${g.start_year}-${g.end_year}`),
    );
    return m;
  }, [alumniGroups]);

  const nonAlumniStudents = useMemo(
    () => allStudents.filter((s) => !s.is_alumni),
    [allStudents],
  );

  const alumniStudents = useMemo(
    () => allStudents.filter((s) => s.is_alumni),
    [allStudents],
  );

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return nonAlumniStudents
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q) ||
          s.student_id.toLowerCase().includes(q) ||
          s.student_number.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [nonAlumniStudents, studentQuery]);

  const filteredAlumni = useMemo(() => {
    const q = alumniQuery.trim().toLowerCase();
    return alumniStudents
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [alumniStudents, alumniQuery]);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadGroups = async () => {
    const { data, error } = await supabase
      .from("alumni_groups")
      .select("id,label,start_year,end_year")
      .order("start_year", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAlumniGroups((data ?? []) as AlumniGroup[]);
  };

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select(
        "id,student_id,student_number,name,email,section_id,is_alumni,alumni_group_id,created_at",
      )
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
      setAllStudents([]);
      return;
    }
    setAllStudents((data ?? []) as StudentRow[]);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadGroups(), loadStudents()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line

  // Auto label
  useEffect(() => {
    const s = newStartYear.trim();
    const e = newEndYear.trim();
    if (!newLabel.trim() && s && e) setNewLabel(`Alumni ${s}-${e}`);
  }, [newStartYear, newEndYear]); // eslint-disable-line

  // ── Actions ────────────────────────────────────────────────────────────────
  const createAlumniGroup = async () => {
    const s = Number(newStartYear);
    const e = Number(newEndYear);
    if (!Number.isFinite(s) || !Number.isFinite(e))
      return toast.error("Start / End year must be numbers.");
    if (s > e) return toast.error("Start year must be ≤ End year.");
    if (!newLabel.trim()) return toast.error("Enter group label.");

    setCreatingGroup(true);
    try {
      const { data, error } = await supabase
        .from("alumni_groups")
        .insert({ label: newLabel.trim(), start_year: s, end_year: e })
        .select("id,label,start_year,end_year")
        .single();
      if (error) throw error;
      toast.success("Alumni group created");
      await loadGroups();
      if (data?.id) setSelectedGroupId(data.id);
      setNewStartYear("");
      setNewEndYear("");
      setNewLabel("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  // ✅ Promote: flip is_alumni = true on students row. No group required. No profiles touched.
  const promoteToAlumni = async () => {
    if (!selectedStudentId) return toast.error("Select a student first.");
    const student = allStudents.find((s) => s.id === selectedStudentId);
    if (!student) return toast.error("Student not found.");

    setPromoting(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ is_alumni: true })
        .eq("id", selectedStudentId);
      if (error) throw error;
      toast.success(`"${student.name}" promoted to alumni.`);
      setSelectedStudentId("");
      setStudentQuery("");
      await loadStudents();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to promote student");
    } finally {
      setPromoting(false);
    }
  };

  // ✅ Assign group: update alumni_group_id on students row
  const assignGroup = async () => {
    if (!selectedAlumniId) return toast.error("Select an alumni first.");
    if (!selectedGroupId) return toast.error("Select a group first.");

    setAssigning(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ alumni_group_id: selectedGroupId })
        .eq("id", selectedAlumniId);
      if (error) throw error;
      toast.success("Group assigned");
      await loadStudents();
      setSelectedAlumniId("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to assign group");
    } finally {
      setAssigning(false);
    }
  };

  // ✅ Demote: flip is_alumni back to false, clear group
  const demoteToStudent = async (a: StudentRow) => {
    const ok = window.confirm(`Move "${a.name}" back to Student?`);
    if (!ok) return;
    const { error } = await supabase
      .from("students")
      .update({ is_alumni: false, alumni_group_id: null })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(`"${a.name}" moved back to Student`);
    await loadStudents();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Admin · Alumni
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Manage Alumni</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Promote students to alumni via <code>students.is_alumni</code> —
              no auth account required.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={loadAll}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* ── 1. Alumni Groups ─────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Alumni Groups
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start year</label>
              <Input
                value={newStartYear}
                onChange={(e) => setNewStartYear(e.target.value)}
                placeholder="2024"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End year</label>
              <Input
                value={newEndYear}
                onChange={(e) => setNewEndYear(e.target.value)}
                placeholder="2025"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Alumni 2024-2025"
              />
            </div>
          </div>
          <Button onClick={createAlumniGroup} disabled={creatingGroup}>
            {creatingGroup ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              "Create Group"
            )}
          </Button>

          {alumniGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alumni groups yet.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Label</th>
                    <th className="text-left px-4 py-2 font-semibold">Years</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {alumniGroups.map((g) => (
                    <tr key={g.id}>
                      <td className="px-4 py-2 font-medium">
                        {g.label || `Alumni ${g.start_year}-${g.end_year}`}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {g.start_year}–{g.end_year}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 2. Promote Student → Alumni ──────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> Promote Student →
            Alumni
          </h2>
          <p className="text-xs text-muted-foreground">
            Sets <code>students.is_alumni = true</code>. No auth account or
            profile row needed.
          </p>
          <div className="space-y-2 max-w-md">
            <label className="text-sm font-medium">Search student</label>
            <Input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Name, email, student ID…"
            />
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">— Select student —</option>
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.student_number} · {s.email ?? "no email"}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {nonAlumniStudents.length} students · showing up to 40
            </p>
            <Button
              className="gap-2"
              onClick={promoteToAlumni}
              disabled={promoting || !selectedStudentId}
            >
              {promoting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Promoting…
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" /> Promote to Alumni
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── 3. Assign Alumni → Group ─────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Assign Alumni → Group
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search alumni</label>
              <Input
                value={alumniQuery}
                onChange={(e) => setAlumniQuery(e.target.value)}
                placeholder="Name or email…"
              />
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedAlumniId}
                onChange={(e) => setSelectedAlumniId(e.target.value)}
              >
                <option value="">— Select alumni —</option>
                {filteredAlumni.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.email ?? "no email"}
                  </option>
                ))}
              </select>
              {selectedAlumniId &&
                (() => {
                  const found = alumniStudents.find(
                    (a) => a.id === selectedAlumniId,
                  );
                  return found ? (
                    <p className="text-xs text-muted-foreground">
                      Current group:{" "}
                      <span className="font-medium text-foreground">
                        {found.alumni_group_id
                          ? (groupLabelById.get(found.alumni_group_id) ??
                            "Unknown")
                          : "Not assigned"}
                      </span>
                    </p>
                  ) : null;
                })()}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select group</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">— Select alumni group —</option>
                {alumniGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label || `Alumni ${g.start_year}-${g.end_year}`}
                  </option>
                ))}
              </select>
              <Button
                className="w-full gap-2"
                onClick={assignGroup}
                disabled={assigning || !selectedAlumniId || !selectedGroupId}
              >
                {assigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save Assignment"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── 4. Alumni List ───────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Alumni List
            <span className="text-sm font-normal text-muted-foreground">
              ({alumniStudents.length})
            </span>
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alumniStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alumni yet.</p>
          ) : (
            <div className="space-y-2">
              {alumniStudents.slice(0, 50).map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.email ?? "no email"} · {a.student_number}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Group:{" "}
                      <span
                        className={
                          a.alumni_group_id
                            ? "text-foreground font-medium"
                            : "italic"
                        }
                      >
                        {a.alumni_group_id
                          ? (groupLabelById.get(a.alumni_group_id) ??
                            "Unknown group")
                          : "Not assigned"}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs shrink-0"
                    onClick={() => demoteToStudent(a)}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Make Student
                  </Button>
                </div>
              ))}
              {alumniStudents.length > 50 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing first 50 of {alumniStudents.length} alumni.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
