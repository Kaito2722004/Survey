// src/pages/admin/AdminDashboard.tsx
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { notificationsService } from "@/services/notifications";
import { surveysService } from "@/services/surveys";
import {
  Users,
  BookOpen,
  GraduationCap,
  Building2,
  PlusCircle,
  LayoutList,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

// ─── Nav card config ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    step: 1,
    title: "Students → Semester",
    description:
      "Assign each student to a semester so semester-scoped surveys are enforced correctly.",
    icon: Users,
    route: "/admin/students-semester",
    label: "Manage Students",
  },
  {
    step: 2,
    title: "Semester → Teachers",
    description:
      "Select a semester and add teachers that belong to it. A teacher can appear in multiple semesters.",
    icon: BookOpen,
    route: "/admin/semester-teachers",
    label: "Manage Semester Teachers",
  },
  {
    step: 3,
    title: "Alumni",
    description: "Manage alumni accounts — view, promote, and control access.",
    icon: GraduationCap,
    route: "/admin/alumni",
    label: "Manage Alumni",
  },
  {
    step: 4,
    title: "Target Groups",
    description:
      "Create target groups, add members by user or email, and assign organizations to unassigned users.",
    icon: Building2,
    route: "/admin/target-groups",
    label: "Manage Target Groups",
  },
  {
    step: 5,
    title: "Create Survey",
    description:
      "Create a Semester + Teacher survey, General school-wide survey, Organization, or Alumni survey.",
    icon: PlusCircle,
    route: "/admin/create-survey",
    label: "Create Survey",
    highlight: true,
  },
  {
    step: 6,
    title: "View Surveys",
    description:
      "See all surveys you created, edit questions, view responses, and review analytics charts.",
    icon: LayoutList,
    route: "/admin/surveys",
    label: "View Surveys",
    highlight: true,
  },
  {
    step: 7,
    title: "Users & Roles",
    description:
      "View all users and assign roles (fix role = NULL), separated by Student / Alumni / Organization.",
    icon: ShieldCheck,
    route: "/admin/users",
    label: "Manage Users",
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

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
          (s) => s.deadline && new Date(s.deadline) < new Date(),
        );
        await notificationsService.ensureAdminNotifications(
          user.id,
          pastDeadline.map((s) => ({
            id: s.id,
            title: s.title,
            deadline: s.deadline,
          })),
        );
        refetchNotifications();
      } catch (e) {
        console.error("Ensure admin notifications:", e);
        toast.error(
          "Notifications could not be created. Run the SQL in supabase-notification-insert-policy.sql in your Supabase SQL Editor.",
        );
      }
    };
    run();
  }, [user?.id, refetchNotifications]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-10 space-y-8">
        {/* ── Page header ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Admin
          </p>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up semesters and teachers, then create and manage surveys.
          </p>
        </div>

        {/* ── Nav grid ── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_ITEMS.map(
            ({
              step,
              title,
              description,
              icon: Icon,
              route,
              label,
              highlight,
            }) => (
              <button
                key={step}
                onClick={() => navigate(route)}
                className={[
                  "group relative text-left rounded-xl border bg-card p-5 transition-all duration-200",
                  "hover:border-primary/30 hover:bg-card/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  highlight ? "border-primary/20" : "border-border",
                ].join(" ")}
              >
                {/* Highlight accent */}
                {highlight && (
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary/60 ml-px" />
                )}

                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="flex-1 min-w-0">
                    {/* Icon + step */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={[
                          "flex items-center justify-center w-8 h-8 rounded-lg",
                          highlight ? "bg-primary/10" : "bg-muted",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-4 w-4",
                            highlight
                              ? "text-primary"
                              : "text-muted-foreground",
                          ].join(" ")}
                        />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        Step {step}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="font-semibold text-foreground text-[15px] leading-snug mb-1.5">
                      {title}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {description}
                    </p>

                    {/* CTA label */}
                    <div
                      className={[
                        "inline-flex items-center gap-1 mt-4 text-xs font-semibold transition-colors",
                        highlight
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      ].join(" ")}
                    >
                      {label}
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </button>
            ),
          )}
        </div>
      </main>
    </div>
  );
}
