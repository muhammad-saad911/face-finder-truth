import { useState } from "react";
import { ArrowRight } from "lucide-react";

const categories = ["Image Forensics", "Video Frame Analysis", "Forensic Reports"] as const;
type Category = typeof categories[number];

const methodsByCategory: Record<Category, { name: string; meta: string; body: string }[]> = {
  "Image Forensics": [
    { name: "Pixel Anomaly Scan", meta: "Real-time", body: "GAN artifact detection across the spatial domain — seam blending, color-band irregularities and frequency residues." },
    { name: "Face Geometry Audit", meta: "Sub-second", body: "Landmark consistency check across 68 facial points to expose morph and swap operations." },
    { name: "Lighting Physics Test", meta: "<2s", body: "Validates illumination direction and shadow plausibility against reconstructed scene geometry." },
    { name: "Frequency Residue Probe", meta: "<1s", body: "Inspects the DCT spectrum for compression doubling and synthesis fingerprints." },
    { name: "Provenance Hash", meta: "Instant", body: "Generates a tamper-evident verdict hash signed with our forensic key." },
  ],
  "Video Frame Analysis": [
    { name: "Temporal Coherence", meta: "Per-frame", body: "Tracks identity and pose drift across frames to surface generative inconsistency." },
    { name: "Motion Vector Audit", meta: "<3s", body: "Cross-checks optical flow against reconstructed scene motion to flag synthetic warps." },
    { name: "Lip-Sync Forensics", meta: "Sub-second", body: "Aligns viseme geometry with audio phonemes to detect speech overlays." },
    { name: "Codec Signature Trace", meta: "Instant", body: "Inspects encoder fingerprints for evidence of re-rendering pipelines." },
  ],
  "Forensic Reports": [
    { name: "Verdict Brief", meta: "PDF", body: "A signed one-page summary with confidence score, key artifacts and reasoning." },
    { name: "Evidence Heatmap", meta: "Visual", body: "Overlay highlighting tampered regions and the artifact class detected per zone." },
    { name: "Chain of Custody", meta: "Audit", body: "Hash-linked log of every transformation applied to the asset during analysis." },
    { name: "Court-Ready Export", meta: "Bundle", body: "Original media, derived frames, model card and signed verdict packaged for review." },
  ],
};

export function Methods() {
  const [active, setActive] = useState<Category>("Image Forensics");
  const items = methodsByCategory[active];

  return (
    <section id="about" className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_1.4fr] gap-12 lg:gap-20">
        {/* LEFT */}
        <div className="space-y-10">
          <div className="font-mono-mini text-xs text-foreground/50 tracking-widest">03</div>
          <h2 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight">
            Our Methods
          </h2>

          <div className="space-y-px bg-border">
            {categories.map((c) => {
              const isActive = c === active;
              return (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/80 text-primary-foreground"
                      : "bg-background text-foreground/80 hover:bg-secondary/60"
                  }`}
                >
                  <span className="font-medium">{c}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-1">
          <div className="font-mono-mini text-xs text-foreground/50 tracking-[0.25em] uppercase mb-6">
            Signature Methods
          </div>

          <div className="divide-y divide-border">
            {items.map((m) => (
              <article key={m.name} className="py-6 space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-serif text-xl md:text-2xl">{m.name}</h3>
                  <span className="font-mono-mini text-xs text-foreground/60 tracking-wider whitespace-nowrap">
                    {m.meta}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {m.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
