import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { notificationsService } from "@/services/notifications";
import { surveysService } from "@/services/surveys";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchNotifications } = useNotifications();

  useEffect(() => {
    if (!user?.id) return;

    const run = async () => {
      try {
        const mySurveys = await surveysService.getByAdminUser(user.id);
        const pastDeadline = mySurveys.filter(
          (s) => s.deadline && new Date(s.deadline) < new Date()
        );
        await notificationsService.ensureAdminNotifications(
          user.id,
          pastDeadline.map((s) => ({ id: s.id, title: s.title, deadline: s.deadline }))
        );
        refetchNotifications();
      } catch (e) {
        console.error("Ensure admin notifications:", e);
        toast.error(
          "Notifications could not be created. Run the SQL in supabase-notification-insert-policy.sql in your Supabase SQL Editor."
        );
      }
    };

    run();
  }, [user?.id, refetchNotifications]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Setup semesters/teachers, then create surveys.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>div]:flex [&>div]:flex-col [&>div]:min-h-0">
          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold">1) Students → Semester</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Assign each student to a semester (so “students in same semester
              only” is enforced).
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/admin/students-semester")}
            >
              Manage Students
            </Button>
          </div>

          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold">2) Semester → Teachers</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Select a semester and add teachers that belong to it (same teacher
              can be in multiple sem).
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/admin/semester-teachers")}
            >
              Manage Semester Teachers
            </Button>
          </div>

          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold">3) Organization</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Surveys for organization accounts. Set target_role to Organization when creating surveys; organization users see them on their dashboard.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/admin/organizations")}
            >
              Manage Organizations
            </Button>
          </div>

          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold">4) Create Survey</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Create either a Semester + Teacher survey, or a General
              (school-wide) survey.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/admin/create-survey")}
            >
              Create Survey
            </Button>
          </div>

          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold">5) View Surveys</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              See all surveys you created, edit questions, and view responses.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/admin/surveys")}
            >
              View Surveys
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
