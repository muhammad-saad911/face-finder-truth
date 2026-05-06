import { useCallback, useRef, useState } from "react";
import { Upload, Image as ImageIcon, Film, X, Loader2, ShieldCheck, Sparkles, ShieldAlert, ShieldQuestion, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, extractVideoFrames, fileToDataUrl } from "@/lib/media";
import { AnalysisResult, Verdict } from "@/components/ResultCard";
import { Hero } from "@/components/Hero";

const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 50;
const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

const verdictMeta: Record<Verdict, { label: string; tone: "success" | "warning" | "danger"; Icon: any }> = {
  authentic: { label: "Authentic", tone: "success", Icon: ShieldCheck },
  likely_authentic: { label: "Likely Authentic", tone: "success", Icon: ShieldCheck },
  uncertain: { label: "Uncertain", tone: "warning", Icon: ShieldQuestion },
  likely_deepfake: { label: "Likely Deepfake", tone: "danger", Icon: ShieldAlert },
  deepfake: { label: "Deepfake Detected", tone: "danger", Icon: AlertTriangle },
};

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [tab, setTab] = useState<"image" | "video">("image");
  const [status, setStatus] = useState<"idle" | "preparing" | "analyzing">("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mediaType = tab;
  const accepted = tab === "image" ? ACCEPTED_IMAGE : ACCEPTED_VIDEO;
  const maxMb = tab === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;

  const handleFile = useCallback((f: File) => {
    const ok = accepted.includes(f.type);
    if (!ok) {
      toast.error("Unsupported file type", { description: tab === "image" ? "Use JPG, PNG, or WEBP." : "Use MP4, MOV, or WEBM." });
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
      let images: string[];
      if (mediaType === "image") {
        const dataUrl = await fileToDataUrl(file);
        images = [await compressImage(dataUrl, 1024, 0.85)];
      } else {
        toast.info("Extracting video frames...");
        images = await extractVideoFrames(file, 5, 1024);
      }

      setStatus("analyzing");
      const { data, error } = await supabase.functions.invoke("detect-deepfake", {
        body: { images, mediaType },
      });

      if (error) {
        const msg = (error as any).context?.status === 429
          ? "Rate limit reached. Try again in a moment."
          : (error as any).context?.status === 402
          ? "AI credits exhausted. Add credits in workspace settings."
          : error.message || "Analysis failed";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      setResult(data as AnalysisResult);
      toast.success("Scan complete");
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
    <main className="min-h-screen">
      <Hero onDetectClick={() => document.getElementById("detect")?.scrollIntoView({ behavior: "smooth" })} />

      <div id="detect" className="max-w-7xl mx-auto px-6 md:px-10 py-16 space-y-10 scroll-mt-8">
        {/* Header */}
        <header className="space-y-3 max-w-3xl">
          <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// Forensic media analysis</div>
          <h2 className="text-5xl md:text-6xl font-serif italic leading-[1.05]">
            Run a real forensic scan.
          </h2>
          <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
            Upload an image or short video. Analysis runs through a multimodal AI pipeline — typically under 5 seconds.
          </p>
        </header>

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
                  accept={accepted.join(",")}
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
                  {tab === "image" ? "JPG · PNG · WEBP" : "MP4 · MOV · WEBM"}
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
                  {status === "preparing" ? (mediaType === "video" ? "Extracting frames..." : "Preparing...") : "Analyzing..."}
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

        <footer className="font-mono-mini text-[11px] text-muted-foreground tracking-widest uppercase pt-4">
          // Files processed in-memory · Never stored · AI detection is probabilistic
        </footer>
      </div>
    </main>
  );
};

export default Index;
