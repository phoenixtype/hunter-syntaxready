import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COOKIE_KEY = "cookie_consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = (value: "all" | "essential") => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ consent: value, date: new Date().toISOString() }));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg md:left-6 md:right-auto"
        >
          <button onClick={() => accept("essential")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-sm text-foreground leading-relaxed">
                We use cookies for authentication and to improve your experience. See our{" "}
                <a href="/privacy" className="underline underline-offset-2 text-primary hover:text-primary/80">Privacy Policy</a>.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => accept("all")}>Accept All</Button>
                <Button size="sm" variant="outline" onClick={() => accept("essential")}>Essential Only</Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
