import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SurveyProvider } from "@/contexts/SurveyContext";

import Index from "./pages/public/Index";
import Login from "./pages/public/Login";
import Signup from "./pages/public/Signup";
import NotFound from "./pages/public/NotFound";


// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSemesterTeachers from "./pages/admin/AdminSemesterTeachers";
import AdminStudentsSemester from "./pages/admin/AdminStudentsSemester";
import AdminCreateSurvey from "./pages/admin/AdminCreateSurvey";
import AdminSurveyResponses from "./pages/admin/AdminSurveyResponses";
import AdminSurveys from "@/pages/admin/AdminSurveys";

// Existing shared pages you already have
import SurveyEditor from "./pages/admin/SurveyEditor";
import SurveyResponses from "./pages/admin/AdminSurveyResponses"; // (if you still use it)

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentSurveyTaker from "./pages/student/StudentSurveyTaker";

const queryClient = new QueryClient();  

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
  if (!user.isAdmin) return <Navigate to="/student" replace />;
  return <>{children}</>;
};

const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

// Redirect logged-in user to correct home
const RoleRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.isAdmin ? "/admin" : "/student"} replace />;
};

const AppRoutes = () => (
  <Routes>
    {/* AdminSurvey */}
    <Route path="/admin/surveys" element={<AdminSurveys />} />
    <Route path="/admin/surveys/:surveyId/edit" element={<SurveyEditor />} />
<Route path="/admin/surveys/:surveyId/responses" element={<AdminSurveyResponses />} />
<Route path="/admin/surveys" element={<AdminSurveys />} />

   <Route path="/signup" element={<Signup />} />

     
    {/* Public */}
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />

    {/* If someone visits /dashboard, send to correct role home */}
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
      path="/admin/create-survey"
      element={
        <AdminRoute>
          <AdminCreateSurvey />
        </AdminRoute>
      }
    />

    {/* Admin survey edit + responses */}
    <Route
      path="/admin/survey/:id/edit"
      element={
        <AdminRoute>
          <SurveyEditor />
        </AdminRoute>
      }
    />
    <Route
      path="/admin/survey/:id/responses"
      element={
        <AdminRoute>
          {/* Use your new AdminSurveyResponses page if you want */}
          <AdminSurveyResponses />
        </AdminRoute>
      }
    />

    {/* If you still want to keep your old /survey/:id/edit routes for compatibility */}
    <Route
      path="/survey/:id/edit"
      element={
        <AdminRoute>
          <SurveyEditor />
        </AdminRoute>
      }
    />
    <Route
      path="/survey/:id/responses"
      element={
        <AdminRoute>
          <SurveyResponses />
        </AdminRoute>
      }
    />

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
        <StudentRoute>
          <StudentSurveyTaker />
        </StudentRoute>
      }
    />

    {/* If student hits old /survey/:id, redirect to /student/survey/:id */}
    <Route
      path="/survey/:id"
      element={
        <ProtectedRoute>
          <Navigate to="/student" replace />
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
        <AuthProvider>
          <SurveyProvider>
            <AppRoutes />
          </SurveyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
