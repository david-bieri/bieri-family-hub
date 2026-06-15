import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Mail } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <svg aria-label="Bieri Family Hub" viewBox="0 0 40 40" width="40" height="40" fill="none">
              <rect width="40" height="40" rx="10" fill="hsl(152 35% 30%)" />
              <path d="M20 10 L10 19 h3.5 v11 h13v-11 h3.5 Z" fill="white" />
              <circle cx="20" cy="8" r="2.5" fill="white" opacity="0.7" />
            </svg>
            <div>
              <div className="text-lg font-bold tracking-tight text-foreground">Bieri Family</div>
              <div className="text-xs text-muted-foreground -mt-0.5">Family Hub</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h1 className="text-base font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-5">Sign in to continue.</p>

          <Tabs defaultValue="password">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="password" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Family Password
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs">
                <Mail className="h-3 w-3 mr-1" />
                Email Login
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <PasswordLogin />
            </TabsContent>

            <TabsContent value="email">
              <EmailLogin />
            </TabsContent>
          </Tabs>
        </div>

        {/* Kids row */}
        <div className="flex justify-center gap-2 mt-6">
          {["Cole","Greta","Airlie","Clara","Heidi","Daisy"].map((name, i) => {
            const colors = ["bg-blue-400","bg-purple-400","bg-green-400","bg-amber-400","bg-rose-400","bg-teal-400"];
            return (
              <div key={name} className={`w-7 h-7 rounded-full ${colors[i]} flex items-center justify-center text-white text-xs font-semibold`}>
                {name[0]}
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">6 kids \u00b7 1 dashboard</p>
      </div>
    </div>
  );
}

function PasswordLogin() {
  const { login } = useAuth();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await login(pw);
    if (!ok) setError("Wrong password. Try again.");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          data-testid="input-password"
          type="password"
          placeholder="Family password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          autoFocus
          className="h-10"
        />
        {error && <p className="text-sm text-destructive mt-1.5">{error}</p>}
      </div>
      <Button
        data-testid="button-login"
        type="submit"
        className="w-full"
        disabled={loading || !pw}
      >
        {loading ? "Checking\u2026" : "Sign in"}
      </Button>
    </form>
  );
}

function EmailLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await login(email, password);
    if (!ok) setError("Invalid email or password.");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="h-10"
        />
      </div>
      <div>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="h-10"
        />
        {error && <p className="text-sm text-destructive mt-1.5">{error}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={loading || !email || !password}>
        {loading ? "Signing in\u2026" : "Sign in with Email"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        For co-parent and individual accounts.
      </p>
    </form>
  );
}
