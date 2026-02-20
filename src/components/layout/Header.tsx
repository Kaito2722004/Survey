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
  Menu,
  X,
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
  onClick?: () => void;
};

function NavLink({ to, icon: Icon, label, active, onClick }: NavLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={[
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active
          ? "text-foreground bg-primary/10 border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      ].join(" ")}
    >
      <Icon
        className={["h-4 w-4 flex-shrink-0", active ? "text-primary" : ""].join(
          " ",
        )}
      />
      <span>{label}</span>
    </Link>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

type SidebarContentProps = {
  onClose?: () => void;
};

function SidebarContent({ onClose }: SidebarContentProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setMenuOpen(false);
    onClose?.();
    await logout();
    navigate("/");
  };

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
    <div className="flex flex-col h-full">
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-border">
        <Link
          to={homeHref}
          onClick={onClose}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-sm">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">
            FormFlow
          </span>
        </Link>

        {/* Close button (mobile only) */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {user ? (
          user.isAdmin ? (
            <>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Main
              </p>
              <NavLink
                to="/admin"
                icon={LayoutDashboard}
                label="Dashboard"
                active={location.pathname === "/admin"}
                onClick={onClose}
              />
              <NavLink
                to="/admin/surveys"
                icon={FileText}
                label="Surveys"
                active={is("/admin/surveys")}
                onClick={onClose}
              />
              <NavLink
                to="/admin/create-survey"
                icon={PlusSquare}
                label="Create Survey"
                active={is("/admin/create-survey")}
                onClick={onClose}
              />

              <p className="px-3 mt-5 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Manage
              </p>
              <NavLink
                to="/admin/students-semester"
                icon={Users}
                label="Students"
                active={is("/admin/students-semester")}
                onClick={onClose}
              />
              <NavLink
                to="/admin/semester-teachers"
                icon={Users}
                label="Teachers"
                active={is("/admin/semester-teachers")}
                onClick={onClose}
              />
              <NavLink
                to="/admin/alumni"
                icon={Users}
                label="Alumni"
                active={is("/admin/alumni")}
                onClick={onClose}
              />
              <NavLink
                to="/admin/target-groups"
                icon={Users}
                label="Target Groups"
                active={is("/admin/target-groups")}
                onClick={onClose}
              />
              <NavLink
                to="/admin/org-requests"
                icon={Users}
                label="Org Requests"
                active={is("/admin/org-requests")}
                onClick={onClose}
              />
            </>
          ) : (
            <NavLink
              to={user.role === "organization" ? "/organization" : "/student"}
              icon={LayoutDashboard}
              label="Dashboard"
              active
              onClick={onClose}
            />
          )
        ) : null}
      </nav>

      {/* ── Bottom user section ── */}
      <div className="border-t border-border px-3 py-3">
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 flex flex-col leading-none text-left min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {roleLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <NotificationBell />
                <ChevronDown
                  className={[
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                    menuOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </div>
            </button>

            {/* Popup menu */}
            {menuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {roleLabel}
                  </div>
                </div>
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
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              to="/login"
              className="w-full text-center px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="w-full text-center px-3 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Header/Sidebar component ───────────────────────────────────────────

export const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col border-r border-border bg-card/95 backdrop-blur-xl z-50">
        <SidebarContent />
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden sticky top-0 z-50 flex h-12 items-center justify-between gap-4 border-b border-border bg-card/90 backdrop-blur-xl px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">
            FormFlow
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="md:hidden fixed left-0 top-0 h-screen w-64 z-50 bg-card border-r border-border flex flex-col animate-in slide-in-from-left duration-200">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      {/* ── Desktop content offset ── */}
      {/* Add this class to your root layout: md:pl-56 */}
    </>
  );
};
