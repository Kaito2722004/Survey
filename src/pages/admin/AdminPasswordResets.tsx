import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  RefreshCw,
} from "lucide-react";

type ResetRequest = {
  id: string;
  student_id: string;
  new_password: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  resolved_at: string | null;
  // joined
  student_name: string | null;
  student_email: string | null;
  student_number: string | null;
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

export default function AdminPasswordResets() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // fetch password_resets
      const { data: resets, error } = await supabase
        .from("password_resets")
        .select("id,student_id,new_password,status,requested_at,resolved_at")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      // fetch student details for each reset
      const studentIds = [
        ...new Set((resets ?? []).map((r: any) => r.student_id)),
      ];
      let studentMap = new Map<string, any>();

      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from("students")
          .select("id,name,email,student_number")
          .in("id", studentIds);

        (students ?? []).forEach((s: any) => studentMap.set(s.id, s));
      }

      const rows: ResetRequest[] = (resets ?? []).map((r: any) => {
        const student = studentMap.get(r.student_id);
        return {
          ...r,
          student_name: student?.name ?? null,
          student_email: student?.email ?? null,
          student_number: student?.student_number ?? null,
        };
      });

      setRequests(rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (req: ResetRequest) => {
    setActionId(req.id);
    try {
      // 1. Update password in students table
      const { error: pwErr } = await supabase
        .from("students")
        .update({ password: req.new_password })
        .eq("id", req.student_id);

      if (pwErr) throw pwErr;

      // 2. Mark request as approved
      const { error: updErr } = await supabase
        .from("password_resets")
        .update({ status: "approved", resolved_at: new Date().toISOString() })
        .eq("id", req.id);

      if (updErr) throw updErr;

      toast.success(
        `Password updated for ${req.student_name ?? req.student_email ?? "student"}.`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve request");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (req: ResetRequest) => {
    setActionId(req.id);
    try {
      const { error } = await supabase
        .from("password_resets")
        .update({ status: "rejected", resolved_at: new Date().toISOString() })
        .eq("id", req.id);

      if (error) throw error;

      toast.success("Request rejected.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject request");
    } finally {
      setActionId(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />

      <main className="container py-8 space-y-6 max-w-4xl">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              Password Reset Requests
            </h1>
            <p className="mt-1 text-muted-foreground">
              Review and approve student password reset requests.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Pending",
              value: pending.length,
              className: "text-yellow-600",
            },
            {
              label: "Approved",
              value: requests.filter((r) => r.status === "approved").length,
              className: "text-green-600",
            },
            {
              label: "Rejected",
              value: requests.filter((r) => r.status === "rejected").length,
              className: "text-red-600",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border bg-card p-4 space-y-1"
            >
              <p className={`text-2xl font-bold ${s.className}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Pending requests ── */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Pending ({pending.length})
              </h2>

              {pending.length === 0 ? (
                <div className="card-elevated rounded-xl p-8 text-center text-muted-foreground text-sm">
                  No pending requests.
                </div>
              ) : (
                <div className="card-elevated divide-y divide-border">
                  {pending.map((req) => {
                    const isBusy = actionId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="flex items-center justify-between gap-4 p-5 flex-wrap"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                              <KeyRound className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">
                              {req.student_name ?? "(Unknown student)"}
                            </span>
                            <span
                              className={`text-xs rounded-full border px-2 py-0.5 font-medium ${STATUS_BADGE[req.status].className}`}
                            >
                              {STATUS_BADGE[req.status].label}
                            </span>
                          </div>
                          {req.student_email && (
                            <div className="text-sm text-muted-foreground pl-9">
                              {req.student_email}
                            </div>
                          )}
                          {req.student_number && (
                            <div className="text-xs text-muted-foreground pl-9">
                              Student #: {req.student_number}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground pl-9">
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
                          <div className="pl-9 mt-1">
                            <span className="text-xs text-muted-foreground">
                              New password:{" "}
                            </span>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {req.new_password}
                            </code>
                          </div>
                        </div>

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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Resolved requests ── */}
            {resolved.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Resolved ({resolved.length})
                </h2>
                <div className="card-elevated divide-y divide-border opacity-75">
                  {resolved.map((req) => {
                    const badge = STATUS_BADGE[req.status];
                    return (
                      <div
                        key={req.id}
                        className="flex items-center justify-between gap-4 p-5 flex-wrap"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {req.student_name ?? "(Unknown student)"}
                            </span>
                            <span
                              className={`text-xs rounded-full border px-2 py-0.5 font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          {req.student_email && (
                            <div className="text-sm text-muted-foreground">
                              {req.student_email}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Requested{" "}
                            {new Date(req.requested_at).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                            {req.resolved_at && (
                              <>
                                {" "}
                                · Resolved{" "}
                                {new Date(req.resolved_at).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
