// src/contexts/AuthContext.tsx
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";

export type UserRole =
  | "admin"
  | "student"
  | "alumni"
  | "teacher"
  | "stakeholder"
  | "organization";

// ─── Student row from public.students ────────────────────────────────────────
type StudentRow = {
  id: string;
  student_id: string;
  student_number: string;
  name: string;
  email: string;
  section_id: string;
  is_answered_survey: boolean;
  is_alumni: boolean; // ← add this
  alumni_group_id: string | null; // ← optional but good to have
};

// ─── App User ─────────────────────────────────────────────────────────────────
type AppUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  role: UserRole | null;
  sectionId: string | null;
  studentRow: StudentRow | null;
};

type AuthContextType = {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  studentLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (
    studentId: string,
    newPassword: string,
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const maybeMsg = (err as { message?: unknown }).message;
    if (typeof maybeMsg === "string") return maybeMsg;
  }
  return String(err ?? "");
}

function isAbortError(err: unknown) {
  return getErrorMessage(err).toLowerCase().includes("abort");
}

function isRefreshTokenProblem(err: unknown) {
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes("refresh token") ||
    msg.includes("invalid refresh token") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("not found")
  );
}

function clearSupabaseAuthStorage() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("sb-") || k.toLowerCase().includes("supabase")) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

// ─── Student session (localStorage) ──────────────────────────────────────────
const STUDENT_SESSION_KEY = "uit_student_session";

function saveStudentSession(student: StudentRow) {
  localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(student));
}

function loadStudentSession(): StudentRow | null {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StudentRow) : null;
  } catch {
    return null;
  }
}

function clearStudentSession() {
  localStorage.removeItem(STUDENT_SESSION_KEY);
}

function studentRowToAppUser(student: StudentRow): AppUser {
  return {
    id: student.id,
    email: student.email,
    name: student.name,
    isAdmin: false,
    role: student.is_alumni ? "alumni" : "student", // ← check is_alumni

    sectionId: student.section_id,
    studentRow: student,
  };
}

// ─── Build admin/portal AppUser from Supabase session ────────────────────────
type SessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

async function buildAppUser(sessionUser: SessionUser): Promise<AppUser> {
  const meta = sessionUser.user_metadata ?? {};
  const metaName = typeof meta["name"] === "string" ? meta["name"] : undefined;
  const metaRole =
    typeof meta["role"] === "string" ? (meta["role"] as UserRole) : undefined;

  const profile = await profilesService.getByUserId(sessionUser.id);

  const ensured =
    profile ??
    (await profilesService.create({
      user_id: sessionUser.id,
      email: sessionUser.email ?? "",
      name: metaName ?? sessionUser.email?.split("@")[0] ?? "User",
      is_admin: false,
      ...(metaRole ? { role: metaRole } : {}),
    }));

  const role: UserRole | null = ensured.is_admin
    ? "admin"
    : (ensured.role as UserRole | null);

  return {
    id: sessionUser.id,
    email: ensured.email ?? sessionUser.email ?? "",
    name: ensured.name ?? sessionUser.email?.split("@")[0] ?? "User",
    isAdmin: !!ensured.is_admin,
    role,
    sectionId: null,
    studentRow: null,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // 1. Check student session first (no Supabase auth needed)
    const studentSession = loadStudentSession();
    if (studentSession) {
      setUser(studentRowToAppUser(studentSession));
      setIsLoading(false);
      return;
    }

    // 2. Otherwise check Supabase auth session (admin/portal)
    const loadFullUserInBackground = (session: any) => {
      buildAppUser({
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata as Record<string, unknown>,
      })
        .then((u) => {
          if (alive) setUser(u);
        })
        .catch((e) => {
          if (!isAbortError(e)) console.error("buildAppUser error:", e);
        })
        .finally(() => {
          if (alive) setIsLoading(false);
        });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return;
      if (session?.user) {
        setIsLoading(true);
        loadFullUserInBackground(session);
      } else {
        // Only clear user if not a student session
        if (!loadStudentSession()) {
          setUser(null);
        }
        setIsLoading(false);
      }
    });

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (alive) setIsLoading(false);
          return;
        }
        if (data?.session?.user) {
          loadFullUserInBackground(data.session);
        } else if (alive) {
          setUser(null);
          setIsLoading(false);
        }
      } catch (e) {
        console.error("getSession error:", e);
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Admin/portal login (Supabase auth) ───────────────────────────────────
  const login = async (email: string, password: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await supabase.auth.signOut();
        clearSupabaseAuthStorage();
      }
    } catch {
      clearSupabaseAuthStorage();
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (isRefreshTokenProblem(error)) {
        clearSupabaseAuthStorage();
        await supabase.auth.signOut();
        throw new Error("Session expired. Please refresh and login again.");
      }
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        throw new Error("Please confirm your email first (check your inbox).");
      }
      throw new Error(error.message);
    }
  };

  // ── Student login (checks public.students — no Supabase auth) ────────────
  const studentLogin = async (email: string, password: string) => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("email", email)
      .eq("password", password)
      .maybeSingle(); // ← maybeSingle so it returns null instead of 406

    if (error) throw new Error("Invalid email or password.");
    if (!data) throw new Error("Invalid email or password.");

    const student = data as StudentRow;
    saveStudentSession(student);
    setUser(studentRowToAppUser(student));
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    // Student session logout
    if (loadStudentSession()) {
      clearStudentSession();
      setUser(null);
      return;
    }

    // Admin/portal logout
    const { error } = await supabase.auth.signOut();
    clearSupabaseAuthStorage();
    setUser(null);
    if (error) throw new Error(error.message);
  };

  // ── Student password reset request ────────────────────────────────────────
  const requestPasswordReset = async (
    studentId: string,
    newPassword: string,
  ) => {
    const { error } = await supabase.from("password_resets").insert({
      student_id: studentId,
      new_password: newPassword,
      status: "pending",
    });

    if (error) throw new Error(error.message);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        studentLogin,
        logout,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const useUser = () => {
  const { user } = useAuth();
  return user;
};
