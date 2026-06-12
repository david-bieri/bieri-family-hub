import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";

const LS_AUTH_KEY = "familyHub_authToken";

interface AuthCtx {
  authed: boolean;
  login: (pw: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ authed: false, login: async () => false, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // 1. Check URL param for token (legacy links / iframe compat)
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t) {
      // Migrate token from URL to localStorage and clean up the URL
      localStorage.setItem(LS_AUTH_KEY, t);
      setAuthed(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("t");
      window.history.replaceState({}, "", url.toString());
    } else {
      // 2. Check localStorage for persisted token
      const stored = localStorage.getItem(LS_AUTH_KEY);
      if (stored) {
        setAuthed(true);
      }
    }
    setChecked(true);
  }, []);

  async function login(pw: string) {
    // Client-side check first — works in static deploy (no Express server needed)
    const token = btoa(pw);
    const knownToken = "YmllcmkyMDI2"; // btoa('bieri2026')
    if (token === knownToken) {
      setAuthed(true);
      localStorage.setItem(LS_AUTH_KEY, token);
      return true;
    }
    // Fallback: try server (works when Express is running)
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
          localStorage.setItem(LS_AUTH_KEY, data.token);
          return true;
        }
      }
    } catch {}
    return false;
  }

  function logout() {
    setAuthed(false);
    localStorage.removeItem(LS_AUTH_KEY);
  }

  if (!checked) return null;
  return <Ctx.Provider value={{ authed, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
