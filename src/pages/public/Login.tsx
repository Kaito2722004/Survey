import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  Mail,
  X,
  KeyRound,
  Users,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, studentLogin, user } = useAuth();
  const navigate = useNavigate();

  // ── Forgot password modal state ──
  const [showForgot, setShowForgot] = useState(false);
  const [accountType, setAccountType] = useState<"student" | "organization">(
    "student",
  );

  // Student fields
  const [fpEmail, setFpEmail] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpLoading, setFpLoading] = useState(false);

  // Org fields
  const [orgEmail, setOrgEmail] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgSent, setOrgSent] = useState(false);

  // Auto-redirect based on role
  useEffect(() => {
    if (!user) return;
    if (user.isAdmin || user.role === "admin")
      navigate("/admin", { replace: true });
    else if (user.role === "alumni") navigate("/alumni", { replace: true });
    else if (user.role === "organization")
      navigate("/organization", { replace: true });
    else if (user.role === "student") navigate("/student", { replace: true });
    else navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    try {
      let isStudent = false;
      try {
        await studentLogin(email, password);
        isStudent = true;
      } catch {}
      if (!isStudent) await login(email, password);
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error?.message ?? "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setAccountType("student");
    setFpEmail("");
    setFpNewPassword("");
    setFpConfirm("");
    setOrgEmail("");
    setOrgSent(false);
  };

  /* =======================
     Student reset (admin approval)
  ======================= */
  const handleStudentReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpEmail || !fpNewPassword || !fpConfirm) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (fpNewPassword !== fpConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (fpNewPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setFpLoading(true);
    try {
      const { data: student, error: studentErr } = await supabase
        .from("students")
        .select("id")
        .eq("email", fpEmail.trim().toLowerCase())
        .maybeSingle();

      if (studentErr) throw studentErr;
      if (!student) {
        toast.error("No student account found with that email.");
        return;
      }

      const { data: existing } = await supabase
        .from("password_resets")
        .select("id")
        .eq("student_id", student.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        toast.info(
          "You already have a pending reset request. Please wait for admin approval.",
        );
        return;
      }

      const { error: insertErr } = await supabase
        .from("password_resets")
        .insert({
          student_id: student.id,
          new_password: fpNewPassword,
          status: "pending",
        });

      if (insertErr) throw insertErr;

      toast.success(
        "Reset request submitted! An admin will review and approve it shortly.",
      );
      closeForgot();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit request.");
    } finally {
      setFpLoading(false);
    }
  };

  /* =======================
     Org reset (Supabase email)
  ======================= */
  const handleOrgReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgEmail.trim()) {
      toast.error("Enter your organization email.");
      return;
    }

    setOrgLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        orgEmail.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (error) throw error;
      setOrgSent(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send reset email.");
    } finally {
      setOrgLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="card-elevated p-8">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-2xl font-semibold text-foreground">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in to your account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@uit.edu.mm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-primary hover:underline underline-offset-2 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {import.meta.env.DEV && (
              <div className="mt-6 rounded-lg border border-dashed border-border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide">
                  Dev Quick Login
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@uit.edu.mm");
                      setPassword("uitadmin");
                    }}
                    className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("student@uit.edu.mm");
                      setPassword("uitstudent");
                    }}
                    className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    Student
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={closeForgot}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="card-elevated p-6 space-y-5 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Reset Password</h2>
                </div>
                <button
                  onClick={closeForgot}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Account type selector ── */}
              <div className="space-y-1.5">
                <Label>Account type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType("student");
                      setOrgSent(false);
                    }}
                    className={[
                      "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                      accountType === "student"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <Users className="h-4 w-4" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountType("organization");
                      setOrgSent(false);
                    }}
                    className={[
                      "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                      accountType === "organization"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <Building2 className="h-4 w-4" />
                    Organization
                  </button>
                </div>
              </div>

              {/* ── Student form ── */}
              {accountType === "student" && (
                <>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      Your request will be reviewed by an admin. Once approved,
                      your password will be updated.
                    </p>
                  </div>
                  <form onSubmit={handleStudentReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fp-email">Student email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="fp-email"
                          type="email"
                          placeholder="you@uit.edu.mm"
                          value={fpEmail}
                          onChange={(e) => setFpEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fp-new">New password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="fp-new"
                          type="password"
                          placeholder="Min 6 characters"
                          value={fpNewPassword}
                          onChange={(e) => setFpNewPassword(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fp-confirm">Confirm new password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="fp-confirm"
                          type="password"
                          placeholder="Repeat password"
                          value={fpConfirm}
                          onChange={(e) => setFpConfirm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={closeForgot}
                        disabled={fpLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1"
                        disabled={fpLoading}
                      >
                        {fpLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Request"
                        )}
                      </Button>
                    </div>
                  </form>
                </>
              )}

              {/* ── Organization form ── */}
              {accountType === "organization" && (
                <>
                  {!orgSent ? (
                    <form onSubmit={handleOrgReset} className="space-y-4">
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-sm text-blue-800">
                          A password reset link will be sent to your
                          organization email address.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org-email">Organization email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="org-email"
                            type="email"
                            placeholder="your@organization.com"
                            value={orgEmail}
                            onChange={(e) => setOrgEmail(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={closeForgot}
                          disabled={orgLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={orgLoading}
                        >
                          {orgLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Send Reset Link"
                          )}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-center space-y-1">
                        <p className="text-sm font-medium text-green-800">
                          Reset link sent!
                        </p>
                        <p className="text-xs text-green-700">
                          Check <strong>{orgEmail}</strong> and follow the link
                          to set a new password.
                        </p>
                      </div>
                      <Button className="w-full" onClick={closeForgot}>
                        Done
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Login;
