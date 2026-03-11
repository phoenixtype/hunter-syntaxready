import { useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const FloatingThemeToggle = () => {
    const location = useLocation();

    // Pages that already have a theme toggle in their header
    const hiddenPaths = ["/", "/dashboard", "/auto-applier-settings", "/settings"];

    if (hiddenPaths.includes(location.pathname)) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
            <div className="bg-background/80 backdrop-blur-md border border-border shadow-lg rounded-full p-2" aria-label="Toggle color theme">
                <ThemeToggle />
            </div>
        </div>
    );
};

export default FloatingThemeToggle;
