import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, History as HistoryIcon, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HistoryPanel } from "@/components/HistoryPanel";
import { loadUserAnalyses, type SavedAnalysis } from "@/lib/analysisHistory";
import { clearStoredAuth, getStoredAuth, me, type BackendUser } from "@/lib/backendSession";

export default function HistoryPage() {
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.token) {
      setReady(true);
      return;
    }

    let cancelled = false;
    me(stored.token)
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch((error) => {
        console.warn("Stored login expired or invalid:", error);
        clearStoredAuth();
        if (!cancelled) setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadUserAnalyses(20)
      .then((history) => {
        if (!cancelled) setItems(history);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  return (
    <main className="min-h-screen px-6 py-8 md:px-10 md:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-serif text-lg tracking-tight">NeuroVeil<span className="text-primary">.</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-primary/90 hover:bg-primary text-primary-foreground border-0">
              <Link to="/signup">Sign up</Link>
            </Button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <Card className="card-glass p-6 md:p-8 space-y-5">
            <div className="space-y-3">
              <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// History</div>
              <h1 className="text-5xl md:text-6xl font-serif italic leading-[0.95]">Recent scans and saved results.</h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                Review the latest analyses tied to your account. If youre not signed in, this page still shows any locally saved recent scans.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1">{currentUser ? "Signed in" : "Guest mode"}</span>
              <span className="rounded-full border border-border px-3 py-1">{items.length} saved scans</span>
              <span className="rounded-full border border-border px-3 py-1">Private by default</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/">
                  Go to detector
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {!currentUser ? (
                <Button asChild>
                  <Link to="/login">Sign in to sync history</Link>
                </Button>
              ) : null}
            </div>

            {!ready ? (
              <p className="text-sm text-muted-foreground">Checking your account...</p>
            ) : currentUser ? (
              <p className="text-sm text-muted-foreground break-all">Signed in as {currentUser.email}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Youre not signed in, so this page is showing any locally cached scans.</p>
            )}
          </Card>

          <HistoryPanel items={items} loading={loading} />
        </section>
      </div>
    </main>
  );
}
