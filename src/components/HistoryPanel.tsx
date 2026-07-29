import { Card } from "@/components/ui/card";
import type { SavedAnalysis } from "@/lib/analysisHistory";

function fmtDate(value: string) {
  return new Date(value).toLocaleString();
}

export function HistoryPanel({ items, loading }: { items: SavedAnalysis[]; loading: boolean }) {
  return (
    <Card className="card-glass p-6 md:p-8 space-y-5">
      <div className="space-y-2">
        <div className="font-mono-mini text-xs text-primary/70 tracking-widest uppercase">// History</div>
        <h3 className="text-2xl md:text-3xl font-serif italic leading-tight">Your recent scans</h3>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your saved scans...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved scans yet. Run your first analysis to create a record.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background/50 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium truncate">{item.file_name || "Untitled file"}</p>
                <span className="text-xs text-muted-foreground">{fmtDate(item.created_at)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2 py-1">{item.media_type}</span>
                <span className="rounded-full border border-border px-2 py-1">{item.verdict}</span>
                <span className="rounded-full border border-border px-2 py-1">{item.deepfake_probability}% deepfake</span>
                <span className="rounded-full border border-border px-2 py-1">{item.confidence}% confidence</span>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">{item.summary}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
