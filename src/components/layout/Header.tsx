// src/components/layout/Header.tsx
import { useAuth } from "@/contexts/AuthContext";
import {
  LogOut,
  FileText,
  User,
  LayoutDashboard,
  PlusSquare,
  Users,
  ChevronDown,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useState, useRef, useEffect } from "react";

// ─── Nav link helper ──────────────────────────────────────────────────────────

type NavLinkProps = {
  to: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
};

function NavLink({ to, icon: Icon, label, active }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={[
        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "text-foreground bg-muted"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {label}
    </Link>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const homeHref = user
    ? user.isAdmin
      ? "/admin"
      : user.role === "organization"
        ? "/organization"
        : "/student"
    : "/";

  const is = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const roleLabel = user
    ? user.isAdmin
      ? "Admin"
      : user.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : "Student"
    : "";

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-3 pb-2">
      {/* Floating pill container */}
      <div className="mx-auto max-w-screen-xl">
        <div className="flex h-12 items-center justify-between gap-4 rounded-2xl border border-border bg-card/90 backdrop-blur-xl px-3 shadow-sm">
          {/* ── Logo ── */}
          <Link to={homeHref} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight hidden sm:block">
              FormFlow
            </span>
          </Link>

          {/* ── Center nav ── */}
          {user && (
            <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
              {user.isAdmin ? (
                <>
                  <NavLink
                    to="/admin"
                    icon={LayoutDashboard}
                    label="Dashboard"
                    active={location.pathname === "/admin"}
                  />
                  <NavLink
                    to="/admin/students-semester"
                    icon={Users}
                    label="Students"
                    active={is("/admin/students-semester")}
                  />
                  <NavLink
                    to="/admin/semester-teachers"
                    icon={Users}
                    label="Teachers"
                    active={is("/admin/semester-teachers")}
                  />
                  <NavLink
                    to="/admin/alumni"
                    icon={Users}
                    label="Alumni"
                    active={is("/admin/alumni")}
                  />
                  <NavLink
                    to="/admin/target-groups"
                    icon={Users}
                    label="Target Groups"
                    active={is("/admin/target-groups")}
                  />
                  <NavLink
                    to="/admin/create-survey"
                    icon={PlusSquare}
                    label="Create Survey"
                    active={is("/admin/create-survey")}
                  />
                  <NavLink
                    to="/admin/org-requests"
                    icon={Users}
                    label="Organization Requests"
                    active={is("/admin/org-requests")}
                  />
                </>
              ) : (
                <NavLink
                  to={
                    user.role === "organization" ? "/organization" : "/student"
                  }
                  icon={LayoutDashboard}
                  label="Dashboard"
                  active
                />
              )}
            </nav>
          )}

          {/* ── Right section ── */}
          {user ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Notification bell */}
              <div className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted/60 transition-colors">
                <NotificationBell />
              </div>

              {/* User menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/60 transition-colors"
                >
                  {/* Avatar */}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <User className="h-3 w-3 text-primary" />
                  </div>

                  {/* Name + role */}
                  <div className="hidden sm:flex flex-col leading-none text-left">
                    <span className="text-xs font-semibold text-foreground">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {roleLabel}
                    </span>
                  </div>

                  <ChevronDown
                    className={[
                      "h-3 w-3 text-muted-foreground transition-transform duration-150 hidden sm:block",
                      menuOpen ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                    {/* User info row */}
                    <div className="px-3 py-2.5 border-b border-border">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {user.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {roleLabel}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-left"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
