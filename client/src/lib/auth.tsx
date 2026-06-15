/**
 * client/src/lib/auth.tsx
 * Upgraded Auth — Supabase Auth (email/password) with legacy fallback
 *
 * STRATEGY:
 *   1. Primary: Supabase Auth (email + password) → returns JWT with user role
 *   2. Fallback: Legacy shared password (bieri2026) → admin role assumed
 *
 * This allows the existing app to keep working while enabling per-user auth
 * for the co-parent portal and role-based access control.
 *
 * USER ROLES:
 *   - admin: David & Nancy — full access to all children and features
 *   - coparent: Cole/Airlie's biological father — restricted to co-parent portal
 *   - viewer: Read-only access (future: babysitters, grandparents, etc.)
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient, Session, User } from "@supabase/supabase-js";

const LS_AUTH_KEY = "familyHub_authToken";
const LS_USER_KEY = "familyHub_user";

// ─── Supabase Client ─────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "coparent" | "viewer";

export interface HubUser {
  id: string;
  email?: string;
  display_name: string;
  role: UserRole;
  child_scope: string[]; // empty = all children (admin)
}

interface AuthCtx {
  authed: boolean;
  user: HubUser | null;
  session: Session | null;
  login: (emailOrPassword: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isCoparent: boolean;
  canAccessChild: (childId: string) => boolean;
}

const DEFAULT_ADMIN: HubUser = {
  id: "legacy-admin",
  display_name: "Bieri Family",
  role: "admin",
  child_scope: [],
};

const Ctx = createContext<AuthCtx>({
  authed: false,
  user: null,
  session: null,
  login: async () => false,
  logout: () => {},
  isAdmin: false,
  isCoparent: false,
  canAccessChild: () => false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<HubUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  // On mount: check for existing Supabase session or legacy token
  useEffect(() => {
    async function init() {
      // 1. Check URL param for legacy token
      const params = new URLSearchParams(window.location.search);
      const t = params.get("t");
      if (t) {
        localStorage.setItem(LS_AUTH_KEY, t);
        setAuthed(true);
        setUser(DEFAULT_ADMIN);
        const url = new URL(window.location.href);
        url.searchParams.delete("t");
        window.history.replaceState({}, "", url.toString());
        setChecked(true);
        return;
      }

      // 2. Check for active Supabase session
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        setSession(existingSession);
        const hubUser = await fetchHubUser(existingSession.user);
        setUser(hubUser);
        setAuthed(true);
        setChecked(true);
        return;
      }

      // 3. Check localStorage for legacy token
      const stored = localStorage.getItem(LS_AUTH_KEY);
      if (stored) {
        setAuthed(true);
        const storedUser = localStorage.getItem(LS_USER_KEY);
        setUser(storedUser ? JSON.parse(storedUser) : DEFAULT_ADMIN);
      }

      setChecked(true);
    }

    init();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === "SIGNED_IN" && newSession) {
          setSession(newSession);
          const hubUser = await fetchHubUser(newSession.user);
          setUser(hubUser);
          setAuthed(true);
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setAuthed(false);
          localStorage.removeItem(LS_AUTH_KEY);
          localStorage.removeItem(LS_USER_KEY);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Login function — supports two modes:
   *   1. Email + password → Supabase Auth
   *   2. Single password → Legacy shared password
   */
  async function login(emailOrPassword: string, password?: string): Promise<boolean> {
    // Mode 1: Supabase Auth (email + password)
    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailOrPassword,
        password,
      });
      if (error || !data.session) return false;

      setSession(data.session);
      const hubUser = await fetchHubUser(data.user);
      setUser(hubUser);
      setAuthed(true);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(hubUser));
      return true;
    }

    // Mode 2: Legacy shared password
    const pw = emailOrPassword;
    const token = btoa(pw);
    const knownToken = "YmllcmkyMDI2"; // btoa('bieri2026')

    if (token === knownToken) {
      setAuthed(true);
      setUser(DEFAULT_ADMIN);
      localStorage.setItem(LS_AUTH_KEY, token);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(DEFAULT_ADMIN));
      return true;
    }

    // Fallback: try server
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setAuthed(true);
          setUser(DEFAULT_ADMIN);
          localStorage.setItem(LS_AUTH_KEY, data.token);
          localStorage.setItem(LS_USER_KEY, JSON.stringify(DEFAULT_ADMIN));
          return true;
        }
      }
    } catch {}

    return false;
  }

  async function logout() {
    if (session) {
      await supabase.auth.signOut();
    }
    setAuthed(false);
    setUser(null);
    setSession(null);
    localStorage.removeItem(LS_AUTH_KEY);
    localStorage.removeItem(LS_USER_KEY);
  }

  const isAdmin = user?.role === "admin";
  const isCoparent = user?.role === "coparent";

  function canAccessChild(childId: string): boolean {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.child_scope.length === 0) return true;
    return user.child_scope.includes(childId);
  }

  if (!checked) return null;

  return (
    <Ctx.Provider value={{ authed, user, session, login, logout, isAdmin, isCoparent, canAccessChild }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the hub_users record for a Supabase Auth user.
 * Falls back to a default admin if the record doesn't exist yet.
 */
async function fetchHubUser(authUser: User): Promise<HubUser> {
  try {
    const { data, error } = await supabase
      .from("hub_users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single();

    if (data && !error) {
      return {
        id: data.id,
        email: data.email,
        display_name: data.display_name,
        role: data.role as UserRole,
        child_scope: data.child_scope || [],
      };
    }
  } catch {}

  // Fallback: if no hub_users record exists, assume admin
  return {
    id: authUser.id,
    email: authUser.email,
    display_name: authUser.email?.split("@")[0] || "User",
    role: "admin",
    child_scope: [],
  };
}
