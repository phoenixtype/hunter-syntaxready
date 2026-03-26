import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Briefcase,
  FileText,
  User,
  Search,
  GraduationCap,
  FolderOpen,
  Home,
  Shield,
  Scale,
  Zap,
  Clock,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCommandHistory } from "@/hooks/useCommandHistory";

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
  group: "navigation" | "tools" | "settings";
}

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recentIds, frequentIds, recordUsage } = useCommandHistory();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate]
  );

  const actions: CommandAction[] = useMemo(() => {
    const base: CommandAction[] = [
      { id: "home", label: "Home", description: "Go to landing page", icon: Home, action: () => go("/"), keywords: ["landing", "main"], group: "navigation" },
    ];

    if (user) {
      base.push(
        { id: "dashboard", label: "Dashboard", description: "Job feed & applications", icon: Briefcase, action: () => go("/dashboard"), keywords: ["jobs", "feed"], group: "navigation" },
        { id: "profile", label: "Profile", description: "Edit your candidate profile", icon: User, action: () => go("/profile"), keywords: ["resume", "experience", "skills"], group: "navigation" },
        { id: "tailored-resumes", label: "My Tailored Resumes", description: "View saved resumes & cover letters", icon: FolderOpen, action: () => go("/tailored-resumes"), keywords: ["download", "pdf"], group: "navigation" },
        { id: "resume-builder", label: "Resume Builder", description: "Build & optimize your resume", icon: FileText, action: () => go("/resume-builder"), keywords: ["cv", "build", "create"], group: "tools" },
        { id: "interview-coach", label: "Interview Coach", description: "Practice with AI mock interviews", icon: GraduationCap, action: () => go("/interview-coach"), keywords: ["practice", "mock", "prep"], group: "tools" },
        { id: "application-wizard", label: "Application Wizard", description: "Search & apply to jobs", icon: Search, action: () => go("/application-wizard"), keywords: ["search", "find", "apply"], group: "tools" },
        { id: "auto-applier", label: "Auto-Applier Settings", description: "Configure automated applications", icon: Zap, action: () => go("/auto-applier-settings"), keywords: ["automation", "preferences"], group: "settings" },
      );
    }

    base.push(
      { id: "privacy", label: "Privacy Policy", icon: Shield, action: () => go("/privacy"), keywords: ["data", "gdpr"], group: "settings" },
      { id: "terms", label: "Terms of Service", icon: Scale, action: () => go("/terms"), keywords: ["legal", "tos"], group: "settings" },
    );

    return base;
  }, [user, go]);

  const actionsMap = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);

  const handleSelect = useCallback(
    (action: CommandAction) => {
      recordUsage(action.id);
      action.action();
    },
    [recordUsage]
  );

  const recentActions = recentIds.map((id) => actionsMap.get(id)).filter(Boolean) as CommandAction[];
  const frequentActions = frequentIds
    .filter((id) => !recentIds.includes(id))
    .map((id) => actionsMap.get(id))
    .filter(Boolean) as CommandAction[];

  const showSmartSections = !query && (recentActions.length > 0 || frequentActions.length > 0);

  const navActions = actions.filter((a) => a.group === "navigation");
  const toolActions = actions.filter((a) => a.group === "tools");
  const settingsActions = actions.filter((a) => a.group === "settings");

  const renderItem = (item: CommandAction, overrideIcon?: React.ComponentType<{ className?: string }>) => {
    const Icon = overrideIcon || item.icon;
    return (
      <CommandItem
        key={item.id}
        value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
        onSelect={() => handleSelect(item)}
        className="group"
      >
        <div className="flex items-center gap-4 w-full">
          <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 group-data-[selected=true]:bg-primary/10 transition-colors">
            <Icon className="h-[18px] w-[18px] text-primary/70 group-data-[selected=true]:text-primary transition-colors" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-[13.5px] leading-tight">{item.label}</span>
            {item.description && (
              <span className="text-[11.5px] text-muted-foreground/60 mt-0.5 truncate">{item.description}</span>
            )}
          </div>
        </div>
      </CommandItem>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search..."
        className="focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="pb-4">
        <CommandEmpty className="py-12 flex flex-col items-center gap-2">
          <Search className="w-8 h-8 text-muted-foreground/20" />
          <p className="text-muted-foreground/50 font-medium">No results found.</p>
        </CommandEmpty>

        {showSmartSections && (
          <>
            {recentActions.length > 0 && (
              <CommandGroup heading="Recent">
                {recentActions.map((item) => renderItem(item, Clock))}
              </CommandGroup>
            )}
            {frequentActions.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Frequently Used">
                  {frequentActions.map((item) => renderItem(item, Star))}
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
          </>
        )}

        {navActions.length > 0 && (
          <CommandGroup heading="Navigation">
            {navActions.map((item) => renderItem(item))}
          </CommandGroup>
        )}

        {toolActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tools">
              {toolActions.map((item) => renderItem(item))}
            </CommandGroup>
          </>
        )}

        {settingsActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Settings & Legal">
              {settingsActions.map((item) => renderItem(item))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
