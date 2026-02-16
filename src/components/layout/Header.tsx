import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, FileText, User, LayoutDashboard, PlusSquare, Users, Building2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/layout/NotificationBell';

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link
          to={
            user
              ? user.isAdmin
                ? "/admin"
                : user.role === "organization"
                  ? "/organization"
                  : "/student"
              : "/"
          }
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-foreground">FormFlow</span>
        </Link>

        {/* Center nav (desktop) */}
        {user && (
          <nav className="hidden items-center gap-6 md:flex">
            {user.isAdmin ? (
              <>
                <Link
                  to="/admin"
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/admin/students-semester"
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <Users className="h-4 w-4" />
                  Students
                </Link>
                <Link
                  to="/admin/semester-teachers"
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <Users className="h-4 w-4" />
                  Teachers
                </Link>
                <Link
                  to="/admin/organizations"
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <Building2 className="h-4 w-4" />
                  Organization
                </Link>
                <Link
                  to="/admin/create-survey"
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <PlusSquare className="h-4 w-4" />
                  Create Survey
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={user.role === "organization" ? "/organization" : "/student"}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </>
            )}
          </nav>
        )}

        {/* Right section */}
        {user ? (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user.isAdmin
                    ? "Admin"
                    : user.role
                      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                      : "Student"}
                </span>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Logout</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
