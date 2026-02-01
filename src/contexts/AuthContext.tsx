/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import { semesterStudentsService } from "@/services/semesterStudents";

type AppUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  semesterId: string | null; // for student
};

type AuthContextType = {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // ✅ semesterId added (4th argument)
  signup: (email: string, password: string, name: string, semesterId: string) => Promise<void>;
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

async function buildAppUser(sessionUser: SessionUser) {
  const metaName =
    sessionUser.user_metadata && typeof sessionUser.user_metadata["name"] === "string"
      ? (sessionUser.user_metadata["name"] as string)
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
    }));

  // Student semester (only one)
  let studentLink = await semesterStudentsService.getByStudent(sessionUser.id);

  // ✅ If student picked semester during signup, auto-link on first login
  const metaSemesterId =
    sessionUser.user_metadata && typeof sessionUser.user_metadata["semester_id"] === "string"
      ? (sessionUser.user_metadata["semester_id"] as string)
      : undefined;

  if (!ensured.is_admin && !studentLink && metaSemesterId) {
    try {
      studentLink = await semesterStudentsService.upsertStudentSemester(metaSemesterId, sessionUser.id);
    } catch (e: unknown) {
      console.error("Auto semester link failed:", e);
    }
  }

  const appUser: AppUser = {
    id: sessionUser.id,
    email: ensured.email ?? sessionUser.email ?? "",
    name: ensured.name ?? (sessionUser.email?.split("@")[0] ?? "User"),
    isAdmin: !!ensured.is_admin,
    semesterId: studentLink?.semester_id ?? null,
  };

  return appUser;
}

function clearSupabaseAuthStorage() {
  // Only remove supabase auth keys, don't nuke all localStorage
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

function isRefreshTokenProblem(err: unknown) {
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes("refresh token") ||
    msg.includes("invalid refresh token") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("not found") // supabase sometimes says "Refresh Token Not Found"
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1) Listen auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const u = await buildAppUser({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata as Record<string, unknown>,
          });
          setUser(u);
        } else {
          setUser(null);
        }
      } catch (e: unknown) {
        console.error("Auth state change error:", e);

        // If refresh token is broken, clear storage and fully reset auth
        if (isRefreshTokenProblem(e)) {
          try {
            clearSupabaseAuthStorage();
            await supabase.auth.signOut();
          } catch {
            // intentionally ignore: best-effort cleanup
          }
        }

        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    // 2) Initial session load
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          if (isRefreshTokenProblem(error)) {
            clearSupabaseAuthStorage();
            await supabase.auth.signOut();
          }
          setUser(null);
          return;
        }

        const session = data?.session;
        if (session?.user) {
          const u = await buildAppUser({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata as Record<string, unknown>,
          });
          setUser(u);
        } else {
          setUser(null);
        }
      } catch (e: unknown) {
        console.error("Initial session load error:", e);

        if (isRefreshTokenProblem(e)) {
          try {
            clearSupabaseAuthStorage();
            await supabase.auth.signOut();
          } catch {
            // intentionally ignore: best-effort cleanup
          }
        }

        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message?.toLowerCase();

      if (isRefreshTokenProblem(error)) {
        clearSupabaseAuthStorage();
        await supabase.auth.signOut();
        throw new Error("Session expired. Please refresh the page and login again.");
      }

      if (msg?.includes("email not confirmed")) {
        throw new Error("Please confirm your email first (check your inbox).");
      }

      throw new Error(error.message);
    }
  };

  // ✅ Accept semesterId and store in user_metadata
  const signup = async (email: string, password: string, name: string, semesterId: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          name,
          semester_id: semesterId,
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
}