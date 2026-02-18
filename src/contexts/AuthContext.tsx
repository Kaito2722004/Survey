/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import { semesterStudentsService } from "@/services/semesterStudents";

export type UserRole =
  | "admin"
  | "student"
  | "alumni"
  | "teacher"
  | "stakeholder"
  | "organization";

type AppUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  role: UserRole;
  semesterId: string | null;
};

type AuthContextType = {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    semesterId?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type SessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

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

async function buildAppUser(sessionUser: SessionUser): Promise<AppUser> {
  const meta = sessionUser.user_metadata ?? {};

  const metaName = typeof meta["name"] === "string" ? meta["name"] : undefined;
  const metaRole =
    typeof meta["role"] === "string" ? (meta["role"] as UserRole) : undefined;
  const metaSemesterId =
    typeof meta["semester_id"] === "string" ? meta["semester_id"] : undefined;

  // Get or create profile
  const profile = await profilesService.getByUserId(sessionUser.id);
  const ensured =
    profile ??
    (await profilesService.create({
      user_id: sessionUser.id,
      email: sessionUser.email ?? "",
      name: metaName ?? sessionUser.email?.split("@")[0] ?? "User",
      is_admin: false,
      role: metaRole ?? "student",
    } as any));

  // Sync profile role with auth metadata role if they differ
  if (!ensured.is_admin && metaRole && (ensured as any).role !== metaRole) {
    try {
      const updated = await profilesService.updateByUserId(sessionUser.id, {
        role: metaRole,
      });
      (ensured as any).role = updated.role;
    } catch (e) {
      console.error("Failed to sync role:", e);
    }
  }

  const role: UserRole = ensured.is_admin
    ? "admin"
    : ((metaRole ?? (ensured as any).role ?? "student") as UserRole);

  // Auto-link student to semester if not already linked
  let studentLink =
    role === "student"
      ? await semesterStudentsService.getByStudent(sessionUser.id)
      : null;

  if (
    !ensured.is_admin &&
    role === "student" &&
    !studentLink &&
    metaSemesterId
  ) {
    try {
      studentLink = await semesterStudentsService.upsertStudentSemester(
        metaSemesterId,
        sessionUser.id,
      );
    } catch (e) {
      console.error("Auto semester link failed:", e);
    }
  }

  return {
    id: sessionUser.id,
    email: ensured.email ?? sessionUser.email ?? "",
    name: ensured.name ?? sessionUser.email?.split("@")[0] ?? "User",
    isAdmin: !!ensured.is_admin,
    role,
    semesterId: role === "student" ? (studentLink?.semester_id ?? null) : null,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

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
        setUser(null);
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
        throw new Error(
          "Session expired. Please refresh the page and login again.",
        );
      }
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        throw new Error("Please confirm your email first (check your inbox).");
      }
      throw new Error(error.message);
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    semesterId?: string,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name,
          role,
          ...(role === "student" && semesterId
            ? { semester_id: semesterId }
            : {}),
        },
      },
    });

    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    clearSupabaseAuthStorage();
    setUser(null);
    if (error) throw new Error(error.message);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
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
