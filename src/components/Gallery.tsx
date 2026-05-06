import g1 from "@/assets/gallery-1.jpg";
import g2 from "@/assets/gallery-2.jpg";
import g3 from "@/assets/gallery-3.jpg";
import heroPixel from "@/assets/hero-pixel-face.jpg";
import heroEyes from "@/assets/hero-eyes.jpg";

const items = [
  { src: g1, label: "Identity drift", meta: "Case 014" },
  { src: heroPixel, label: "Pixel decay", meta: "Case 022" },
  { src: g2, label: "Iris anomaly", meta: "Case 031" },
  { src: heroEyes, label: "Lighting mismatch", meta: "Case 047" },
  { src: g3, label: "Silhouette synthesis", meta: "Case 058" },
];

export function Gallery() {
  return (
    <section id="gallery" className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32 space-y-12">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-6">
          <div className="font-mono-mini text-xs text-foreground/50 tracking-widest">04</div>
          <h2 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight">
            Selected case files.
          </h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">
          A small archive of synthetic media our pipeline has dissected — each one a quiet study in fabrication.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {items.map((it, i) => (
          <figure key={i} className="group space-y-3">
            <div className="aspect-[3/4] overflow-hidden rounded-sm bg-muted">
              <img
                src={it.src}
                alt={it.label}
                loading="lazy"
                width={768}
                height={1024}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <figcaption className="flex items-baseline justify-between gap-2">
              <span className="font-serif italic text-sm">{it.label}</span>
              <span className="font-mono-mini text-[10px] text-foreground/50 tracking-widest uppercase">{it.meta}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
