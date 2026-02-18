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
    <div>
      <Header />
      <form onSubmit={handleSubmit}>
        <h1>
          {accountType === "organization"
            ? "Organization Sign up"
            : "Student Sign up"}
        </h1>

        {/* Name */}
        <div>
          <Label htmlFor="name">
            {accountType === "organization" ? "Organization Name" : "Full Name"}
          </Label>
          <div>
            <User />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={accountType === "organization" ? "MCPA" : "John Doe"}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <Label htmlFor="email">Email</Label>
          <div>
            <Mail />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>
        </div>

        {/* Account Type */}
        <div>
          <Label htmlFor="accountType">Account Type</Label>
          <select
            id="accountType"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as UserRole)}
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
            <Label htmlFor="semester">Semester</Label>
            <select
              id="semester"
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
            {semesters.length === 0 && <p>Admin must create semesters first</p>}
          </div>
        )}

        {/* Password */}
        <div>
          <Label htmlFor="password">Password</Label>
          <div>
            <Lock />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              Creating...
            </>
          ) : (
            "Create Account"
          )}
        </Button>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default Signup;
