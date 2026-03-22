import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";

export interface PageTourHandle {
  start: () => void;
}

interface PageTourProps {
  tourKey: string;
  steps: Step[];
}

const getCssVar = (name: string) => {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return `hsl(${val})`;
};

const PageTour = forwardRef<PageTourHandle, PageTourProps>(({ tourKey, steps }, ref) => {
  const [run, setRun] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { user } = useAuth();

  useImperativeHandle(ref, () => ({
    start: () => setRun(true),
  }));

  useEffect(() => {
    if (!user) return;
    const storageKey = `hunter_tour_${user.id}_${tourKey}`;
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [tourKey, user]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (user) {
        localStorage.setItem(`hunter_tour_${user.id}_${tourKey}`, "done");
      }
    }
  };

  const bg = getCssVar("--card");
  const fg = getCssVar("--card-foreground");
  const primary = getCssVar("--primary");
  const mutedFg = getCssVar("--muted-foreground");

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      scrollToFirstStep
      disableOverlayClose
      styles={{
        options: {
          primaryColor: primary,
          backgroundColor: bg,
          textColor: fg,
          arrowColor: bg,
          overlayColor: "rgba(0,0,0,0.55)",
          zIndex: 9999,
        },
        tooltip: {
          borderRadius: 8,
          padding: "16px 20px",
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.6)"
            : "0 8px 32px rgba(0,0,0,0.15)",
        },
        buttonNext: {
          borderRadius: 6,
          fontSize: 13,
          padding: "8px 16px",
        },
        buttonBack: {
          borderRadius: 6,
          fontSize: 13,
          color: mutedFg,
        },
        buttonSkip: {
          fontSize: 12,
          color: mutedFg,
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
});

PageTour.displayName = "PageTour";
export default PageTour;
