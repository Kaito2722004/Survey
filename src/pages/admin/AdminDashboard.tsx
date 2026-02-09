import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold">1) Students → Semester</h3>
            <p className="mt-2 text-sm text-muted-foreground">
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
            <p className="mt-2 text-sm text-muted-foreground">
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
            <h3 className="text-lg font-semibold">3) Create Survey</h3>
            <p className="mt-2 text-sm text-muted-foreground">
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
            <h3 className="text-lg font-semibold">4) View Surveys</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              See all surveys you created, edit questions, and view responses.
            </p>
            <Button
              className="mt-4"
              variant="outline"
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
