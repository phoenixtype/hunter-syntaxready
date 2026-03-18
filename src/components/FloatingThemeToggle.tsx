import { useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const FloatingThemeToggle = () => {
    const location = useLocation();

    // Pages that already have a theme toggle in their header, or use a full-screen layout
    const hiddenPaths = ["/", "/dashboard", "/auto-applier-settings", "/settings"];
    const hiddenPrefixes = ["/recruiter", "/admin"];

    if (
      hiddenPaths.includes(location.pathname) ||
      hiddenPrefixes.some((p) => location.pathname.startsWith(p))
    ) {
        return null;
    }

    return (
        <div className="fixed bottom-20 right-6 z-40 animate-fade-in">
            <div className="bg-background/80 backdrop-blur-md border border-border shadow-lg rounded-full p-2" aria-label="Toggle color theme">
                <ThemeToggle />
            </div>
        </div>
    );
};

export default FloatingThemeToggle;
