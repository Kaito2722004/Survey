import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, studentLogin, user } = useAuth();
  const navigate = useNavigate();

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
      // 1. Try student first (public.students table)
      let isStudent = false;
      try {
        await studentLogin(email, password);
        isStudent = true;
      } catch {
        // Not a student — try admin
      }

      if (!isStudent) {
        // 2. Try admin (Supabase auth)
        await login(email, password);
      }

      toast.success("Welcome back!");
      // useEffect handles redirect
    } catch (error: any) {
      toast.error(error?.message ?? "Invalid email or password");
    } finally {
      setIsLoading(false);
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
                <Label htmlFor="password">Password</Label>
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

            {/* Dev seed helper — remove before production */}
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
    </div>
  );
};

export default Login;
