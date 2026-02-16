/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import { semesterStudentsService } from "@/services/semesterStudents";

type UserRole = "admin" | "student" | "alumni" | "teacher" | "stakeholder";

type AppUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  role: UserRole; // ✅ NEW
  semesterId: string | null; // for student
};

type AuthContextType = {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    semesterId: string,
    role: UserRole,
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
  const msg = getErrorMessage(err).toLowerCase();
  return msg.includes("abort");
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

async function buildAppUser(sessionUser: SessionUser) {
  const metaName =
    sessionUser.user_metadata &&
    typeof sessionUser.user_metadata["name"] === "string"
      ? (sessionUser.user_metadata["name"] as string)
      : undefined;

  // Also check role from metadata for auto-linking (only if not admin and no existing link)
  const metaRole =
    sessionUser.user_metadata &&
    typeof sessionUser.user_metadata["role"] === "string"
      ? (sessionUser.user_metadata["role"] as UserRole)
      : undefined;

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

    // ✅ Sync profile.role with auth metadata role (fixes old users stuck as "student")
  if (!ensured.is_admin && metaRole && (ensured as any).role !== metaRole) {
    try {
      const updated = await profilesService.updateByUserId(sessionUser.id, {
        role: metaRole,
      });
      (ensured as any).role = updated.role; // keep local ensured in sync
    } catch (e) {
      console.error("Failed to sync role:", e);
    }
  }


  // Student semester (only one)
  let studentLink = await semesterStudentsService.getByStudent(sessionUser.id);

  // If student picked semester during signup, auto-link on first login
  const metaSemesterId =
    sessionUser.user_metadata &&
    typeof sessionUser.user_metadata["semester_id"] === "string"
      ? (sessionUser.user_metadata["semester_id"] as string)
      : undefined;


  if (!ensured.is_admin && !studentLink && metaSemesterId) {
    try {
      studentLink = await semesterStudentsService.upsertStudentSemester(
        metaSemesterId,
        sessionUser.id,
      );
    } catch (e: unknown) {
      console.error("Auto semester link failed:", e);
    }
  }

  const roleFromProfile =
    typeof (ensured as any).role === "string" ? (ensured as any).role : undefined;

  const role: UserRole = ensured.is_admin
    ? "admin"
    : (roleFromProfile as UserRole) ?? "student";

  const appUser: AppUser = {
    id: sessionUser.id,
    email: ensured.email ?? sessionUser.email ?? "",
    name: ensured.name ?? sessionUser.email?.split("@")[0] ?? "User",
    isAdmin: !!ensured.is_admin,
    role, // ✅ add this
    semesterId: role === "student" ? studentLink?.semester_id ?? null : null,
  };


  return appUser;
}

function toQuickUser(session: {
  user: { id: string; email?: string | null };
}): AppUser {
  const email = session.user.email ?? "";
  return {
    id: session.user.id,
    email,
    name: email ? email.split("@")[0] : "User",
    isAdmin: false,
    role: "student",
    semesterId: null,
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
          if (!alive) return;
          setUser(u);
        })
        .catch((e) => {
          if (isAbortError(e)) return;
          console.error("buildAppUser error:", e);
        })
        .finally(() => {
          if (alive) setIsLoading(false); // ✅ Only stop loading after full user is built
        });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!alive) return;
        if (session?.user) {
          setIsLoading(true); // ✅ Keep loading state
          loadFullUserInBackground(session);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      } catch (e: unknown) {
        // ... error handling
        if (alive) setIsLoading(false);
      }
    });

    // Initial session load
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          // ... error handling
          return;
        }
        const session = data?.session;
        if (session?.user) {
          loadFullUserInBackground(session);
        } else {
          if (alive) {
            setUser(null);
            setIsLoading(false);
          }
        }
      } catch (e: unknown) {
        // ... error handling
      }
    })();

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    // ✅ Clear any broken session FIRST (prevents refresh-token loops)
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
      const msg = error.message?.toLowerCase();

      if (isRefreshTokenProblem(error)) {
        clearSupabaseAuthStorage();
        await supabase.auth.signOut();
        throw new Error(
          "Session expired. Please refresh the page and login again.",
        );
      }

      if (msg?.includes("email not confirmed")) {
        throw new Error("Please confirm your email first (check your inbox).");
      }

      throw new Error(error.message);
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    semesterId: string,
    role: UserRole,
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name,
          semester_id: semesterId,
          role, // ✅ store role in metadata for auto-linking on login
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
