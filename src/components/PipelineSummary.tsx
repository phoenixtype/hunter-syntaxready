import { ArrowRight } from "lucide-react";

interface Props {
  counts: Record<string, number>;
}

const STAGES = [
  { id: "applied", label: "Applied", dotClass: "bg-primary" },
  { id: "interview", label: "Interview", dotClass: "bg-warning" },
  { id: "offer", label: "Offer", dotClass: "bg-success" },
  { id: "rejected", label: "Rejected", dotClass: "bg-destructive" },
];

export default function PipelineSummary({ counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs">
      {STAGES.map((s, i) => (
        <span key={s.id} className="flex items-center gap-1">
          {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
          <span className={`w-2 h-2 rounded-full ${s.dotClass}`} />
          <span className="font-medium">{counts[s.id] || 0}</span>
          <span className="text-muted-foreground">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
