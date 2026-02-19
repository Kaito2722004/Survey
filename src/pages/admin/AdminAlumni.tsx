import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
  role: string | null;
  is_admin: boolean;
  created_at: string;
};

type AlumniGroup = {
  id: string;
  label: string;
  start_year: number;
  end_year: number;
};

export default function AdminAlumni() {
  const [loading, setLoading] = useState(true);

  // Data
  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [alumni, setAlumni] = useState<ProfileRow[]>([]);
  const [alumniGroups, setAlumniGroups] = useState<AlumniGroup[]>([]);
  const [membership, setMembership] = useState<Map<string, string>>(new Map()); // user_id -> alumni_group_id

  // -------- Promote (Student -> Alumni) ----------
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentUserId, setSelectedStudentUserId] = useState("");

  // -------- Assign (Alumni -> Group) -------------
  const [alumniQuery, setAlumniQuery] = useState("");
  const [selectedAlumniUserId, setSelectedAlumniUserId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // -------- Create group -------------
  const [newStartYear, setNewStartYear] = useState("");
  const [newEndYear, setNewEndYear] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const groupLabelById = useMemo(() => {
    const m = new Map<string, string>();
    alumniGroups.forEach((g) => m.set(g.id, g.label || `Alumni ${g.start_year}-${g.end_year}`));
    return m;
  }, [alumniGroups]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students
      .filter((s) => {
        const name = (s.name ?? "").toLowerCase();
        const email = (s.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 30);
  }, [students, studentQuery]);

  const filteredAlumni = useMemo(() => {
    const q = alumniQuery.trim().toLowerCase();
    if (!q) return alumni.slice(0, 30);
    return alumni
      .filter((a) => {
        const name = (a.name ?? "").toLowerCase();
        const email = (a.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 30);
  }, [alumni, alumniQuery]);

  const loadGroups = async () => {
    const agRes = await supabase
      .from("alumni_groups")
      .select("id,label,start_year,end_year")
      .order("start_year", { ascending: false });

    if (agRes.error) {
      toast.error(agRes.error.message);
      setAlumniGroups([]);
      return;
    }
    setAlumniGroups((agRes.data ?? []) as AlumniGroup[]);
  };

  const loadStudents = async () => {
    const sRes = await supabase
      .from("profiles")
      .select("id,user_id,name,email,role,is_admin,created_at")
      .eq("is_admin", false)
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (sRes.error) {
      toast.error(sRes.error.message);
      setStudents([]);
      return;
    }
    setStudents((sRes.data ?? []) as ProfileRow[]);
  };

  const loadAlumniAndMembership = async () => {
    const aRes = await supabase
      .from("profiles")
      .select("id,user_id,name,email,role,is_admin,created_at")
      .eq("is_admin", false)
      .eq("role", "alumni")
      .order("created_at", { ascending: false });

    if (aRes.error) {
      toast.error(aRes.error.message);
      setAlumni([]);
      setMembership(new Map());
      return;
    }

    const alumniRows = (aRes.data ?? []) as ProfileRow[];
    setAlumni(alumniRows);

    // memberships
    const ids = alumniRows.map((x) => x.user_id);
    const m = new Map<string, string>();

    if (ids.length > 0) {
      const mRes = await supabase
        .from("alumni_group_members")
        .select("user_id,alumni_group_id")
        .in("user_id", ids);

      if (mRes.error) {
        toast.error(mRes.error.message);
      } else {
        (mRes.data ?? []).forEach((r: any) => {
          if (r?.user_id && r?.alumni_group_id) m.set(r.user_id, r.alumni_group_id);
        });
      }
    }

    setMembership(m);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadGroups(), loadStudents(), loadAlumniAndMembership()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto label
  useEffect(() => {
    const s = newStartYear.trim();
    const e = newEndYear.trim();
    if (!newLabel.trim() && s && e) setNewLabel(`Alumni ${s}-${e}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newStartYear, newEndYear]);

  const createAlumniGroup = async () => {
    const s = Number(newStartYear);
    const e = Number(newEndYear);

    if (!Number.isFinite(s) || !Number.isFinite(e)) return toast.error("Start year / End year must be numbers.");
    if (s > e) return toast.error("Start year must be <= End year.");
    if (!newLabel.trim()) return toast.error("Enter group label.");

    setCreatingGroup(true);
    try {
      const { data, error } = await supabase
        .from("alumni_groups")
        .insert({ label: newLabel.trim(), start_year: s, end_year: e })
        .select("id,label,start_year,end_year")
        .single();

      if (error) throw error;

      toast.success("Created alumni group");
      await loadGroups();

      // select newly created group automatically
      if (data?.id) setSelectedGroupId(data.id);

      setNewStartYear("");
      setNewEndYear("");
      setNewLabel("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  // ✅ Promote ONLY: student -> alumni (no group assignment)
  const promoteStudentOnly = async () => {
    if (!selectedStudentUserId) return toast.error("Select a student first.");

    const { error } = await supabase
      .from("profiles")
      .update({ role: "alumni" })
      .eq("user_id", selectedStudentUserId);

    if (error) {
      console.error(error);
      toast.error(error.message);
      return;
    }

    toast.success("Promoted to Alumni");
    setSelectedStudentUserId("");
    setStudentQuery("");
    await Promise.all([loadStudents(), loadAlumniAndMembership()]);
  };

  // ✅ Assign group ONLY (for existing alumni)
  const assignGroupToAlumni = async () => {
    if (!selectedAlumniUserId) return toast.error("Select an alumni user first.");
    if (!selectedGroupId) return toast.error("Select an alumni group first.");

    const { error } = await supabase
      .from("alumni_group_members")
      .upsert({ user_id: selectedAlumniUserId, alumni_group_id: selectedGroupId }, { onConflict: "user_id" });

    if (error) {
      console.error(error);
      toast.error(error.message);
      return;
    }

    toast.success("Assigned group");
    await loadAlumniAndMembership();
  };

  const makeStudent = async (user_id: string) => {
    const { error } = await supabase.from("profiles").update({ role: "student" }).eq("user_id", user_id);
    if (error) return toast.error(error.message);

    // cleanup membership
    const { error: delErr } = await supabase.from("alumni_group_members").delete().eq("user_id", user_id);
    if (delErr) toast.error("Role updated, but failed to remove alumni membership.");

    toast.success("Moved back to Student");
    await Promise.all([loadStudents(), loadAlumniAndMembership()]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Manage Alumni</h1>
          <p className="mt-1 text-muted-foreground">
            Promote students to alumni (role only), then assign alumni to year groups separately.
          </p>
        </div>

        {/* 1) Alumni Groups: create + show */}
        <div className="card-elevated p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">Alumni Groups</h2>
            <Button variant="outline" onClick={loadAll}>
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">Start year</div>
              <Input value={newStartYear} onChange={(e) => setNewStartYear(e.target.value)} placeholder="2024" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">End year</div>
              <Input value={newEndYear} onChange={(e) => setNewEndYear(e.target.value)} placeholder="2025" />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Label</div>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Alumni 2024-2025" />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={createAlumniGroup} disabled={creatingGroup}>
              {creatingGroup ? "Creating..." : "Create Group"}
            </Button>

            <div className="text-sm text-muted-foreground">
              Existing groups: <b>{alumniGroups.length}</b>
            </div>
          </div>

          {/* show groups list */}
          {alumniGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground">No alumni groups yet.</div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Label</th>
                    <th className="text-left p-3">Years</th>
                  </tr>
                </thead>
                <tbody>
                  {alumniGroups.map((g) => (
                    <tr key={g.id} className="border-t border-border">
                      <td className="p-3 font-medium">{g.label || `Alumni ${g.start_year}-${g.end_year}`}</td>
                      <td className="p-3 text-muted-foreground">
                        {g.start_year}–{g.end_year}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2) Promote student -> alumni (NO GROUP) */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="text-lg font-semibold">Promote Student → Alumni (role only)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Find student (name or email)</div>
              <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search student..." />

              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={selectedStudentUserId}
                onChange={(e) => setSelectedStudentUserId(e.target.value)}
              >
                <option value="">-- Select student --</option>
                {filteredStudents.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {(s.name ?? "No name") + " — " + s.email}
                  </option>
                ))}
              </select>

              <div className="text-xs text-muted-foreground">
                Tip: type to narrow down. (Shows up to 30 results)
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Action</div>
              <Button onClick={promoteStudentOnly} disabled={loading}>
                Promote to Alumni
              </Button>
              {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
            </div>
          </div>
        </div>

        {/* 3) Assign alumni -> group (separate) */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="text-lg font-semibold">Assign Alumni → Group</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Find alumni (name or email)</div>
              <Input value={alumniQuery} onChange={(e) => setAlumniQuery(e.target.value)} placeholder="Search alumni..." />

              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={selectedAlumniUserId}
                onChange={(e) => setSelectedAlumniUserId(e.target.value)}
              >
                <option value="">-- Select alumni --</option>
                {filteredAlumni.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {(a.name ?? "No name") + " — " + a.email}
                  </option>
                ))}
              </select>

              {selectedAlumniUserId && (
                <div className="text-xs text-muted-foreground">
                  Current group:{" "}
                  {membership.get(selectedAlumniUserId)
                    ? groupLabelById.get(membership.get(selectedAlumniUserId)!) ?? membership.get(selectedAlumniUserId)!
                    : "Not assigned"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Select group</div>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="">-- Select alumni group --</option>
                {alumniGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label || `Alumni ${g.start_year}-${g.end_year}`}
                  </option>
                ))}
              </select>

              <Button onClick={assignGroupToAlumni}>Save Assignment</Button>
            </div>
          </div>
        </div>

        {/* Alumni list */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="text-lg font-semibold">Alumni List</h2>

          {alumni.length === 0 && !loading && <div className="text-sm text-muted-foreground">No alumni yet.</div>}

          <div className="space-y-3">
            {alumni.slice(0, 50).map((a) => (
              <div
                key={a.user_id}
                className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{a.name ?? "(No name)"}</div>
                  <div className="text-sm text-muted-foreground">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    group:{" "}
                    {membership.get(a.user_id)
                      ? groupLabelById.get(membership.get(a.user_id)!) ?? membership.get(a.user_id)!
                      : "Not assigned"}
                  </div>
                </div>

                <Button variant="outline" onClick={() => makeStudent(a.user_id)}>
                  Make Student
                </Button>
              </div>
            ))}
          </div>

          {alumni.length > 50 && <div className="text-xs text-muted-foreground">Showing first 50 alumni.</div>}
        </div>

        <div className="text-xs text-muted-foreground">
          Note: This page manages existing users. Creating brand-new auth users requires a server/admin function.
        </div>
      </main>
    </div>
  );
}