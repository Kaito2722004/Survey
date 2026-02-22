import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Building2, UserMinus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [orgRoleUsers, setOrgRoleUsers] = useState<ProfileRow[]>([]);
  const [groups, setGroups] = useState<TargetGroupRow[]>([]);
  const [members, setMembers] = useState<TargetGroupMemberRow[]>([]);

  // selection
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // create group / org
  const [newGroupName, setNewGroupName] = useState("");
  const [newOrgName, setNewOrgName] = useState("");

  // group member select
  const [selectedMemberOrgId, setSelectedMemberOrgId] = useState("");

  // assign org to user
  const [assignOrgToUserId, setAssignOrgToUserId] = useState("");
  const [assignOrgId, setAssignOrgId] = useState("");

  // remove user from org
  const [removeUserOrgId, setRemoveUserOrgId] = useState("");

  // delete confirmations
  const [confirmDeleteOrgId, setConfirmDeleteOrgId] = useState<string | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  /* =======================
     Load data
  ======================= */

  const loadAll = async () => {
    setLoading(true);
    try {
      const [orgRes, orgRoleUsersRes, groupRes] = await Promise.all([
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
      if (orgRoleUsersRes.error) throw orgRoleUsersRes.error;
      if (groupRes.error) throw groupRes.error;

      setOrganizations(orgRes.data ?? []);
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
      .select("id,target_group_id,organization_id,organizations(name)")
      .eq("target_group_id", groupId)
      .not("organization_id", "is", null);

    if (error) { toast.error(error.message); return; }
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

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  const usersWithOrg = useMemo(
    () => orgRoleUsers.filter((u) => u.organization_id !== null),
    [orgRoleUsers],
  );

  const orgToDelete = confirmDeleteOrgId
    ? organizations.find((o) => o.id === confirmDeleteOrgId)
    : null;

  const groupToDelete = confirmDeleteGroupId
    ? groups.find((g) => g.id === confirmDeleteGroupId)
    : null;

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

  const deleteGroup = async (groupId: string) => {
    await supabase.from("target_group_members").delete().eq("target_group_id", groupId);
    const { error } = await supabase.from("target_groups").delete().eq("id", groupId);
    if (error) return toast.error(error.message);
    toast.success("Group deleted");
    if (selectedGroupId === groupId) { setSelectedGroupId(""); setMembers([]); }
    setConfirmDeleteGroupId(null);
    loadAll();
  };

  const createOrganization = async () => {
    const name = newOrgName.trim();
    if (!name) return toast.error("Organization name required");
    const { error } = await supabase.from("organizations").insert({ name });
    if (error) return toast.error(error.message);
    toast.success("Organization created");
    setNewOrgName("");
    loadAll();
  };

  const deleteOrganization = async (orgId: string) => {
    // Unlink users assigned to this org
    await supabase.from("profiles").update({ organization_id: null }).eq("organization_id", orgId);
    // Remove from target groups
    await supabase.from("target_group_members").delete().eq("organization_id", orgId);
    const { error } = await supabase.from("organizations").delete().eq("id", orgId);
    if (error) return toast.error(error.message);
    toast.success("Organization deleted");
    setConfirmDeleteOrgId(null);
    if (selectedGroupId) loadMembers(selectedGroupId);
    loadAll();
  };

  const addMemberByOrganization = async () => {
    if (!selectedGroupId) return toast.error("Select a group first");
    if (!selectedMemberOrgId) return toast.error("Select an organization");
    const exists = members.some((m) => m.organization_id === selectedMemberOrgId);
    if (exists) return toast.error("This organization is already in the group");

    const { error } = await supabase.from("target_group_members").insert({
      target_group_id: selectedGroupId,
      organization_id: selectedMemberOrgId,
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
    const { error } = await supabase.from("target_group_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    loadMembers(selectedGroupId);
  };

  const assignOrganizationToOrgUser = async () => {
    if (!assignOrgToUserId) return toast.error("Select a user");
    if (!assignOrgId) return toast.error("Select organization");

    const selectedUser = orgRoleUsers.find((u) => u.user_id === assignOrgToUserId);
    if (selectedUser?.organization_id && selectedUser.organization_id !== assignOrgId) {
      return toast.error(
        `This user is already assigned to "${orgNameById.get(selectedUser.organization_id) ?? "an organization"}". Remove them from their current organization first.`,
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: assignOrgId })
      .eq("user_id", assignOrgToUserId);
    if (error) return toast.error(error.message);
    toast.success("Organization assigned to user");
    setAssignOrgToUserId("");
    setAssignOrgId("");
    loadAll();
  };

  const removeUserFromOrganization = async () => {
    if (!removeUserOrgId) return toast.error("Select a user");
    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: null })
      .eq("user_id", removeUserOrgId);
    if (error) return toast.error(error.message);
    toast.success("User removed from organization. They can now be reassigned.");
    setRemoveUserOrgId("");
    loadAll();
  };

  /* =======================
     UI
  ======================= */

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />
      <main className="container py-8 space-y-8">
        <h1 className="text-3xl font-semibold">Target Groups</h1>

        {/* ── Organizations: Create + List with Delete ── */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">Organizations</h2>

          <div className="flex gap-2">
            <Input
              placeholder="New organization name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={createOrganization}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {o.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDeleteOrgId(o.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Groups: Create + List with Delete ── */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">Groups</h2>

          <div className="flex gap-2">
            <Input
              placeholder="New group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={createGroup}>
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm font-medium">{g.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDeleteGroupId(g.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Group Members ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card-elevated p-6 space-y-2">
            <h2 className="font-semibold">Select Group</h2>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedGroupId === g.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 card-elevated p-6 space-y-4">
            <h2 className="font-semibold">
              Members of{" "}
              <span className="text-primary">
                {groupNameById.get(selectedGroupId) ?? "—"}
              </span>
            </h2>

            <div className="flex gap-2">
              <Select value={selectedMemberOrgId} onValueChange={setSelectedMemberOrgId}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select organization to add" />
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
              <Button onClick={addMemberByOrganization}>Add</Button>
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No organizations in this group yet.
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {m.organizations?.name ?? "(unknown organization)"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMember(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Assign Organization to User ── */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">Assign Organization to User</h2>
          <p className="text-sm text-muted-foreground">
            Each user can only belong to <b>one organization</b>, but an
            organization can have multiple users.
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

          <Button onClick={assignOrganizationToOrgUser} disabled={loading}>
            Assign
          </Button>
        </div>

        {/* ── Remove User from Organization ── */}
        <div className="card-elevated p-6 space-y-4">
          <h2 className="font-semibold">Remove User from Organization</h2>
          <p className="text-sm text-muted-foreground">
            Unlinks a user from their current organization so they can be
            reassigned to a different one.
          </p>

          {usersWithOrg.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users are currently assigned to an organization.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Select value={removeUserOrgId} onValueChange={setRemoveUserOrgId}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Select user to unlink" />
                </SelectTrigger>
                <SelectContent>
                  {usersWithOrg.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.name ?? u.email} —{" "}
                      {orgNameById.get(u.organization_id!) ?? "unknown org"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                onClick={removeUserFromOrganization}
                disabled={!removeUserOrgId || loading}
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Remove from Org
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* ── Confirm Delete Organization ── */}
      <AlertDialog
        open={!!confirmDeleteOrgId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteOrgId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <b>{orgToDelete?.name}</b>, remove it
              from all target groups, and unlink all users assigned to it. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteOrgId && deleteOrganization(confirmDeleteOrgId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Delete Group ── */}
      <AlertDialog
        open={!!confirmDeleteGroupId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteGroupId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the group <b>{groupToDelete?.name}</b> and
              remove all its member organizations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteGroupId && deleteGroup(confirmDeleteGroupId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}