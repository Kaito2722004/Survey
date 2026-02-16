import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
import { Search, Trash2 } from "lucide-react";

type OrganizationProfile = {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
  role: string | null;
};

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<OrganizationProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OrganizationProfile | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        (o.name || "").toLowerCase().includes(q) ||
        (o.email || "").toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await (supabase as any)
        .from("profiles")
        .select("id,user_id,name,email,role")
        .eq("role", "organization")
        .order("name", { nullsFirst: false });
      const { data, error } = res as { data: OrganizationProfile[] | null; error: { message: string } | null };

      if (error) throw error;
      setOrganizations((data ?? []) as OrganizationProfile[]);
    } catch (e) {
      console.error("Load organizations:", e);
      toast.error(String((e as any)?.message ?? "Failed to load organizations"));
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteClick = (org: OrganizationProfile) => {
    setConfirmDelete(org);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const userId = confirmDelete.user_id;
    setDeletingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("Organization removed.");
      setOrganizations((prev) => prev.filter((o) => o.user_id !== userId));
      setConfirmDelete(null);
    } catch (e) {
      console.error("Delete organization:", e);
      toast.error(
        String((e as any)?.message ?? "Failed to delete. You may need an RLS policy allowing admins to delete profiles.")
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Manage Organizations
          </h1>
          <p className="mt-1 text-muted-foreground">
            View and remove organization accounts. Search by name or email.
          </p>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by organization name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading organizations…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {organizations.length === 0
                ? "No organization accounts yet."
                : "No organizations match your search."}
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="w-[100px] p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org) => (
                    <tr key={org.user_id} className="border-t border-border">
                      <td className="p-3">{org.name ?? "—"}</td>
                      <td className="p-3">{org.email}</td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(org)}
                          disabled={deletingId === org.user_id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {deletingId === org.user_id ? "Removing…" : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{confirmDelete?.name ?? confirmDelete?.email ?? "this organization"}</strong>{" "}
              ({confirmDelete?.email})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
