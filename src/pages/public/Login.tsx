import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, X, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, studentLogin, user } = useAuth();
  const navigate = useNavigate();

  // ── Forgot password modal state ──
  const [showForgot, setShowForgot] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpLoading, setFpLoading] = useState(false);

  // Auto-redirect based on role once user is set
  useEffect(() => {
    if (!user) return;
    if (user.isAdmin || user.role === "admin") {
      navigate("/admin", { replace: true });
    } else if (user.role === "alumni") {
      navigate("/alumni", { replace: true });
    } else if (user.role === "organization") {
      navigate("/organization", { replace: true });
    } else if (user.role === "student") {
      navigate("/student", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
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
      } catch {
        // Not a student — try admin/org
      }
      if (!isStudent) {
        await login(email, password);
      }
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error?.message ?? "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  /* =======================
     Forgot password submit
  ======================= */
  const handleForgotSubmit = async (e: React.FormEvent) => {
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
      // Find student by email
      const { data: student, error: studentErr } = await supabase
        .from("students")
        .select("id")
        .eq("email", fpEmail.trim().toLowerCase())
        .maybeSingle();

      if (studentErr) throw studentErr;
      if (!student) {
        toast.error("No student account found with that email.");
        setFpLoading(false);
        return;
      }

      // Check for existing pending request
      const { data: existing } = await supabase
        .from("password_resets")
        .select("id,status")
        .eq("student_id", student.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        toast.info(
          "You already have a pending reset request. Please wait for admin approval.",
        );
        setFpLoading(false);
        return;
      }

      // Insert new password reset request
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
      setShowForgot(false);
      setFpEmail("");
      setFpNewPassword("");
      setFpConfirm("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit reset request.");
    } finally {
      setFpLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setFpEmail("");
    setFpNewPassword("");
    setFpConfirm("");
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

            {/* Dev quick login */}
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={closeForgot}
          />

          {/* Modal */}
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

              {/* Info banner */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Your request will be reviewed by an admin. Once approved, your
                  password will be updated.
                </p>
              </div>

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Your student email</Label>
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
                      placeholder="New password (min 6 chars)"
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
                      placeholder="Repeat new password"
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
                  <Button type="submit" className="flex-1" disabled={fpLoading}>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Login;
