import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Role = "student" | "alumni" | "organization";

type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string | null;
  is_admin: boolean;
  created_at: string;
};

type SectionKey = "unassigned" | "students" | "alumni" | "organizations";

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [query, setQuery] = useState("");

  // dropdown drafts (per user)
  const [roleDraft, setRoleDraft] = useState<Record<string, Role | "">>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<Role | "">("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // ✅ collapsed sections: click to expand
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    unassigned: true, // usually most important; set to false if you want all collapsed
    students: false,
    alumni: false,
    organizations: false,
  });

  const toggleOpen = (k: SectionKey) => {
    setOpen((p) => ({ ...p, [k]: !p[k] }));
  };

  /* =======================
     Load
  ======================= */
  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,user_id,email,name,role,is_admin,created_at")
      .eq("is_admin", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error(error.message);
      setUsers([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as ProfileRow[];
    setUsers(rows);

    // init role draft
    setRoleDraft((prev) => {
      const next = { ...prev };
      rows.forEach((u) => {
        if (next[u.user_id] === undefined) next[u.user_id] = (u.role as Role) || "";
      });
      return next;
    });

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  /* =======================
     Search + Groups
  ======================= */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      const name = (u.name ?? "").toLowerCase();
      const role = (u.role ?? "").toLowerCase();
      return email.includes(q) || name.includes(q) || role.includes(q);
    });
  }, [users, query]);

  const unassigned = useMemo(() => filtered.filter((u) => !u.role), [filtered]);
  const students = useMemo(() => filtered.filter((u) => u.role === "student"), [filtered]);
  const alumni = useMemo(() => filtered.filter((u) => u.role === "alumni"), [filtered]);
  const organizations = useMemo(() => filtered.filter((u) => u.role === "organization"), [filtered]);

  const selectedCount = selected.size;

  /* =======================
     Selection helpers
  ======================= */
  const isSelected = (user_id: string) => selected.has(user_id);

  const toggleSelected = (user_id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(user_id)) next.delete(user_id);
      else next.add(user_id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const selectAllInList = (list: ProfileRow[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((u) => next.add(u.user_id));
      return next;
    });
  };

  const clearAllInList = (list: ProfileRow[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((u) => next.delete(u.user_id));
      return next;
    });
  };

  const allSelectedInList = (list: ProfileRow[]) =>
    list.length > 0 && list.every((u) => selected.has(u.user_id));

  const someSelectedInList = (list: ProfileRow[]) =>
    list.some((u) => selected.has(u.user_id));

  /* =======================
     Save role (single)
  ======================= */
  const saveRole = async (user_id: string) => {
    const newRole = roleDraft[user_id];
    if (!newRole) return toast.error("Select a role first.");

    setSaving((p) => ({ ...p, [user_id]: true }));
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("user_id", user_id);
      if (error) throw error;

      toast.success("Role updated");
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to update role");
    } finally {
      setSaving((p) => ({ ...p, [user_id]: false }));
    }
  };

  /* =======================
     Bulk apply
  ======================= */
  const applyBulkRole = async () => {
    if (!bulkRole) return toast.error("Choose a bulk role first.");
    if (selected.size === 0) return toast.error("Select at least 1 user.");

    const ids = Array.from(selected);

    setBulkSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ role: bulkRole }).in("user_id", ids);
      if (error) throw error;

      toast.success(`Updated ${ids.length} user(s)`);
      setBulkRole("");
      clearSelection();
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Bulk update failed");
    } finally {
      setBulkSaving(false);
    }
  };

  /* =======================
     UI blocks
  ======================= */
  const UserRow = ({ u }: { u: ProfileRow }) => {
    const draft = roleDraft[u.user_id] ?? "";

    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 items-start">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={isSelected(u.user_id)}
            onChange={() => toggleSelected(u.user_id)}
          />
          <div>
            <div className="font-medium">{u.name ?? "(No name)"}</div>
            <div className="text-sm text-muted-foreground">{u.email}</div>
            <div className="text-xs text-muted-foreground">current role: {u.role ?? "NULL"}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={draft}
            onChange={(e) =>
              setRoleDraft((p) => ({
                ...p,
                [u.user_id]: e.target.value as Role | "",
              }))
            }
          >
            <option value="">-- Select role --</option>
            <option value="student">student</option>
            <option value="alumni">alumni</option>
            <option value="organization">organization</option>
          </select>

          <Button onClick={() => saveRole(u.user_id)} disabled={!!saving[u.user_id]}>
            {saving[u.user_id] ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    );
  };

  const Section = ({
    k,
    title,
    subtitle,
    list,
  }: {
    k: SectionKey;
    title: string;
    subtitle: string;
    list: ProfileRow[];
  }) => {
    const expanded = open[k];
    const all = allSelectedInList(list);
    const some = someSelectedInList(list);

    return (
      <div className="card-elevated overflow-hidden">
        {/* Header (click to expand) */}
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
            <div className="text-sm text-muted-foreground">Count: {list.length}</div>
            <div className="text-sm font-medium">{expanded ? "▲" : "▼"}</div>
          </div>
        </button>

        {/* Body */}
        {expanded && (
          <div className="border-t border-border p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Selected in this section:{" "}
                <b>{list.filter((u) => selected.has(u.user_id)).length}</b>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => (all ? clearAllInList(list) : selectAllInList(list))}
                  disabled={list.length === 0}
                >
                  {all ? "Unselect section" : some ? "Select remaining" : "Select section"}
                </Button>
              </div>
            </div>

            {list.length === 0 ? (
              <div className="text-sm text-muted-foreground">No users in this section.</div>
            ) : (
              <div className="space-y-3">
                {list.map((u) => (
                  <UserRow key={u.id} u={u} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* =======================
     Render
  ======================= */
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">User Role Management</h1>
            <p className="mt-1 text-muted-foreground">
              Click a category to view users. Bulk assign roles with checkboxes.
            </p>
          </div>

          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>

        {/* Search + Bulk bar */}
        <div className="card-elevated p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name / email / role..."
            />
            <div className="text-sm text-muted-foreground">Total users: {filtered.length}</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Selected: <b>{selectedCount}</b>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value as Role | "")}
              >
                <option value="">-- Bulk role --</option>
                <option value="student">student</option>
                <option value="alumni">alumni</option>
                <option value="organization">organization</option>
              </select>

              <Button onClick={applyBulkRole} disabled={bulkSaving || selectedCount === 0 || !bulkRole}>
                {bulkSaving ? "Applying..." : "Apply to selected"}
              </Button>

              <Button variant="outline" onClick={clearSelection} disabled={selectedCount === 0}>
                Clear selection
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Tip: Open a section → click “Select section” → apply bulk role.
          </div>
        </div>

        {loading && <div className="text-sm text-muted-foreground">Loading users...</div>}

        {!loading && (
          <div className="grid gap-4">
            <Section
              k="unassigned"
              title="Unassigned (role = NULL)"
              subtitle="Click to expand and bulk assign roles."
              list={unassigned}
            />
            <Section
              k="students"
              title="Students"
              subtitle="role = student"
              list={students}
            />
            <Section
              k="alumni"
              title="Alumni"
              subtitle="role = alumni"
              list={alumni}
            />
            <Section
              k="organizations"
              title="Organizations"
              subtitle="role = organization"
              list={organizations}
            />
          </div>
        )}
      </main>
    </div>
  );
}