import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Send, Loader2, MoreHorizontal, PenTool, GraduationCap, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  isApplied: boolean;
  isApplying: boolean;
  isTailoring: boolean;
  jobUrl: string;
  onApply: () => void;
  onTailor: () => void;
  onPrep: () => void;
  onIntel: () => void;
  isExpanded: boolean;
}

export default function JobCardActions({
  isApplied,
  isApplying,
  isTailoring,
  jobUrl,
  onApply,
  onTailor,
  onPrep,
  onIntel,
  isExpanded,
}: Props) {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      <a
        href={isApplying ? undefined : (jobUrl || "#")}
        target={jobUrl ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="w-full sm:w-auto"
        onClick={(e) => {
          if (isApplying) {
            e.preventDefault();
            return;
          }
          if (isApplied) {
            // Allow navigation to the link
            return;
          }
          onApply();
        }}
      >
        <Button
          size="sm"
          variant={isApplied ? "secondary" : "default"}
          disabled={isApplying}
          className="w-full sm:w-auto h-9 text-xs px-5 gap-1.5 font-semibold"
        >
          {isApplied ? (
            <>
              <Send className="w-3 h-3" />
              Applied
            </>
          ) : isApplying ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <Send className="w-3 h-3" />
              Apply Now
            </>
          )}
        </Button>
      </a>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 text-xs px-3 gap-1.5">
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={onTailor} disabled={isTailoring}>
            <PenTool className="w-3.5 h-3.5 mr-2" />
            {isTailoring ? "Tailoring…" : "Tailor Resume"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPrep}>
            <GraduationCap className="w-3.5 h-3.5 mr-2" />
            Interview Prep
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onIntel}>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 mr-2" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 mr-2" />
            )}
            Hiring Intel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
