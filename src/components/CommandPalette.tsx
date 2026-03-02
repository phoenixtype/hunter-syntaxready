import { useEffect, useState, useMemo } from "react";
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
  Settings,
  Search,
  GraduationCap,
  Bot,
  FolderOpen,
  Bell,
  LayoutGrid,
  Home,
  Shield,
  Scale,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
  group: "navigation" | "tools" | "settings" | "quick";
}

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const actions: CommandAction[] = useMemo(() => {
    const base: CommandAction[] = [
      {
        id: "home",
        label: "Home",
        description: "Go to landing page",
        icon: Home,
        action: () => go("/"),
        keywords: ["landing", "main"],
        group: "navigation",
      },
    ];

    if (user) {
      base.push(
        {
          id: "dashboard",
          label: "Dashboard",
          description: "Job feed & applications",
          icon: Briefcase,
          action: () => go("/dashboard"),
          keywords: ["jobs", "feed", "main", "home"],
          group: "navigation",
        },
        {
          id: "profile",
          label: "Profile",
          description: "Edit your candidate profile",
          icon: User,
          action: () => go("/profile"),
          keywords: ["resume", "experience", "skills", "education"],
          group: "navigation",
        },
        {
          id: "tailored-resumes",
          label: "My Tailored Resumes",
          description: "View saved resumes & cover letters",
          icon: FolderOpen,
          action: () => go("/tailored-resumes"),
          keywords: ["download", "pdf", "docx", "cover letter"],
          group: "navigation",
        },
        {
          id: "resume-builder",
          label: "Resume Builder",
          description: "Build & optimize your resume",
          icon: FileText,
          action: () => go("/resume-builder"),
          keywords: ["cv", "build", "create", "edit"],
          group: "tools",
        },
        {
          id: "interview-coach",
          label: "Interview Coach",
          description: "Practice with AI mock interviews",
          icon: GraduationCap,
          action: () => go("/interview-coach"),
          keywords: ["practice", "mock", "prep", "behavioral", "technical"],
          group: "tools",
        },
        {
          id: "application-wizard",
          label: "Application Wizard",
          description: "Search & apply to jobs",
          icon: Search,
          action: () => go("/application-wizard"),
          keywords: ["search", "find", "apply", "crawl"],
          group: "tools",
        },
        {
          id: "auto-applier",
          label: "Auto-Applier Settings",
          description: "Configure automated applications",
          icon: Zap,
          action: () => go("/auto-applier-settings"),
          keywords: ["automation", "preferences", "roles", "salary"],
          group: "settings",
        },
      );
    }

    base.push(
      {
        id: "privacy",
        label: "Privacy Policy",
        icon: Shield,
        action: () => go("/privacy"),
        keywords: ["data", "gdpr"],
        group: "settings",
      },
      {
        id: "terms",
        label: "Terms of Service",
        icon: Scale,
        action: () => go("/terms"),
        keywords: ["legal", "tos"],
        group: "settings",
      },
    );

    return base;
  }, [user]);

  const navActions = actions.filter((a) => a.group === "navigation");
  const toolActions = actions.filter((a) => a.group === "tools");
  const settingsActions = actions.filter((a) => a.group === "settings");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." className="focus:ring-0 focus:outline-none" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {navActions.length > 0 && (
          <CommandGroup heading="Navigation">
            {navActions.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={item.action}
              >
                <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {toolActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tools">
              {toolActions.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={item.action}
                >
                  <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {settingsActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Settings & Legal">
              {settingsActions.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={item.action}
                >
                  <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
