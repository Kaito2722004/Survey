import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, CheckCircle2 } from "lucide-react";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);

      // Check if email already requested or exists
      const { data: existing } = await supabase
        .from("organization_requests")
        .select("id, status")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        if (existing.status === "pending") {
          toast.error("A request with this email is already pending approval.");
        } else if (existing.status === "approved") {
          toast.error("This email is already approved. Try logging in.");
        } else {
          toast.error("This email was rejected. Contact admin.");
        }
        return;
      }

      // Insert pending request — store plain password (admin will use it to create auth account)
      // In production, consider a more secure handoff mechanism
      const { error } = await supabase.from("organization_requests").insert({
        name,
        email,
        password_hash: password, // admin will use this when creating the account
        status: "pending",
      });

      if (error) throw error;

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message ?? "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
          <div className="w-full max-w-md animate-slide-up">
            <div className="card-elevated p-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-foreground">
                Request Submitted
              </h1>
              <p className="text-muted-foreground">
                Your organization account request has been submitted. An admin
                will review and approve it shortly. You'll receive a
                confirmation email once approved.
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="card-elevated p-8">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-2xl font-semibold text-foreground">
                Organization Sign Up
              </h1>
              <p className="text-sm text-muted-foreground">
                Submit a request to create an organization account. An admin
                will review and approve it.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Organization Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. MCPA"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="org@example.com"
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
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
