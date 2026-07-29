import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Image as ImageIcon, Film, X, Loader2, ShieldCheck, Sparkles, ShieldAlert, ShieldQuestion, AlertTriangle, LogOut, UserCircle2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AnalysisResult, Verdict } from "@/components/ResultCard";
import { Hero } from "@/components/Hero";
import { Method } from "@/components/Method";
import { Methods } from "@/components/Methods";
import { Gallery } from "@/components/Gallery";
import { analyzeWithBackend, type BackendAnalysisResponse } from "@/lib/backendDetector";
import { AuthPanel } from "@/components/AuthPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { loadUserAnalyses, saveAnalysisForUser, type SavedAnalysis } from "@/lib/analysisHistory";
import { clearStoredAuth, getStoredAuth, login, me, register, type BackendUser } from "@/lib/backendSession";

const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 100;
const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_VIDEO_PREFIX = "video/";
const ACCEPTED_VIDEO_EXTENSIONS = [
  ".3gp",
  ".avi",
  ".flv",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ts",
  ".webm",
  ".wmv",
];

type EnrichedAnalysisResult = AnalysisResult & {
  backend?: string;
  model?: string;
  mediaType?: "image" | "video";
  frameCount?: number;
  framesAnalyzed?: number;
  ai_probability?: number;
  real_probability?: number;
};

const verdictMeta: Record<Verdict, { label: string; tone: "success" | "warning" | "danger"; Icon: LucideIcon }> = {
  authentic: { label: "Authentic", tone: "success", Icon: ShieldCheck },
  likely_authentic: { label: "Likely Authentic", tone: "success", Icon: ShieldCheck },
  uncertain: { label: "Uncertain", tone: "warning", Icon: ShieldQuestion },
  likely_deepfake: { label: "Likely Deepfake", tone: "danger", Icon: ShieldAlert },
  deepfake: { label: "Deepfake Detected", tone: "danger", Icon: AlertTriangle },
};

