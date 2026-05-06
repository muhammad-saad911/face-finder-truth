import { ArrowDown, Shield } from "lucide-react";
import heroPixel from "@/assets/hero-pixel-face.jpg";
import heroEyes from "@/assets/hero-eyes.jpg";

const navLinks = [
  { href: "#detect", label: "Detect" },
  { href: "#about", label: "About" },
  { href: "#method", label: "Method" },
  { href: "#gallery", label: "Gallery" },
];

export function Hero() {
  return (
    <section className="relative w-full">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-foreground/80" strokeWidth={1.5} />
          <span className="font-serif text-lg tracking-tight">NeuroVeil<span className="text-primary">.</span></span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm text-foreground/70">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
          ))}
        </div>
        <div className="px-4 py-1.5 rounded-full border border-border text-xs font-mono-mini tracking-widest text-foreground/80">
          555-VERIFY
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-10 md:pt-16 pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        {/* Left: title */}
        <div className="space-y-10">
          <div className="flex items-center gap-3 text-foreground/60">
            <span className="h-px w-10 bg-foreground/30" />
            <span className="font-serif italic text-sm">Welcome to</span>
          </div>

          <h1 className="font-serif text-[18vw] lg:text-[10rem] leading-[0.9] tracking-tight">
            Neuro<br />
            Veil<span className="text-primary">.</span>
          </h1>

          <a
            href="#detect"
            aria-label="Scroll to detector"
            className="inline-flex w-12 h-12 rounded-full border border-foreground/30 items-center justify-center hover:border-primary hover:text-primary transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
          </a>
        </div>

        {/* Right: image diptych */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <figure className="relative aspect-[3/4] overflow-hidden rounded-sm">
            <img
              src={heroPixel}
              alt="Pixelated face dissolving into digital fragments"
              width={768}
              height={1024}
              className="w-full h-full object-cover"
            />
          </figure>
          <figure className="relative aspect-[3/4] overflow-hidden rounded-sm flex flex-col">
            <img
              src={heroEyes}
              alt="Close-up portrait under cyan light"
              width={768}
              height={1024}
              loading="lazy"
              className="w-full flex-1 object-cover"
            />
            <figcaption className="pt-3 font-serif italic text-[11px] md:text-xs text-foreground/70 leading-snug">
              Forensic moments of clarity in every frame. As experts crafted by science and detail, let pixels betray your trust.
            </figcaption>
            <div className="flex gap-1.5 pt-3">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/80" />
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
