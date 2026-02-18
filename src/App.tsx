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
import AdminSurveys from "./pages/admin/AdminSurveys";
import SurveyEditor from "./pages/admin/SurveyEditor";
import AdminAlumni from "./pages/admin/AdminAlumni";



// ✅ charts-related
import AdminSurveyAnalytics from "./pages/admin/AdminSurveyAnalytics";
import AdminGeneralChart from "@/components/charts/AdminGeneralChart";

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentSurveyTaker from "./pages/student/StudentSurveyTaker";

// Alumni pages
import AlumniDashboard from "./pages/alumni/AlumniDashboard";
import AlumniSurveyTaker from "./pages/alumni/AlumniSurveyTaker";

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
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.role !== "student") return <Navigate to="/dashboard" replace />; // ✅ add this line
  return <>{children}</>;
};


const AlumniRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "alumni") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};


const RoleRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isAdmin) return <Navigate to="/admin" replace />;
  if (user.role === "alumni") return <Navigate to="/alumni" replace />;
  return <Navigate to="/student" replace />;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />

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
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    <Route path="/admin/semester-teachers" element={<AdminRoute><AdminSemesterTeachers /></AdminRoute>} />
    <Route path="/admin/students-semester" element={<AdminRoute><AdminStudentsSemester /></AdminRoute>} />
    <Route path="/admin/create-survey" element={<AdminRoute><AdminCreateSurvey /></AdminRoute>} />

    <Route path="/admin/surveys" element={<AdminRoute><AdminSurveys /></AdminRoute>} />
    <Route path="/admin/surveys/:surveyId/edit" element={<AdminRoute><SurveyEditor /></AdminRoute>} />
    <Route path="/admin/surveys/:surveyId/responses" element={<AdminRoute><AdminSurveyResponses /></AdminRoute>} />
    <Route path="/admin/alumni" element={<AdminRoute><AdminAlumni /></AdminRoute>} />

    {/* ✅ ONE route for analytics (it decides Sem+Teacher vs General) */}
    <Route
      path="/admin/surveys/:surveyId/analytics"
      element={
        <AdminRoute>
          <AdminSurveyAnalytics />
        </AdminRoute>
      }
    />

    {/* (Optional) keep this if you still want direct access to the general chart page */}
    <Route
      path="/admin/surveys/:surveyId/general-chart"
      element={
        <AdminRoute>
          <AdminGeneralChart />
        </AdminRoute>
      }
    />

    {/* Student */}
    <Route path="/student" element={<StudentRoute><StudentDashboard /></StudentRoute>} />
    <Route path="/student/survey/:id" element={<StudentRoute><StudentSurveyTaker /></StudentRoute>} />

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

    {/* Optional: if someone hits old /survey/:id, send to student dashboard */}
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