const Index = () => {
  const [currentUser, setCurrentUser] = useState<BackendUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [tab, setTab] = useState<"image" | "video">("image");
  const [status, setStatus] = useState<"idle" | "preparing" | "analyzing">("idle");
  const [result, setResult] = useState<EnrichedAnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mediaType = tab;
  const accepted = tab === "image" ? ACCEPTED_IMAGE : ACCEPTED_VIDEO_EXTENSIONS;
  const maxMb = tab === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
  const activeUserId = currentUser?.id;

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
      .catch((error) => {
        console.warn("Stored login expired or invalid:", error);
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

  useEffect(() => {
    if (!currentUser) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    loadUserAnalyses(10)
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) toast.error("Could not load your scan history");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  const handleAuthSubmit = async () => {
    const email = authEmail.trim();
    if (!email || !authPassword.trim()) {
      setAuthError("Please enter both email and password.");
      return;
    }

    setAuthBusy(true);
    setAuthError("");
    try {
      const auth = authMode === "sign_in" ? await login(email, authPassword) : await register(email, authPassword);
      setCurrentUser(auth.user);
      toast.success(authMode === "sign_in" ? "Signed in successfully" : "Account created");
      setAuthPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      setAuthError(message);
      toast.error("Authentication failed", { description: message });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    clearStoredAuth();
    setCurrentUser(null);
    setHistory([]);
    setResult(null);
    toast.success("Signed out");
  };

  const handleFile = useCallback((f: File) => {
    const fileName = f.name.toLowerCase();
    const ok =
      tab === "image"
        ? accepted.includes(f.type)
        : f.type.startsWith(ACCEPTED_VIDEO_PREFIX) ||
          ACCEPTED_VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    if (!ok) {
      toast.error("Unsupported file type", {
        description:
          tab === "image"
            ? "Use JPG, PNG, or WEBP."
            : "Use any common video format such as MP4, MOV, WEBM, MKV, AVI, or M4V.",
      });
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      toast.error("File too large", { description: `Max ${maxMb} MB.` });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
  }, [accepted, maxMb, tab]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setResult(null);
    setStatus("idle");
  };

  const switchTab = (t: "image" | "video") => {
    if (t === tab) return;
    reset();
    setTab(t);
  };

  const analyze = async () => {
    if (!file) return;
    setResult(null);
    try {
      setStatus("preparing");
      setStatus("analyzing");
      const backendResult = (await analyzeWithBackend({
        file,
        mediaType,
      })) as BackendAnalysisResponse;

      const finalResult: EnrichedAnalysisResult = {
        ...backendResult,
        mediaType,
        frameCount: backendResult.framesAnalyzed,
      };

      setResult(finalResult);

      if (currentUser) {
        try {
          const saved = await saveAnalysisForUser({
            fileName: file.name,
            mediaType,
            frameCount: finalResult.frameCount ?? finalResult.framesAnalyzed ?? 1,
            result: finalResult,
          });
          setHistory((prev) => [saved, ...prev].slice(0, 10));
          toast.success("Scan complete", {
            description: "Your result was saved to your account.",
          });
        } catch (saveError) {
          console.warn("Could not save analysis history:", saveError);
          toast.warning("Scan completed, but the result could not be saved to your account.");
        }
      } else {
        toast.success("Scan complete", {
          description: "Sign in anytime if you want to save your scan history.",
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setStatus("idle");
    }
  };

  const isWorking = status !== "idle";
  const meta = result ? verdictMeta[result.verdict] : null;
  const toneText = meta?.tone === "success" ? "text-success" : meta?.tone === "warning" ? "text-warning" : "text-danger";
  const toneBar = meta?.tone === "success" ? "bg-success" : meta?.tone === "warning" ? "bg-warning" : "bg-danger";

  return (
    <main className="min-h-screen [&_section]:scroll-mt-20 [&>div]:scroll-mt-20">
      <Hero />

      <div id="detect" className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24 space-y-10">
        {/* Header */}
        <header className="space-y-3 max-w-3xl">
          <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// 01 — Forensic media analysis</div>
          <h2 className="text-5xl md:text-6xl font-serif italic leading-[1.05]">
            Run a real forensic scan.
          </h2>
          <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
            Upload an image or short video. Analysis runs through a multimodal AI pipeline — typically under 5 seconds.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          {!authReady ? (
            <Card className="card-glass p-6 md:p-8">
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Loading account...</div>
            </Card>
          ) : currentUser ? (
            <Card className="card-glass p-6 md:p-8 space-y-5">
              <div className="space-y-2">
                <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Account</div>
                <h3 className="text-2xl md:text-3xl font-serif italic leading-tight">Welcome back</h3>
                <p className="text-sm text-muted-foreground break-all">{currentUser.email}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-3 py-1">Saved scans: {history.length}</span>
                <span className="rounded-full border border-border px-3 py-1">Private history</span>
                <span className="rounded-full border border-border px-3 py-1">Per-user data</span>
              </div>
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </Card>
          ) : (
            <AuthPanel
              mode={authMode}
              email={authEmail}
              password={authPassword}
              busy={authBusy}
              error={authError}
              onModeChange={setAuthMode}
              onEmailChange={setAuthEmail}
              onPasswordChange={setAuthPassword}
              onSubmit={handleAuthSubmit}
            />
          )}

          <Card className="card-glass p-6 md:p-8 space-y-5">
            <div className="space-y-2">
              <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Data</div>
              <h3 className="text-2xl md:text-3xl font-serif italic leading-tight">Your scans can stay with your account</h3>
              <p className="text-sm text-muted-foreground">
                No sign-in is required to analyze. Sign in only if you want private saved history.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-4">
              <UserCircle2 className="w-10 h-10 text-primary" />
              <div>
                <p className="font-medium">{currentUser ? "Analysis saving enabled" : "Sign in to enable saved scans"}</p>
                <p className="text-sm text-muted-foreground">
                  {currentUser ? "Your results will appear in the history panel below." : "Login gives you personal scan history and saved verdicts."}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Two-panel layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT: Upload */}
          <Card className="card-glass p-6 md:p-8 space-y-5">
            {/* Tabs */}
            <div className="inline-flex gap-1 p-1 rounded-md bg-secondary/60 border border-border">
              {(["image", "video"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={`px-4 py-1.5 rounded text-sm font-medium inline-flex items-center gap-2 transition-colors ${
                    tab === t ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "image" ? <ImageIcon className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>

            {!file ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-lg border border-dashed transition-all py-16 px-6 text-center ${
                  dragActive ? "border-primary bg-primary/5" : "border-primary/30 hover:border-primary/60 hover:bg-primary/[0.02]"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={tab === "image" ? accepted.join(",") : "video/*"}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="mx-auto w-14 h-14 rounded-md border border-primary/40 bg-primary/5 flex items-center justify-center mb-5">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <p className="font-serif italic text-lg mb-1">
                  {tab === "image" ? "Drop an image here" : "Drop a video here"}
                </p>
                <p className="text-sm text-muted-foreground mb-5">
                  or click to browse · max {maxMb} MB
                </p>
                <div className="font-mono-mini text-[11px] tracking-widest text-muted-foreground uppercase">
                  {tab === "image" ? "JPG · PNG · WEBP" : "ALL VIDEO FORMATS"}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20 aspect-video flex items-center justify-center">
                  {mediaType === "image" ? (
                    <img src={previewUrl} alt="preview" className="w-full h-full object-contain" />
                  ) : (
                    <video src={previewUrl} controls className="w-full h-full object-contain" />
                  )}
                  {isWorking && (
                    <div className="absolute inset-0 overflow-hidden bg-primary/5 pointer-events-none">
                      <div className="absolute inset-x-0 h-px bg-primary shadow-[0_0_20px_hsl(var(--primary))] animate-scan" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground font-mono-mini">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {!isWorking && (
                    <Button variant="ghost" size="icon" onClick={reset}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={analyze}
              disabled={!file || isWorking}
              size="lg"
              className="w-full bg-primary/90 hover:bg-primary text-primary-foreground border-0"
            >
              {isWorking ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {status === "preparing"
                    ? "Preparing upload..."
                    : "Analyzing..."}
                </>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Analyze</>
              )}
            </Button>
          </Card>

          {/* RIGHT: Verdict panel */}
          <Card className="card-glass p-6 md:p-8 min-h-[460px] flex flex-col">
            <div className="font-mono-mini text-xs text-muted-foreground tracking-widest uppercase mb-6">
              // Verdict
            </div>

            {!result ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full border border-border flex items-center justify-center text-muted-foreground">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-sm text-muted-foreground max-w-[220px]">
                  {isWorking ? "Scanning media for synthetic artifacts…" : "Awaiting media. Drop a file to begin scanning."}
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div>
                  <div className={`inline-flex items-center gap-2 ${toneText} mb-3`}>
                    {meta && <meta.Icon className="w-5 h-5" />}
                    <span className="font-serif italic text-2xl">{meta?.label}</span>
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed">{result.summary}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono-mini uppercase tracking-wider text-muted-foreground mb-2">
                      <span>Deepfake probability</span>
                      <span className={toneText}>{result.deepfake_probability.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full ${toneBar} transition-all duration-700`} style={{ width: `${result.deepfake_probability}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono-mini uppercase tracking-wider text-muted-foreground mb-2">
                      <span>Model confidence</span>
                      <span>{result.confidence.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-foreground/60 transition-all duration-700" style={{ width: `${result.confidence}%` }} />
                    </div>
                  </div>
                  {typeof result.ai_probability === "number" && (
                    <div>
                      <div className="flex justify-between text-xs font-mono-mini uppercase tracking-wider text-muted-foreground mb-2">
                        <span>AI-generated signal</span>
                        <span>{result.ai_probability.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary/80 transition-all duration-700" style={{ width: `${result.ai_probability}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="font-mono-mini text-xs uppercase tracking-widest text-muted-foreground mb-3">
                    // Observations
                  </div>
                  <ul className="space-y-2.5">
                    {result.observations.map((o, i) => (
                      <li key={i} className="flex gap-3 text-sm text-foreground/85">
                        <span className="text-primary/70 font-mono-mini text-xs mt-1">{String(i + 1).padStart(2, "0")}</span>
                        <span className="leading-relaxed">{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </div>

        {currentUser ? <HistoryPanel items={history} loading={historyLoading} /> : null}

        <footer className="font-mono-mini text-[11px] text-muted-foreground tracking-widest uppercase pt-4">
          // No sign-in required to analyze · sign in only to save scans · AI detection is probabilistic
        </footer>
      </div>

      <Methods />
      <Method />
      <Gallery />
    </main>
  );
};

export default Index;

