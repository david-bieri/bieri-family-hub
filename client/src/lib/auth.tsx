import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";

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
    // Check URL param for token (works in sandboxed iframe where sessionStorage is blocked)
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t) {
      setAuthed(true);
    }
    setChecked(true);
  }, []);

  async function login(pw: string) {
    // Client-side check first — works in static deploy (no Express server needed)
    const token = btoa(pw);
    const knownToken = "YmllcmkyMDI2"; // btoa('bieri2026')
    if (token === knownToken) {
      setAuthed(true);
      const url = new URL(window.location.href);
      url.searchParams.set("t", token);
      window.history.replaceState({}, "", url.toString());
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
          const url = new URL(window.location.href);
          url.searchParams.set("t", data.token);
          window.history.replaceState({}, "", url.toString());
          return true;
        }
      }
    } catch {}
    return false;
  }

  function logout() {
    setAuthed(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("t");
    window.history.replaceState({}, "", url.toString());
  }

  if (!checked) return null;
  return <Ctx.Provider value={{ authed, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
