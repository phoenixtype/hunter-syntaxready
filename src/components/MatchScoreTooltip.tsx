import { MatchResult } from "@/lib/matching_engine";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  match: MatchResult;
  children: React.ReactNode;
}

const rows = [
  { key: "skill_match" as const, label: "Skills" },
  { key: "location_match" as const, label: "Location" },
  { key: "culture_fit" as const, label: "Culture" },
];

export default function MatchScoreTooltip({ match, children }: Props) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="w-52 p-3 space-y-2"
      >
        <p className="text-xs font-semibold mb-2">Match Breakdown</p>
        {rows.map((r) => {
          const val = match[r.key];
          return (
            <div key={r.key} className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium">{val}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="pt-1 border-t border-border mt-2">
          <div className="flex justify-between text-xs font-semibold">
            <span>Overall</span>
            <span className="text-primary">{match.overall_score}%</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
