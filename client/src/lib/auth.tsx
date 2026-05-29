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
    try {
      const res = await apiRequest("POST", "/api/auth/login", { password: pw });
      const data = await res.json();
      if (data.ok) {
        setAuthed(true);
        // Persist token in URL so page refreshes work
        const url = new URL(window.location.href);
        url.searchParams.set("t", data.token);
        window.history.replaceState({}, "", url.toString());
        return true;
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
