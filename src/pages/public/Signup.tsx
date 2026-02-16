import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User } from "lucide-react";
import type { UserRole } from "@/contexts/AuthContext";

type Semester = {
  id: string;
  name: string;
};

const ACCOUNT_TYPES: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "organization", label: "Organization" },
];

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<UserRole>("student");
  const [semesterId, setSemesterId] = useState("");

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  // Load semesters created by admin
  useEffect(() => {
    const loadSemesters = async () => {
      const { data, error } = await supabase
        .from("semesters")
        .select("id, name")
        .order("created_at");

      if (error) {
        toast.error(error.message);
        return;
      }
      setSemesters(data ?? []);
    };

    loadSemesters();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (accountType === "student" && !semesterId) {
      toast.error("Please select a semester");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      await signup(
        email,
        password,
        name,
        accountType,
        accountType === "student" ? semesterId : undefined,
      );

      toast.success("Account created. Check your email to confirm.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-card p-8 shadow-sm">
            <h1 className="mb-6 text-center text-2xl font-semibold">
              {accountType === "organization"
                ? "Organization Sign up"
                : "Student Sign up"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <Label>
                  {accountType === "organization"
                    ? "Organization Name"
                    : "Full Name"}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      accountType === "organization" ? "MCPA" : "John Doe"
                    }
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </div>
              </div>

              {/* Account Type */}
              <div>
                <Label>Account Type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(e.target.value as UserRole)
                  }
                >
                  {ACCOUNT_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester — only for Student */}
              {accountType === "student" && (
                <div>
                  <Label>Semester</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={semesterId}
                    onChange={(e) => setSemesterId(e.target.value)}
                  >
                    <option value="">-- Select Semester --</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  {semesters.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Admin must create semesters first
                    </p>
                  )}
                </div>
              )}

              {/* Password */}
              <div>
                <Label>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary underline">
                Login
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Signup;
