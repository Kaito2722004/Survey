import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SurveyProvider } from "@/contexts/SurveyContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useLocation } from "react-router-dom";

import Index from "./pages/public/Index";
import Login from "./pages/public/Login";
import Signup from "./pages/public/Signup";
import NotFound from "./pages/public/NotFound";
import ResetPassword from "./pages/public/ResetPassword";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSemesterTeachers from "./pages/admin/AdminSemesterTeachers";
import AdminStudentsSemester from "./pages/admin/AdminStudentsSemester";
import AdminCreateSurvey from "./pages/admin/AdminCreateSurvey";
import AdminSurveyResponses from "./pages/admin/AdminSurveyResponses";
import AdminSurveys from "./pages/admin/AdminSurveys";
import SurveyEditor from "./pages/admin/SurveyEditor";
import AdminAlumni from "./pages/admin/AdminAlumni";
import AdminSurveyAnalytics from "./pages/admin/AdminSurveyAnalytics";
import AdminGeneralChart from "@/components/charts/AdminGeneralChart";
import AdminPasswordResets from "./pages/admin/AdminPasswordResets";
import AdminOrganizationRequests from "./pages/admin/AdminOrganizationRequests";

import StudentDashboard from "./pages/student/StudentDashboard";
import StudentSurveyTaker from "./pages/student/StudentSurveyTaker";

import AlumniDashboard from "./pages/alumni/AlumniDashboard";
import AlumniSurveyTaker from "./pages/alumni/AlumniSurveyTaker";

import OrganizationDashboard from "./pages/organization/OrganizationDashboard";
import AdminTargetGroups from "./pages/admin/AdminTargetGroups";
import AdminOrgTargetManager from "./pages/admin/AdminOrgTargetManager";
import AdminUsers from "./pages/admin/AdminUsers";

const queryClient = new QueryClient();

// Show floating theme toggle on public pages that don't use the sidebar Header
const PUBLIC_PATHS = ["/", "/login", "/signup", "/reset-password"];
function ThemeToggleFloating() {
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.includes(location.pathname);
  if (!isPublic) return null;
  return (
    <div className="fixed top-4 right-4 z-50 md:top-5 md:right-5">
      <ThemeToggle className="shadow-lg" />
    </div>
  );
}

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin)
    return (
      <Navigate
        to={user.role === "organization" ? "/organization" : "/student"}
        replace
      />
    );
  return <>{children}</>;
};

const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.role !== "student") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const OrganizationRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.role !== "organization") return <Navigate to="/student" replace />;
  return <>{children}</>;
};

const NonAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

// ✅ Allows both profiles with role="alumni" AND students with is_alumni=true
const AlumniRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "alumni") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ✅ RoleRedirect: alumni → /alumni
const RoleRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.role === "alumni") return <Navigate to="/alumni" replace />;
  if (user.role === "organization")
    return <Navigate to="/organization" replace />;
  return <Navigate to="/student" replace />;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/reset-password" element={<ResetPassword />} />

    {/* Role redirect */}
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <RoleRedirect />
        </ProtectedRoute>
      }
    />

    {/* Admin */}
    <Route
      path="/admin"
      element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/semester-teachers"
      element={
        <AdminRoute>
          <AdminSemesterTeachers />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/students-semester"
      element={
        <AdminRoute>
          <AdminStudentsSemester />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/org-requests"
      element={
        <AdminRoute>
          <AdminOrganizationRequests />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/password-resets"
      element={
        <AdminRoute>
          <AdminPasswordResets />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/create-survey"
      element={
        <AdminRoute>
          <AdminCreateSurvey />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/surveys"
      element={
        <AdminRoute>
          <AdminSurveys />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/surveys/:surveyId/edit"
      element={
        <AdminRoute>
          <SurveyEditor />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/surveys/:surveyId/responses"
      element={
        <AdminRoute>
          <AdminSurveyResponses />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/alumni"
      element={
        <AdminRoute>
          <AdminAlumni />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/surveys/:surveyId/analytics"
      element={
        <AdminRoute>
          <AdminSurveyAnalytics />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/surveys/:surveyId/general-chart"
      element={
        <AdminRoute>
          <AdminGeneralChart />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/target-groups"
      element={
        <AdminRoute>
          <AdminTargetGroups />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/target-groups/manage"
      element={
        <AdminRoute>
          <AdminOrgTargetManager />
        </AdminRoute>
      }
    />
    <Route path="/admin/users" element={<AdminUsers />} />

    {/* Student */}
    <Route
      path="/student"
      element={
        <StudentRoute>
          <StudentDashboard />
        </StudentRoute>
      }
    />
    <Route
      path="/student/survey/:id"
      element={
        <NonAdminRoute>
          <StudentSurveyTaker />
        </NonAdminRoute>
      }
    />

    {/* Organization */}
    <Route
      path="/organization"
      element={
        <OrganizationRoute>
          <OrganizationDashboard />
        </OrganizationRoute>
      }
    />

    {/* Alumni */}
    <Route
      path="/alumni"
      element={
        <AlumniRoute>
          <AlumniDashboard />
        </AlumniRoute>
      }
    />
    <Route
      path="/alumni/survey/:id"
      element={
        <AlumniRoute>
          <AlumniSurveyTaker />
        </AlumniRoute>
      }
    />

    {/* Legacy redirect */}
    <Route
      path="/survey/:id"
      element={
        <ProtectedRoute>
          <Navigate to="/dashboard" replace />
        </ProtectedRoute>
      }
    />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider>
          <ThemeToggleFloating />
          <AuthProvider>
            <SurveyProvider>
              <NotificationsProvider>
                <AppRoutes />
              </NotificationsProvider>
            </SurveyProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
