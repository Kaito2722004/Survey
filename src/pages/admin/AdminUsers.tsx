import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentRow = {
  id: string;
  student_id: string;
  student_number: string;
  name: string;
  email: string | null;
  is_alumni: boolean;
  section_id: string;
  section_label: string | null;
};

type TeacherRow = {
  id: string;
  teacher_id: string;
  name: string;
  section_id: string;
  section_label: string | null;
};

type OrgRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  organization_id: string | null;
  organization_name: string | null;
};

type UnassignedRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
};

type SectionKey =
  | "unassigned"
  | "students"
  | "alumni"
  | "teachers"
  | "organizations";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [alumni, setAlumni] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedRow[]>([]);

  const [query, setQuery] = useState("");
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    unassigned: true,
    students: false,
    alumni: false,
    teachers: false,
    organizations: false,
  });

  const toggleOpen = (k: SectionKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  /* =======================
     Load
  ======================= */
  const load = async () => {
    setLoading(true);
    try {
      // sections lookup
      const { data: sectionData } = await supabase
        .from("sections")
        .select("id,sem,year_level,program,specialization");
      const sectionById = new Map<string, any>();
      (sectionData ?? []).forEach((s: any) => sectionById.set(s.id, s));

      const makeLabel = (section_id: string) => {
        const sec = sectionById.get(section_id);
        return sec
          ? `Y${sec.year_level} ${sec.specialization} — Sem ${sec.sem} (${sec.program})`
          : null;
      };

      // students — is_alumni = false
      const { data: studentData, error: studentErr } = await supabase
        .from("students")
        .select("id,student_id,student_number,name,email,is_alumni,section_id")
        .eq("is_alumni", false)
        .order("name", { ascending: true });
      if (studentErr) throw studentErr;
      setStudents(
        (studentData ?? []).map((s: any) => ({
          ...s,
          section_label: makeLabel(s.section_id),
        })),
      );

      // alumni — is_alumni = true
      const { data: alumniData, error: alumniErr } = await supabase
        .from("students")
        .select("id,student_id,student_number,name,email,is_alumni,section_id")
        .eq("is_alumni", true)
        .order("name", { ascending: true });
      if (alumniErr) throw alumniErr;
      setAlumni(
        (alumniData ?? []).map((s: any) => ({
          ...s,
          section_label: makeLabel(s.section_id),
        })),
      );

      // teachers
      const { data: teacherData, error: teacherErr } = await supabase
        .from("teachers")
        .select("id,teacher_id,name,section_id")
        .order("name", { ascending: true });
      if (teacherErr) throw teacherErr;
      setTeachers(
        (teacherData ?? []).map((t: any) => ({
          ...t,
          section_label: makeLabel(t.section_id),
        })),
      );

      // organizations — profiles where role = 'organization'
      const { data: orgProfileData, error: orgErr } = await supabase
        .from("profiles")
        .select("id,user_id,email,name,organization_id")
        .eq("role", "organization")
        .order("name", { ascending: true });
      if (orgErr) throw orgErr;

      const { data: orgData } = await supabase
        .from("organizations")
        .select("id,name");
      const orgById = new Map<string, string>();
      (orgData ?? []).forEach((o: any) => orgById.set(o.id, o.name));

      setOrganizations(
        (orgProfileData ?? []).map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          email: p.email,
          name: p.name,
          organization_id: p.organization_id,
          organization_name: p.organization_id
            ? (orgById.get(p.organization_id) ?? null)
            : null,
        })),
      );

      // unassigned — profiles where role is null and not admin
      const { data: unassignedData, error: unassignedErr } = await supabase
        .from("profiles")
        .select("id,user_id,email,name")
        .is("role", null)
        .eq("is_admin", false)
        .order("created_at", { ascending: false });
      if (unassignedErr) throw unassignedErr;
      setUnassigned(unassignedData ?? []);
    } catch (e: any) {
      console.error("Load error:", e);
      toast.error(e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* =======================
     Search filters
  ======================= */
  const q = query.trim().toLowerCase();

  const filteredStudents = useMemo(
    () =>
      !q
        ? students
        : students.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.email ?? "").toLowerCase().includes(q) ||
              s.student_number.toLowerCase().includes(q),
          ),
    [students, q],
  );

  const filteredAlumni = useMemo(
    () =>
      !q
        ? alumni
        : alumni.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.email ?? "").toLowerCase().includes(q) ||
              s.student_number.toLowerCase().includes(q),
          ),
    [alumni, q],
  );

  const filteredTeachers = useMemo(
    () =>
      !q
        ? teachers
        : teachers.filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.teacher_id.toLowerCase().includes(q) ||
              (t.section_label ?? "").toLowerCase().includes(q),
          ),
    [teachers, q],
  );

  const filteredOrgs = useMemo(
    () =>
      !q
        ? organizations
        : organizations.filter(
            (o) =>
              (o.name ?? "").toLowerCase().includes(q) ||
              o.email.toLowerCase().includes(q) ||
              (o.organization_name ?? "").toLowerCase().includes(q),
          ),
    [organizations, q],
  );

  const filteredUnassigned = useMemo(
    () =>
      !q
        ? unassigned
        : unassigned.filter(
            (u) =>
              (u.name ?? "").toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q),
          ),
    [unassigned, q],
  );

  /* =======================
     Save role (unassigned)
  ======================= */
  const saveRole = async (user_id: string) => {
    const newRole = roleDraft[user_id];
    if (!newRole) return toast.error("Select a role first.");
    setSaving((p) => ({ ...p, [user_id]: true }));
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("user_id", user_id);
      if (error) throw error;
      toast.success("Role assigned");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update role");
    } finally {
      setSaving((p) => ({ ...p, [user_id]: false }));
    }
  };

  /* =======================
     UI: Section wrapper
  ======================= */
  const Section = ({
    k,
    title,
    subtitle,
    count,
    children,
  }: {
    k: SectionKey;
    title: string;
    subtitle: string;
    count: number;
    children: React.ReactNode;
  }) => {
    const expanded = open[k];
    return (
      <div className="card-elevated overflow-hidden">
        <button
          type="button"
          onClick={() => toggleOpen(k)}
          className="w-full text-left p-6 flex items-center justify-between gap-3 hover:bg-muted/30 transition"
        >
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Count: {count}
            </span>
            <span className="text-sm font-medium">{expanded ? "▲" : "▼"}</span>
          </div>
        </button>
        {expanded && (
          <div className="border-t border-border p-6 space-y-3">
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">No users here.</p>
            ) : (
              children
            )}
          </div>
        )}
      </div>
    );
  };

  /* =======================
     UI: Cards
  ======================= */
  const StudentCard = ({ s }: { s: StudentRow }) => (
    <div className="rounded-lg border border-border p-4 space-y-0.5">
      <div className="font-medium">{s.name}</div>
      {s.email && (
        <div className="text-sm text-muted-foreground">{s.email}</div>
      )}
      <div className="text-xs text-muted-foreground">
        Student #: {s.student_number} · ID: {s.student_id}
      </div>
      {s.section_label && (
        <div className="text-xs text-muted-foreground">
          Section: {s.section_label}
        </div>
      )}
    </div>
  );

  const TeacherCard = ({ t }: { t: TeacherRow }) => (
    <div className="rounded-lg border border-border p-4 space-y-0.5">
      <div className="font-medium">{t.name}</div>
      <div className="text-xs text-muted-foreground">
        Teacher ID: {t.teacher_id}
      </div>
      {t.section_label && (
        <div className="text-xs text-muted-foreground">
          Section: {t.section_label}
        </div>
      )}
    </div>
  );

  const OrgCard = ({ o }: { o: OrgRow }) => (
    <div className="rounded-lg border border-border p-4 space-y-0.5">
      <div className="font-medium">{o.name ?? "(No name)"}</div>
      <div className="text-sm text-muted-foreground">{o.email}</div>
      {o.organization_name ? (
        <div className="text-xs text-muted-foreground">
          Org: {o.organization_name}
        </div>
      ) : (
        <div className="text-xs text-amber-600">No organization linked</div>
      )}
    </div>
  );

  const UnassignedCard = ({ u }: { u: UnassignedRow }) => (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <div className="font-medium">{u.name ?? "(No name)"}</div>
        <div className="text-sm text-muted-foreground">{u.email}</div>
        <div className="text-xs text-muted-foreground">Role: NULL</div>
      </div>
      <div className="flex gap-2 items-center">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={roleDraft[u.user_id] ?? ""}
          onChange={(e) =>
            setRoleDraft((p) => ({ ...p, [u.user_id]: e.target.value }))
          }
        >
          <option value="">-- Assign role --</option>
          <option value="student">student</option>
          <option value="alumni">alumni</option>
          <option value="organization">organization</option>
        </select>
        <Button
          size="sm"
          onClick={() => saveRole(u.user_id)}
          disabled={!!saving[u.user_id] || !roleDraft[u.user_id]}
        >
          {saving[u.user_id] ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );

  /* =======================
     Render
  ======================= */
  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />

      <main className="container py-8 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              User Management
            </h1>
            <p className="mt-1 text-muted-foreground">
              Students &amp; alumni from the students table · Teachers from the
              teachers table · Organizations &amp; unassigned from profiles.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="card-elevated p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name / email / student# / teacher ID / org..."
          />
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading users...</div>
        ) : (
          <div className="grid gap-4">
            <Section
              k="unassigned"
              title="Unassigned (role = NULL)"
              subtitle="Profiles with no role assigned yet."
              count={filteredUnassigned.length}
            >
              {filteredUnassigned.map((u) => (
                <UnassignedCard key={u.id} u={u} />
              ))}
            </Section>

            <Section
              k="students"
              title="Students"
              subtitle="From students table where is_alumni = false."
              count={filteredStudents.length}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredStudents.map((s) => (
                  <StudentCard key={s.id} s={s} />
                ))}
              </div>
            </Section>

            <Section
              k="alumni"
              title="Alumni"
              subtitle="From students table where is_alumni = true."
              count={filteredAlumni.length}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredAlumni.map((s) => (
                  <StudentCard key={s.id} s={s} />
                ))}
              </div>
            </Section>

            <Section
              k="teachers"
              title="Teachers"
              subtitle="From teachers table."
              count={filteredTeachers.length}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredTeachers.map((t) => (
                  <TeacherCard key={t.id} t={t} />
                ))}
              </div>
            </Section>

            <Section
              k="organizations"
              title="Organizations"
              subtitle="From profiles table where role = 'organization'."
              count={filteredOrgs.length}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredOrgs.map((o) => (
                  <OrgCard key={o.id} o={o} />
                ))}
              </div>
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}
