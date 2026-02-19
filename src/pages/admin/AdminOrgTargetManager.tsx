import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* =======================
   Types
======================= */

type OrganizationRow = { id: string; name: string };

type ProfileRow = {
  user_id: string;
  email: string;
  name: string | null;
  role: string | null;
  organization_id: string | null;
};

type TargetGroupRow = { id: string; name: string; description: string | null };

type TargetGroupMemberRow = {
  id: string;
  target_group_id: string;
  member_user_id: string | null;
  member_email: string | null;
  organization_id?: string | null;
  organizations?: { name: string } | null;
};

/* =======================
   Component
======================= */

export default function AdminOrgTargetManager() {
  const [loading, setLoading] = useState(true);

  // data
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [noRoleUsers, setNoRoleUsers] = useState<ProfileRow[]>([]);
  const [orgRoleUsers, setOrgRoleUsers] = useState<ProfileRow[]>([]);
  const [groups, setGroups] = useState<TargetGroupRow[]>([]);
  const [members, setMembers] = useState<TargetGroupMemberRow[]>([]);

  // selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // create group
  const [newGroupName, setNewGroupName] = useState("");

  // ✅ NEW: create organization
  const [newOrgName, setNewOrgName] = useState("");

  // ✅ NEW: group member select = organization
  const [selectedMemberOrgId, setSelectedMemberOrgId] = useState("");

  // onboarding: NULL role -> organization (KEEP AS IS)
  const [assignSearch, setAssignSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState("");

  // ✅ NEW: assign org to org-role user
  const [assignOrgToUserId, setAssignOrgToUserId] = useState("");
  const [assignOrgId, setAssignOrgId] = useState("");

  /* =======================
     Load data
  ======================= */

  const loadAll = async () => {
    setLoading(true);
    try {
      const [orgRes, noRoleUsersRes, orgRoleUsersRes, groupRes] =
        await Promise.all([
          supabase.from("organizations").select("id,name").order("name"),

          // users with role = NULL
          supabase
            .from("profiles")
            .select("user_id,email,name,role,organization_id")
            .is("role", null)
            .order("email"),

          // users with role = organization
          supabase
            .from("profiles")
            .select("user_id,email,name,role,organization_id")
            .eq("role", "organization")
            .order("email"),

          supabase
            .from("target_groups")
            .select("id,name,description")
            .order("name"),
        ]);

      if (orgRes.error) throw orgRes.error;
      if (noRoleUsersRes.error) throw noRoleUsersRes.error;
      if (orgRoleUsersRes.error) throw orgRoleUsersRes.error;
      if (groupRes.error) throw groupRes.error;

      setOrganizations(orgRes.data ?? []);
      setNoRoleUsers(noRoleUsersRes.data ?? []);
      setOrgRoleUsers(orgRoleUsersRes.data ?? []);
      setGroups(groupRes.data ?? []);

      if (!selectedGroupId && groupRes.data?.length) {
        setSelectedGroupId(groupRes.data[0].id);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    // ✅ now we want org members -> join organizations(name)
    const { data, error } = await supabase
      .from("target_group_members")
      .select("id,target_group_id,organization_id,organizations(name)")
      .eq("target_group_id", groupId)
      .not("organization_id", "is", null);

    if (error) {
      toast.error(error.message);
      return;
    }
    setMembers((data as any) ?? []);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadMembers(selectedGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  /* =======================
     Derived data
  ======================= */

  const orgNameById = useMemo(() => {
    const m = new Map<string, string>();
    organizations.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [organizations]);

  const filteredNoRoleUsers = useMemo(() => {
    const q = assignSearch.toLowerCase().trim();
    return noRoleUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q),
    );
  }, [noRoleUsers, assignSearch]);

  /* =======================
     Actions
  ======================= */

  const createGroup = async () => {
    if (!newGroupName.trim()) return toast.error("Group name required");

    const { error } = await supabase
      .from("target_groups")
      .insert({ name: newGroupName.trim() });

    if (error) return toast.error(error.message);

    toast.success("Group created");
    setNewGroupName("");
    loadAll();
  };

  // ✅ NEW: create organization
  const createOrganization = async () => {
    const name = newOrgName.trim();
    if (!name) return toast.error("Organization name required");

    const { error } = await supabase.from("organizations").insert({ name });
    if (error) return toast.error(error.message);

    toast.success("Organization created");
    setNewOrgName("");
    loadAll();
  };

  // ✅ NEW: Add group member by selecting organization_id
  const addMemberByOrganization = async () => {
    if (!selectedGroupId) return toast.error("Select a group first");
    if (!selectedMemberOrgId) return toast.error("Select an organization");

    const exists = members.some((m) => m.organization_id === selectedMemberOrgId);
    if (exists) return toast.error("This organization is already in the group");

    const { error } = await supabase.from("target_group_members").insert({
      target_group_id: selectedGroupId,
      organization_id: selectedMemberOrgId,
      // keep other member fields null
      member_user_id: null,
      member_email: null,
      rep_name: null,
      rep_email: null,
      rep_role: null,
    });

    if (error) return toast.error(error.message);

    toast.success("Organization added to group");
    setSelectedMemberOrgId("");
    loadMembers(selectedGroupId);
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase
      .from("target_group_members")
      .delete()
      .eq("id", id);

    if (error) return toast.error(error.message);

    toast.success("Member removed");
    loadMembers(selectedGroupId);
  };

  // KEEP AS IS: NULL role -> organization
  const assignOrganizationRole = async () => {
    if (!assignUserId) return toast.error("Select a user");

    const { error } = await supabase
      .from("profiles")
      .update({ role: "organization" })
      .eq("user_id", assignUserId);

    if (error) return toast.error(error.message);

    toast.success("Role set to organization");
    setAssignUserId("");
    loadAll();
  };

  // ✅ NEW: assign organization_id to a user who already has role=organization
  const assignOrganizationToOrgUser = async () => {
    if (!assignOrgToUserId) return toast.error("Select an organization user");
    if (!assignOrgId) return toast.error("Select organization");

    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: assignOrgId })
      .eq("user_id", assignOrgToUserId);

    if (error) return toast.error(error.message);

    toast.success("Assigned organization to user");
    setAssignOrgToUserId("");
    setAssignOrgId("");
    loadAll();
  };

  const clearOrganizationForOrgUser = async () => {
    if (!assignOrgToUserId) return toast.error("Select an organization user");

    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: null })
      .eq("user_id", assignOrgToUserId);

    if (error) return toast.error(error.message);

    toast.success("Cleared organization from user");
    setAssignOrgToUserId("");
    setAssignOrgId("");
    loadAll();
  };

  /* =======================
     UI
  ======================= */

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-8">
        <h1 className="text-3xl font-semibold">Target Groups</h1>

        {/* ✅ NEW: Create organization */}
        <div className="card-elevated p-6 space-y-3">
          <h2 className="font-semibold">Create Organization</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Organization name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
            <Button onClick={createOrganization}>
              <Plus className="mr-2 h-4 w-4" />
              Add Organization
            </Button>
          </div>
        </div>

        {/* Create group (KEEP) */}
        <div className="card-elevated p-6 space-y-3">
          <h2 className="font-semibold">Create Group</h2>
          <Input
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Button onClick={createGroup}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </div>

        {/* Groups + members */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Groups */}
          <div className="card-elevated p-6 space-y-2">
            <h2 className="font-semibold">Groups</h2>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  selectedGroupId === g.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* Members (CHANGED: org members) */}
          <div className="lg:col-span-2 card-elevated p-6 space-y-4">
            <h2 className="font-semibold">Members (Organizations)</h2>

            {/* ✅ select organization (not user) */}
            <div className="grid gap-2 md:grid-cols-3">
              <Select
                value={selectedMemberOrgId}
                onValueChange={setSelectedMemberOrgId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {o.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={addMemberByOrganization}>Add to Group</Button>
            </div>

            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span>{m.organizations?.name ?? "(unknown organization)"}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(m.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ NEW: Assign organization to org-role users */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">Assign Organization to Organization Users</h2>
          <p className="text-sm text-muted-foreground">
            Select a user whose <b>role = organization</b>, then assign which{" "}
            <b>Organization</b> they belong to.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Select value={assignOrgToUserId} onValueChange={setAssignOrgToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user (role = organization)" />
              </SelectTrigger>
              <SelectContent>
                {orgRoleUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {(u.name ?? u.email) + " • " + u.email}
                    {u.organization_id
                      ? ` • ${orgNameById.get(u.organization_id) ?? "(unknown org)"}`
                      : " • (no org)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignOrgId} onValueChange={setAssignOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={assignOrganizationToOrgUser} disabled={loading}>
              Assign
            </Button>
            <Button
              variant="outline"
              onClick={clearOrganizationForOrgUser}
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Onboarding: NULL role -> organization (KEEP EXACTLY) */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">User Onboarding</h2>
          <p className="text-sm text-muted-foreground">
            Fetch users with <b>role = NULL</b> and set them to{" "}
            <b>organization</b>.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Search name or email"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
            />

            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user (role is NULL)" />
              </SelectTrigger>
              <SelectContent>
                {filteredNoRoleUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {(u.name ?? u.email) + " • " + u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={assignOrganizationRole} disabled={loading}>
            Set Role = organization
          </Button>

          {!loading && (
            <p className="text-sm text-muted-foreground">
              Found <b>{noRoleUsers.length}</b> user(s) with role = NULL.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}