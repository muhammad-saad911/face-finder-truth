import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "sign_in" | "sign_up";

export function AuthPanel(props: {
  mode: AuthMode;
  email: string;
  password: string;
  busy: boolean;
  error: string;
  onModeChange?: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { mode, email, password, busy, error, onEmailChange, onPasswordChange, onSubmit } = props;
  const isSignIn = mode === "sign_in";
  const oppositeHref = isSignIn ? "/signup" : "/login";
  const oppositeLabel = isSignIn ? "Create one" : "Sign in";

  return (
    <Card className="card-glass p-6 md:p-8 space-y-5">
      <div className="space-y-2">
        <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Account</div>
        <h3 className="text-2xl md:text-3xl font-serif italic leading-tight">
          {isSignIn ? "Sign in to save your scans" : "Create your account"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isSignIn
            ? "Each user gets private analysis history and saved results."
            : "Use an account to keep your analysis history and scan results private."}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="********"
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" disabled={busy} className="w-full bg-primary/90 hover:bg-primary text-primary-foreground border-0">
          {busy ? "Working..." : isSignIn ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground pt-1">
        <span>{isSignIn ? "New here?" : "Already have an account?"}</span>
        <Link to={oppositeHref} className="font-medium text-primary hover:underline">
          {oppositeLabel}
        </Link>
      </div>
    </Card>
  );
}
