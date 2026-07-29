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
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { mode, email, password, busy, error, onModeChange, onEmailChange, onPasswordChange, onSubmit } = props;

  return (
    <Card className="card-glass p-6 md:p-8 space-y-5">
      <div className="space-y-2">
        <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Account</div>
        <h3 className="text-2xl md:text-3xl font-serif italic leading-tight">Sign in to save your scans</h3>
        <p className="text-sm text-muted-foreground">
          Each user gets their own analysis history and results.
        </p>
      </div>

      <div className="inline-flex gap-1 p-1 rounded-md bg-secondary/60 border border-border">
        {(["sign_in", "sign_up"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onModeChange(item)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === item ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item === "sign_in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="space-y-4">
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
            placeholder="••••••••"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button onClick={onSubmit} disabled={busy} className="w-full bg-primary/90 hover:bg-primary text-primary-foreground border-0">
        {busy ? "Working..." : mode === "sign_in" ? "Sign in" : "Create account"}
      </Button>
    </Card>
  );
}
