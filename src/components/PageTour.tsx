import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useTheme } from "next-themes";

export interface PageTourHandle {
  start: () => void;
}

interface PageTourProps {
  tourKey: string;
  steps: Step[];
}

const PageTour = forwardRef<PageTourHandle, PageTourProps>(({ tourKey, steps }, ref) => {
  const [run, setRun] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useImperativeHandle(ref, () => ({
    start: () => setRun(true),
  }));

  useEffect(() => {
    const storageKey = `hunter_tour_${tourKey}`;
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [tourKey]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(`hunter_tour_${tourKey}`, "done");
    }
  };

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
          primaryColor: "hsl(var(--primary))",
          backgroundColor: isDark ? "hsl(222 47% 11%)" : "hsl(0 0% 100%)",
          textColor: isDark ? "hsl(210 40% 98%)" : "hsl(222 47% 11%)",
          arrowColor: isDark ? "hsl(222 47% 11%)" : "hsl(0 0% 100%)",
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
          color: isDark ? "hsl(210 40% 70%)" : "hsl(215 20% 45%)",
        },
        buttonSkip: {
          fontSize: 12,
          color: isDark ? "hsl(210 40% 60%)" : "hsl(215 20% 55%)",
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
