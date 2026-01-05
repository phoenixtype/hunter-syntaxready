import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-primary selection:text-primary-foreground font-sans">
      <SkipLink />

      {/* Navigation - Responsive with hamburger menu */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10" role="navigation" aria-label="Main navigation">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 touch-manipulation" aria-label="Hunter AI Home">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg sm:text-xl">h.</div>
            <span className="text-lg sm:text-xl font-bold tracking-tighter">hunter.</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <ThemeToggle />
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-2"
            >
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm" className="rounded-full px-6 h-10 touch-manipulation">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <MobileNav />
          </div>
        </div>
      </nav>

      {/* Hero Section - Mobile-first responsive */}
      <main id="main-content">
        <section className="relative pt-24 sm:pt-32 pb-16 md:pt-48 md:pb-32 overflow-hidden">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
            {/* Beta Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-secondary text-secondary-foreground/80 text-xs font-medium mb-6 sm:mb-8 animate-fade-in"
              role="status"
              aria-label="Beta status"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Accepting beta users
            </div>

            {/* Headline - Responsive typography */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 sm:mb-8 animate-fadeInUp leading-tight" style={{ animationDelay: "0.1s" }}>
              Your Career, <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">
                Autopilot.
              </span>
            </h1>

            {/* Subheadline - Improved readability */}
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-xl sm:max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed animate-fadeInUp px-2" style={{ animationDelay: "0.2s" }}>
              The agentic AI system that autonomously manages job discovery, applications, and interview prep.
            </p>

            {/* CTA Buttons - Larger touch targets */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fadeInUp px-4" style={{ animationDelay: "0.3s" }}>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="rounded-full min-h-[48px] w-full sm:w-auto px-8 text-lg font-semibold touch-manipulation active:scale-[0.98] transition-transform shadow-lg hover:shadow-xl"
                >
                  Start Hunting <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/login?demo=true" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full min-h-[48px] w-full sm:w-auto px-8 text-lg bg-transparent border-primary/20 hover:bg-secondary/50 touch-manipulation active:scale-[0.98] transition-transform"
                >
                  View Demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Abstract Background Element */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] md:w-[800px] h-[400px] sm:h-[600px] md:h-[800px] bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl -z-10 opacity-60"
            aria-hidden="true"
          ></div>
        </section>

        {/* Value Props - Responsive grid */}
        <section className="py-16 sm:py-20 md:py-24 border-t border-border/50 bg-secondary/20" aria-labelledby="features-heading">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <h2 id="features-heading" className="sr-only">Key Features</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12">
              {[
                {
                  title: "Discover",
                  desc: "Real-time crawling of hidden roles and unlisted opportunities.",
                },
                {
                  title: "Apply",
                  desc: "Autonomous application submission with tailored resumes.",
                },
                {
                  title: "Prepare",
                  desc: "Deep intelligence on interviewers and role-specific prep.",
                }
              ].map((feature, i) => (
                <article
                  key={i}
                  className="space-y-3 sm:space-y-4 p-4 sm:p-0 rounded-xl sm:rounded-none bg-background/50 sm:bg-transparent"
                >
                  <div
                    className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center border border-border/50 shadow-sm"
                    aria-hidden="true"
                  >
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Responsive layout */}
      <footer className="py-8 sm:py-12 border-t border-border/50" role="contentinfo">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p className="order-2 sm:order-1">© 2025 Hunter AI. All rights reserved.</p>
          <nav className="order-1 sm:order-2 flex gap-4 sm:gap-6" aria-label="Footer navigation">
            <Link to="/privacy" className="hover:text-primary transition-colors py-2 touch-manipulation">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors py-2 touch-manipulation">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Index;
