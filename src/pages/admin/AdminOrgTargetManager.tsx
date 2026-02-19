import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
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

  // add member (by selecting org-role user only)
  const [selectedMemberUserId, setSelectedMemberUserId] = useState("");

  // onboarding: NULL role -> organization
  const [assignSearch, setAssignSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState("");

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
    const { data, error } = await supabase
      .from("target_group_members")
      .select("*")
      .eq("target_group_id", groupId);

    if (error) {
      toast.error(error.message);
      return;
    }
    setMembers(data ?? []);
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

  // Add member by selecting a user_id (role=organization)
  const addMemberByUserId = async () => {
    if (!selectedGroupId) return toast.error("Select a group first");
    if (!selectedMemberUserId) return toast.error("Select a member user");

    const exists = members.some((m) => m.member_user_id === selectedMemberUserId);
    if (exists) return toast.error("This user is already in the group");

    const { error } = await supabase.from("target_group_members").insert({
      target_group_id: selectedGroupId,
      member_user_id: selectedMemberUserId,
      member_email: null,
    });

    if (error) return toast.error(error.message);

    toast.success("Member added");
    setSelectedMemberUserId("");
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

  /* =======================
     UI
  ======================= */

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-8">
        <h1 className="text-3xl font-semibold">Target Groups</h1>

        {/* Create group */}
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

          {/* Members */}
          <div className="lg:col-span-2 card-elevated p-6 space-y-4">
            <h2 className="font-semibold">Members</h2>

            {/* ✅ Only Select box (role=organization) */}
            <div className="grid gap-2 md:grid-cols-3">
              <Select
                value={selectedMemberUserId}
                onValueChange={setSelectedMemberUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization user" />
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

              <Button onClick={addMemberByUserId}>Add Member</Button>
            </div>

            {members.map((m) => {
              const fromUser =
                m.member_user_id
                  ? orgRoleUsers.find((u) => u.user_id === m.member_user_id) ??
                    noRoleUsers.find((u) => u.user_id === m.member_user_id)
                  : null;

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border px-3 py-2"
                >
                  <span>
                    {fromUser?.email ??
                      m.member_email ??
                      m.member_user_id ??
                      "(unknown member)"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Onboarding: NULL role -> organization */}
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