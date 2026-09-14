export function ConfidenceBar({ confidence, threshold = 0.85 }: { confidence: number; threshold?: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= threshold ? "bg-emerald-500" : confidence >= threshold * 0.6 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{pct}%</span>
    </div>
  );
}
