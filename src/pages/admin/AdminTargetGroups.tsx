import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

type TargetGroupRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export default function AdminTargetGroups() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<TargetGroupRow[]>([]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("target_groups")
        .select("id,name,description,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups(data ?? []);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? "Failed to load target groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <div className="min-h-screen bg-background md:pl-56">
      <Header />

      <main className="container py-8 space-y-6">
        {/* Page header + BUTTON */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Target Groups</h1>
            <p className="text-muted-foreground mt-1">
              Overview of all target groups in the system
            </p>
          </div>

          {/* ✅ THIS IS THE BUTTON YOU WERE LOOKING FOR */}
          <Button asChild>
            <Link to="/admin/target-groups/manage">Manage Target Groups</Link>
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading target groups…
          </div>
        ) : groups.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-8 w-8 opacity-60" />
            No target groups created yet.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.id} className="p-5 space-y-2">
                <div className="font-semibold">{g.name}</div>
                {g.description && (
                  <div className="text-sm text-muted-foreground">
                    {g.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Created: {new Date(g.created_at).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
