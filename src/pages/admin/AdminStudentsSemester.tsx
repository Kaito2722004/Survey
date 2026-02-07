import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Semester = { id: string; name: string };
type Profile = {
  user_id: string;
  name: string | null;
  email: string | null;
  is_admin: boolean;
};

function isAbortError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return msg.includes("abort");
}

export default function AdminStudentsSemester() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const [studentUserId, setStudentUserId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const students = useMemo(() => {
    const q = search.toLowerCase();
    return profiles
      .filter((p) => !p.is_admin) // admins not students
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.email || "").toLowerCase().includes(q)
      );
  }, [profiles, search]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const semRes = await supabase
          .from("semesters")
          .select("id,name")
          .order("created_at", { ascending: false });

        if (semRes.error) throw semRes.error;

        const profRes = await supabase
          .from("profiles")
          .select("user_id,name,email,is_admin")
          .order("name");

        console.log("profiles fetched:", profRes.data, profRes.error);

        if (profRes.error) throw profRes.error;

        if (!alive) return;

        setSemesters((semRes.data || []) as Semester[]);
        setProfiles((profRes.data || []) as Profile[]);
      } catch (e: unknown) {
        // ✅ ignore aborted/cancelled requests
        if (isAbortError(e)) return;

        console.error("AdminStudentsSemester load error:", e);
        toast.error(String((e as any)?.message ?? e ?? "Failed to load data"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const assign = async () => {
    if (!selectedSemesterId) return toast.error("Select a semester.");
    if (!studentUserId) return toast.error("Select a student.");

    setSaving(true);
    try {
      // Ensure student belongs to ONLY one semester:
      // delete previous mapping, then insert new one.
      const del = await supabase
        .from("semester_students")
        .delete()
        .eq("student_user_id", studentUserId);

      if (del.error) throw del.error;

      const ins = await supabase.from("semester_students").insert({
        semester_id: selectedSemesterId,
        student_user_id: studentUserId,
      });

      if (ins.error) throw ins.error;

      toast.success("Student assigned to semester");
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      console.error("Assign semester error:", e);
      toast.error(String((e as any)?.message ?? e ?? "Failed to assign student"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Students → Semester
          </h1>
          <p className="mt-1 text-muted-foreground">
            Students can answer only surveys from their semester.
          </p>
        </div>

        <div className="card-elevated p-6 space-y-4">
          {loading && (
            <div className="text-sm text-muted-foreground">Loading data…</div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="font-medium">Select semester</div>
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
              <div className="font-medium">Search student</div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="font-medium">Pick student</div>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={studentUserId}
                onChange={(e) => setStudentUserId(e.target.value)}
              >
                <option value="">-- Select student --</option>
                {students.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {(s.name || s.email || s.user_id) +
                      (s.email ? ` (${s.email})` : "")}
                  </option>
                ))}
              </select>

              {students.length === 0 && !loading && (
                <div className="text-sm text-muted-foreground">
                  No students found. (If you expected students here, it’s almost
                  always RLS on <code>profiles</code>.)
                </div>
              )}
            </div>

            <div className="flex items-end">
              <Button onClick={assign} disabled={saving}>
                {saving ? "Assigning..." : "Assign Student to Semester"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}