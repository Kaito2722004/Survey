import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { teachersService, Teacher } from "@/services/teachers";
import { semesterTeachersService } from "@/services/semesterTeachers";

type Semester = { id: string; name: string };

export default function AdminSemesterTeachers() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState("");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");

  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Optional: allow adding teacher here too (your old page feature)
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const name = (t.name ?? "").toLowerCase();
      const email = (t.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [teachers, search]);

  const loadSemesters = async () => {
    const { data, error } = await supabase
      .from("semesters")
      .select("id,name")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setSemesters((data ?? []) as Semester[]);
  };

  const loadTeachers = async () => {
    const list = await teachersService.getAll();
    setTeachers(list);
  };

  const loadAssigned = async (semId: string) => {
    const ids = await semesterTeachersService.getAssignedTeacherIds(semId);
    setSelectedTeacherIds(new Set(ids));
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([loadSemesters(), loadTeachers()]);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!semesterId) {
      setSelectedTeacherIds(new Set());
      return;
    }
    const run = async () => {
      try {
        await loadAssigned(semesterId);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load assigned teachers");
      }
    };
    run();
  }, [semesterId]);

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      filteredTeachers.forEach((t) => next.add(t.id));
      return next;
    });
  };

  const clearFiltered = () => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      filteredTeachers.forEach((t) => next.delete(t.id));
      return next;
    });
  };

  const save = async () => {
    if (!semesterId) return toast.error("Please select a semester");
    setSaving(true);
    try {
      await semesterTeachersService.setTeachersForSemester(
        semesterId,
        Array.from(selectedTeacherIds)
      );
      toast.success("Teachers assigned to semester");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const createTeacher = async () => {
    if (!newTeacherName.trim()) return toast.error("Enter teacher name");
    try {
      await teachersService.create(newTeacherName.trim(), newTeacherEmail.trim() || null);
      toast.success("Teacher added");
      setNewTeacherName("");
      setNewTeacherEmail("");
      await loadTeachers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add teacher");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <h1 className="text-3xl font-semibold">Semester → Teachers</h1>

        {/* Semester selector */}
        <div className="card-elevated p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium mb-2">Select semester</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                disabled={loading}
              >
                <option value="">-- Select semester --</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <div className="text-sm font-medium mb-2">Search teacher</div>
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={selectAllFiltered}
              disabled={!semesterId || loading || filteredTeachers.length === 0}
            >
              Select all (filtered)
            </Button>
            <Button
              variant="outline"
              onClick={clearFiltered}
              disabled={!semesterId || loading || filteredTeachers.length === 0}
            >
              Clear (filtered)
            </Button>

            <div className="ml-auto text-sm text-muted-foreground flex items-center">
              Selected: <span className="ml-1 font-medium">{selectedTeacherIds.size}</span>
            </div>
          </div>

          {/* Teacher list */}
          <div className="border rounded-md">
            {(!semesterId && (
              <div className="p-4 text-sm text-muted-foreground">
                Select a semester to assign teachers.
              </div>
            ))}

            {semesterId && filteredTeachers.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No teachers found.</div>
            )}

            {semesterId && filteredTeachers.length > 0 && (
              <div className="max-h-[420px] overflow-auto divide-y">
                {filteredTeachers.map((t) => {
                  const checked = selectedTeacherIds.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeacher(t.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{t.name}</div>
                        {t.email ? (
                          <div className="text-sm text-muted-foreground">{t.email}</div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={!semesterId || saving || loading}>
              {saving ? "Saving..." : "Save Teachers for Semester"}
            </Button>
          </div>
        </div>

        {/* Optional: Add teacher section (keeps your old functionality) */}
        <div className="card-elevated p-6 space-y-4">
          <div className="text-lg font-semibold">Add Teacher</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="Teacher name"
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
            />
            <Input
              placeholder="Email (optional)"
              value={newTeacherEmail}
              onChange={(e) => setNewTeacherEmail(e.target.value)}
            />
          </div>
          <Button onClick={createTeacher}>Add Teacher</Button>
        </div>
      </main>
    </div>
  );
}
