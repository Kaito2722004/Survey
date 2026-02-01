import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Semester = { id: string; name: string };
type Profile = { user_id: string; name: string | null; email: string | null; is_admin: boolean };

export default function AdminStudentsSemester() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const [studentUserId, setStudentUserId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const students = useMemo(
    () =>
      profiles
        .filter(p => !p.is_admin) // admins not students
        .filter(p =>
          (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.email || "").toLowerCase().includes(search.toLowerCase())
        ),
    [profiles, search]
  );

  useEffect(() => {
    (async () => {
      const semRes = await supabase.from("semesters").select("id,name").order("created_at", { ascending: false });
      if (semRes.error) toast.error(semRes.error.message);
      setSemesters((semRes.data || []) as Semester[]);

      const profRes = await supabase.from("profiles").select("user_id,name,email,is_admin").order("name");
      if (profRes.error) toast.error(profRes.error.message);
      setProfiles((profRes.data || []) as Profile[]);
    })();
  }, []);

  const assign = async () => {
    if (!selectedSemesterId) return toast.error("Select a semester.");
    if (!studentUserId) return toast.error("Select a student.");

    setSaving(true);

    // Ensure student belongs to ONLY one semester:
    // delete previous mapping, then insert new one.
    const del = await supabase.from("semester_students").delete().eq("student_user_id", studentUserId);
    if (del.error) {
      setSaving(false);
      return toast.error(del.error.message);
    }

    const ins = await supabase.from("semester_students").insert({
      semester_id: selectedSemesterId,
      student_user_id: studentUserId,
    });

    setSaving(false);

    if (ins.error) return toast.error(ins.error.message);
    toast.success("Student assigned to semester");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Students → Semester</h1>
          <p className="mt-1 text-muted-foreground">Students can answer only surveys from their semester.</p>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="font-medium">Select semester</div>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
              >
                <option value="">-- Select semester --</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Search student</div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." />
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
                {students.map(s => (
                  <option key={s.user_id} value={s.user_id}>
                    {(s.name || s.email || s.user_id) + (s.email ? ` (${s.email})` : "")}
                  </option>
                ))}
              </select>
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
