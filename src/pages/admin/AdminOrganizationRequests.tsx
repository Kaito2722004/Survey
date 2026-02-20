import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Header } from "@/components/layout/Header";

type OrgRequest = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

export default function AdminOrganizationRequests() {
  const [requests, setRequests] = useState<OrgRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organization_requests")
      .select(
        "id, name, email, password_hash, status, requested_at, reviewed_at",
      )
      .order("requested_at", { ascending: false });

    if (error) {
      toast.error("Failed to load requests");
    } else {
      setRequests((data ?? []) as OrgRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (req: OrgRequest) => {
    setActionId(req.id);
    try {
      // Save admin session BEFORE signUp overwrites it
      const {
        data: { session: adminSession },
      } = await supabase.auth.getSession();

      // 1. Create Supabase auth account — triggers handle_new_user() to create profile
      //    Supabase sends confirmation email automatically
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp(
        {
          email: req.email,
          password: req.password_hash,
          options: {
            data: { name: req.name, role: "organization" },
          },
        },
      );

      // Restore admin session immediately
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      if (signUpErr) throw signUpErr;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("Failed to create user account.");

      // 2. Create a row in public.organizations
      const { data: orgRow, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: req.name })
        .select("id")
        .single();

      if (orgErr) throw orgErr;
      const newOrgId = orgRow.id;

      // 3. Update the profile with role=organization and organization_id
      //    (wait briefly for the trigger to create the profile first)
      await new Promise((r) => setTimeout(r, 800));

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ role: "organization", organization_id: newOrgId })
        .eq("user_id", newUserId);

      if (profErr) throw profErr;

      // 4. Mark request as approved
      const { error: updErr } = await supabase
        .from("organization_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", req.id);

      if (updErr) throw updErr;

      toast.success(`Approved! Confirmation email sent to ${req.email}`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve request");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (req: OrgRequest) => {
    setActionId(req.id);
    try {
      const { error } = await supabase
        .from("organization_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", req.id);
      if (error) throw error;
      toast.success(`Request from ${req.email} rejected.`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reject request");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              Organization Requests
            </h1>
            <p className="mt-1 text-muted-foreground">
              Review and approve organization account requests.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        <div className="card-elevated">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No organization requests yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((req) => {
                const badge = STATUS_BADGE[req.status];
                const isBusy = actionId === req.id;
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-4 p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {req.name}
                        </span>
                        <span
                          className={`text-xs rounded-full border px-2 py-0.5 font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {req.email}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Requested{" "}
                        {new Date(req.requested_at).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </div>
                      {req.reviewed_at && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Reviewed{" "}
                          {new Date(req.reviewed_at).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </div>
                      )}
                    </div>

                    {req.status === "pending" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req)}
                          disabled={isBusy}
                          className="gap-1"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(req)}
                          disabled={isBusy}
                          className="gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
