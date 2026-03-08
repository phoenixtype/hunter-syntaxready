import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { SlidersHorizontal, X } from "lucide-react";

export type WorkMode = "all" | "remote" | "hybrid" | "onsite";
export type ExperienceLevel = "all" | "entry" | "mid" | "senior" | "lead";
export type DatePosted = "all" | "24h" | "week" | "month";
export type JobType = "all" | "fulltime" | "contract" | "parttime";

export interface JobFilters {
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  minSalary: number; // in thousands USD, 0 = any
  datePosted: DatePosted;
  jobType: JobType;
}

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const EXP_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "all", label: "All" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead/Staff" },
];

const DATE_POSTED_OPTIONS: { value: DatePosted; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Last 24h" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

export const DEFAULT_FILTERS: JobFilters = {
  workMode: "all",
  experienceLevel: "all",
  minSalary: 0,
  datePosted: "all",
};

interface JobFiltersBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

export const hasActiveFilters = (filters: JobFilters): boolean =>
  filters.workMode !== "all" || filters.experienceLevel !== "all" || filters.minSalary > 0 || filters.datePosted !== "all";

const JobFiltersBar = ({ filters, onChange }: JobFiltersBarProps) => {
  const [open, setOpen] = useState(false);
  const active = hasActiveFilters(filters);

  const activeCount = [
    filters.workMode !== "all",
    filters.experienceLevel !== "all",
    filters.minSalary > 0,
    filters.datePosted !== "all",
  ].filter(Boolean).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={active ? "default" : "outline"}
          size="sm"
          className="h-10 px-3 shrink-0 gap-1.5"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-4 bg-popover border border-border shadow-lg z-50"
        align="start"
        sideOffset={8}
      >
        <div className="space-y-5">
          {/* Work Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Work Mode</label>
            <div className="flex flex-wrap gap-1.5">
              {WORK_MODES.map((mode) => (
                <Button
                  key={mode.value}
                  variant={filters.workMode === mode.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => onChange({ ...filters, workMode: mode.value })}
                >
                  {mode.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Experience Level */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Experience Level</label>
            <div className="flex flex-wrap gap-1.5">
              {EXP_LEVELS.map((level) => (
                <Button
                  key={level.value}
                  variant={filters.experienceLevel === level.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => onChange({ ...filters, experienceLevel: level.value })}
                >
                  {level.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Posted */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Date Posted</label>
            <div className="flex flex-wrap gap-1.5">
              {DATE_POSTED_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={filters.datePosted === opt.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => onChange({ ...filters, datePosted: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Min Salary */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Min Salary</label>
              <span className="text-xs font-mono text-muted-foreground">
                {filters.minSalary === 0 ? "Any" : `$${filters.minSalary}k+`}
              </span>
            </div>
            <Slider
              value={[filters.minSalary]}
              onValueChange={([val]) => onChange({ ...filters, minSalary: val })}
              min={0}
              max={300}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Any</span>
              <span>$300k+</span>
            </div>
          </div>

          {/* Clear */}
          {active && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-muted-foreground"
              onClick={() => onChange(DEFAULT_FILTERS)}
            >
              <X className="w-3 h-3 mr-1" />
              Clear all filters
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default JobFiltersBar;
