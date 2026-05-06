const stages = [
  { title: "Ingest", body: "Drop an image or video. Decoded entirely client-side and sliced into representative frames." },
  { title: "Extract", body: "Faces, edges, frequency artifacts and motion vectors are isolated and normalized." },
  { title: "Reason", body: "A multimodal AI cross-examines visual evidence against physical plausibility constraints." },
  { title: "Verdict", body: "Confidence score, heat-mapped artifacts and an explanation arrive in under four seconds." },
];

export function Method() {
  return (
    <section id="method" className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32 space-y-16">
      <div className="space-y-6">
        <div className="font-mono-mini text-xs text-foreground/50 tracking-widest">02</div>
        <h2 className="font-serif text-5xl md:text-7xl leading-[1.05] tracking-tight max-w-4xl">
          From upload to verdict in four stages.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {stages.map((s, i) => (
          <div key={s.title} className="bg-background p-6 md:p-8 space-y-5 min-h-[220px]">
            <div className="font-mono-mini text-xs text-primary/80 tracking-widest">
              {String(i + 1).padStart(2, "0")} / 04
            </div>
            <h3 className="font-serif text-2xl md:text-3xl">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
