import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthPanel } from "@/components/AuthPanel";
import { clearStoredAuth, getStoredAuth, login, me, register, type BackendUser } from "@/lib/backendSession";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.token) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    me(stored.token)
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch((loadError) => {
        console.warn("Stored auth could not be restored:", loadError);
        clearStoredAuth();
        if (!cancelled) setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const auth = mode === "sign_in" ? await login(cleanEmail, password) : await register(cleanEmail, password);
      setCurrentUser(auth.user);
      toast.success(mode === "sign_in" ? "Signed in successfully" : "Account created successfully");
      navigate("/");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      setError(message);
      toast.error("Authentication failed", { description: message });
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    clearStoredAuth();
    setCurrentUser(null);
    toast.success("Signed out");
  };

  const isSignIn = mode === "sign_in";

  return (
    <main className="min-h-screen px-6 py-8 md:px-10 md:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-serif text-lg tracking-tight">NeuroVeil<span className="text-primary">.</span></span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="space-y-6 pt-6 md:pt-10">
            <div className="space-y-4 max-w-2xl">
              <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Secure access</div>
              <h1 className="text-5xl md:text-6xl font-serif italic leading-[0.95]">
                {isSignIn ? "Welcome back." : "Create your account."}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                {isSignIn
                  ? "Sign in to keep your scan history private and sync saved analysis with your account."
                  : "Create an account to unlock private history, saved scan results, and a cleaner session flow."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <Card className="card-glass p-5 space-y-2">
                <div className="font-mono-mini text-[11px] uppercase tracking-widest text-muted-foreground">Private history</div>
                <p className="text-sm text-foreground/85">Keep analysis results tied to your own account.</p>
              </Card>
              <Card className="card-glass p-5 space-y-2">
                <div className="font-mono-mini text-[11px] uppercase tracking-widest text-muted-foreground">Fast access</div>
                <p className="text-sm text-foreground/85">Jump back to the detector as soon as youre signed in.</p>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/">
                  Go to detector
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to={isSignIn ? "/signup" : "/login"}>{isSignIn ? "Need an account?" : "Already have one?"}</Link>
              </Button>
            </div>
          </section>

          <section className="space-y-4 pt-2 md:pt-10">
            {!authReady ? (
              <Card className="card-glass p-6 md:p-8">
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Loading account...</div>
              </Card>
            ) : currentUser ? (
              <Card className="card-glass p-6 md:p-8 space-y-5">
                <div className="space-y-2">
                  <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Account</div>
                  <h2 className="text-2xl md:text-3xl font-serif italic leading-tight">Already signed in</h2>
                  <p className="text-sm text-muted-foreground break-all">{currentUser.email}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border px-3 py-1">Account active</span>
                  <span className="rounded-full border border-border px-3 py-1">Private history ready</span>
                </div>
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </Button>
              </Card>
            ) : (
              <AuthPanel
                mode={mode}
                email={email}
                password={password}
                busy={busy}
                error={error}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={handleSubmit}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
