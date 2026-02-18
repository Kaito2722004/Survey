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

type OrganizationRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  organization_id: string | null;
};

type TargetGroupRow = {
  id: string;
  name: string;
  description: string | null;
};

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
  const [orgUsers, setOrgUsers] = useState<ProfileRow[]>([]);
  const [groups, setGroups] = useState<TargetGroupRow[]>([]);
  const [members, setMembers] = useState<TargetGroupMemberRow[]>([]);

  // selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // create group
  const [newGroupName, setNewGroupName] = useState("");

  // add member
  const [memberEmail, setMemberEmail] = useState("");

  // assignment
  const [assignSearch, setAssignSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignOrgId, setAssignOrgId] = useState("");

  /* =======================
     Load data
  ======================= */

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        orgRes,
        orgUsersRes,
        groupRes,
      ] = await Promise.all([
        supabase.from("organizations").select("id,name").order("name"),
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
      if (orgUsersRes.error) throw orgUsersRes.error;
      if (groupRes.error) throw groupRes.error;

      setOrganizations(orgRes.data ?? []);
      setOrgUsers(orgUsersRes.data ?? []);
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
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadMembers(selectedGroupId);
  }, [selectedGroupId]);

  /* =======================
     Derived data
  ======================= */

  const orgNameById = useMemo(() => {
    const m = new Map<string, string>();
    organizations.forEach((o) => m.set(o.id, o.name));
    return m;
  }, [organizations]);

  const filteredOrgUsers = useMemo(() => {
    const q = assignSearch.toLowerCase();
    return orgUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q),
    );
  }, [orgUsers, assignSearch]);

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

  const addMemberByEmail = async () => {
    if (!selectedGroupId) return toast.error("Select a group first");
    if (!memberEmail.trim()) return toast.error("Email required");

    const { error } = await supabase.from("target_group_members").insert({
      target_group_id: selectedGroupId,
      member_email: memberEmail.trim().toLowerCase(),
    });

    if (error) return toast.error(error.message);

    toast.success("Member added");
    setMemberEmail("");
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

  const assignOrganization = async () => {
    if (!assignUserId) return toast.error("Select user");
    if (!assignOrgId) return toast.error("Select organization");

    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: assignOrgId })
      .eq("user_id", assignUserId);

    if (error) return toast.error(error.message);

    toast.success("Organization assigned");
    setAssignUserId("");
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

            <div className="flex gap-2">
              <Input
                placeholder="Enter email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
              <Button onClick={addMemberByEmail}>Add</Button>
            </div>

            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span>
                  {m.member_email ??
                    orgUsers.find((u) => u.user_id === m.member_user_id)
                      ?.email}
                </span>
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

        {/* Assignments */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign or reassign organization users to an organization.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <Input
              placeholder="Search name or email"
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
            />

            <Select value={assignUserId} onValueChange={setAssignUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization user" />
              </SelectTrigger>
              <SelectContent>
                {filteredOrgUsers.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {(u.name ?? u.email) + " • " + u.email}
                    {u.organization_id
                      ? ` • ${orgNameById.get(u.organization_id)}`
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

          <Button onClick={assignOrganization}>
            Assign / Reassign Organization
          </Button>
        </div>
      </main>
    </div>
  );
}