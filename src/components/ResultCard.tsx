import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle, type LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

export type Verdict = "authentic" | "likely_authentic" | "uncertain" | "likely_deepfake" | "deepfake";

export interface AnalysisResult {
  verdict: Verdict;
  deepfake_probability: number;
  confidence: number;
  summary: string;
  observations: string[];
  ai_probability?: number;
  real_probability?: number;
  model1_prediction?: string;
  model1_confidence?: number;
  model1_fake_probability?: number;
  model1_real_probability?: number;
  model1_fake_frames?: number;
  model1_real_frames?: number;
  model2_prediction?: string;
  model2_confidence?: number;
  model2_fake_probability?: number;
  model2_real_probability?: number;
  model2_fake_frames?: number;
  model2_real_frames?: number;
  model3_prediction?: string;
  model3_confidence?: number;
  model3_fake_probability?: number;
  model3_real_probability?: number;
}

const verdictMeta: Record<Verdict, { label: string; tone: "success" | "warning" | "danger"; Icon: LucideIcon }> = {
  authentic: { label: "Authentic", tone: "success", Icon: ShieldCheck },
  likely_authentic: { label: "Likely Authentic", tone: "success", Icon: ShieldCheck },
  uncertain: { label: "Uncertain", tone: "warning", Icon: ShieldQuestion },
  likely_deepfake: { label: "Likely Deepfake", tone: "danger", Icon: ShieldAlert },
  deepfake: { label: "Deepfake Detected", tone: "danger", Icon: AlertTriangle },
};

export function ResultCard({ result, previewUrl, mediaType }: { result: AnalysisResult; previewUrl: string; mediaType: "image" | "video" }) {
  const meta = verdictMeta[result.verdict];
  const toneClass = {
    success: "text-success border-success/40 bg-success/10",
    warning: "text-warning border-warning/40 bg-warning/10",
    danger: "text-danger border-danger/40 bg-danger/10",
  }[meta.tone];

  const barClass = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[meta.tone];

  return (
    <Card className="card-glass p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        <div className="rounded-xl overflow-hidden border border-border bg-muted/30 aspect-square flex items-center justify-center">
          {mediaType === "image" ? (
            <img src={previewUrl} alt="Analyzed media" className="w-full h-full object-cover" />
          ) : (
            <video src={previewUrl} controls className="w-full h-full object-cover" />
          )}
        </div>

        <div className="space-y-5">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${toneClass}`}>
            <meta.Icon className="w-5 h-5" />
            <span className="font-semibold">{meta.label}</span>
          </div>

          <p className="text-lg text-foreground/90 leading-relaxed">{result.summary}</p>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Deepfake probability</span>
            <span className="font-mono font-semibold">{result.deepfake_probability.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full ${barClass} transition-all duration-700`} style={{ width: `${result.deepfake_probability}%` }} />
              </div>
            </div>

          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Model confidence</span>
              <span className="font-mono font-semibold">{result.confidence.toFixed(0)}%</span>
            </div>
            <Progress value={result.confidence} className="h-2.5" />
          </div>

          {typeof result.ai_probability === "number" && typeof result.real_probability === "number" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">AI-generated</span>
                  <span className="font-mono font-semibold">{result.ai_probability.toFixed(0)}%</span>
                </div>
                <Progress value={result.ai_probability} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Real content</span>
                  <span className="font-mono font-semibold">{result.real_probability.toFixed(0)}%</span>
                </div>
                <Progress value={result.real_probability} className="h-2" />
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Key Observations</h3>
        <ul className="space-y-2">
          {result.observations.map((o, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground/85">
              <span className="text-primary mt-1">â–¸</span>
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        âš ï¸ AI-based detection is probabilistic and not infallible. Use results as guidance, not absolute proof.
      </p>
    </Card>
  );
}
