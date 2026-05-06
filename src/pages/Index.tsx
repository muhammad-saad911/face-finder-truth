import { useCallback, useRef, useState } from "react";
import { Upload, Image as ImageIcon, Film, X, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, extractVideoFrames, fileToDataUrl } from "@/lib/media";
import { AnalysisResult, ResultCard } from "@/components/ResultCard";

const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 50;
const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [status, setStatus] = useState<"idle" | "preparing" | "analyzing">("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const isImage = ACCEPTED_IMAGE.includes(f.type);
    const isVideo = ACCEPTED_VIDEO.includes(f.type);
    if (!isImage && !isVideo) {
      toast.error("Unsupported file type", { description: "Use JPG, PNG, WEBP, MP4, MOV, or WEBM." });
      return;
    }
    const maxBytes = (isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB) * 1024 * 1024;
    if (f.size > maxBytes) {
      toast.error("File too large", { description: `Max ${isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB} MB.` });
      return;
    }
    setFile(f);
    setMediaType(isImage ? "image" : "video");
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
  }, []);

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
      toast.success("Analysis complete");
    } catch (e) {
      console.error(e);
      toast.error("Analysis failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setStatus("idle");
    }
  };

  const isWorking = status !== "idle";

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm">
            <Sparkles className="w-4 h-4" />
            <span>AI-powered deepfake detection</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Is it real, or is it a <span className="gradient-text">deepfake?</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload an image or video and our vision AI will analyze it for signs of manipulation, AI generation, and deepfake artifacts.
          </p>
        </header>

        {/* Upload / Preview */}
        {!file ? (
          <Card
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`card-glass cursor-pointer p-10 md:p-16 text-center border-2 border-dashed transition-all ${
              dragActive ? "border-primary glow scale-[1.01]" : "border-border hover:border-primary/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={[...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO].join(",")}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-5 animate-pulse-glow">
              <Upload className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Drop your file here, or click to browse</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Images up to {MAX_IMAGE_MB} MB · Videos up to {MAX_VIDEO_MB} MB
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground">
                <ImageIcon className="w-3.5 h-3.5" /> JPG · PNG · WEBP
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground">
                <Film className="w-3.5 h-3.5" /> MP4 · MOV · WEBM
              </span>
            </div>
          </Card>
        ) : (
          <Card className="card-glass p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border bg-muted/30 flex-shrink-0">
                {mediaType === "image" ? (
                  <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <video src={previewUrl} className="w-full h-full object-cover" muted />
                )}
                {isWorking && (
                  <div className="absolute inset-0 overflow-hidden bg-primary/10">
                    <div className="absolute inset-x-0 h-1 bg-primary shadow-[0_0_15px_hsl(var(--primary))] animate-scan" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {mediaType}
                    </p>
                  </div>
                  {!isWorking && (
                    <Button variant="ghost" size="icon" onClick={reset}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={analyze} disabled={isWorking} size="lg" className="gradient-primary text-primary-foreground hover:opacity-90 border-0">
                    {isWorking ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {status === "preparing" ? (mediaType === "video" ? "Extracting frames..." : "Preparing...") : "Analyzing..."}
                      </>
                    ) : (
                      <><ShieldCheck className="w-4 h-4 mr-2" /> Analyze for Deepfake</>
                    )}
                  </Button>
                  {!isWorking && (
                    <Button variant="outline" onClick={reset}>Upload Different File</Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {result && previewUrl && (
          <ResultCard result={result} previewUrl={previewUrl} mediaType={mediaType} />
        )}

        <footer className="text-center text-xs text-muted-foreground pt-8">
          Files are processed in-memory and never stored.
        </footer>
      </div>
    </main>
  );
};

export default Index;
