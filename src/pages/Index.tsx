import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <SkipLink />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-white/5" role="navigation" aria-label="Main navigation">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" aria-label="Hunter AI Home">
            <span className="text-lg sm:text-xl font-bold tracking-tighter">hunter.</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <ThemeToggle />
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm" className="px-6 h-9 shadow-glow hover:shadow-glow-lg transition-all rounded-full font-medium">
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

      {/* Hero Section */}
      <main id="main-content">
        <section className="relative pt-24 sm:pt-32 pb-16 md:pt-48 md:pb-32">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6 text-center">
            {/* Beta Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-muted-foreground text-xs font-medium mb-6 sm:mb-8 animate-fade-in"
              role="status"
              aria-label="Beta status"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
              </span>
              Accepting beta users
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 sm:mb-8 animate-fadeInUp leading-tight" style={{ animationDelay: "0.1s" }}>
              Your Career, <br className="hidden sm:block" />
              Autopilot.
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-xl sm:max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed animate-fadeInUp px-2" style={{ animationDelay: "0.2s" }}>
              The agentic AI system that autonomously manages job discovery, applications, and interview prep.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fadeInUp px-4" style={{ animationDelay: "0.3s" }}>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 text-base font-medium shadow-glow hover:shadow-glow-lg transition-all rounded-full"
                >
                  Start Hunting <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/login?demo=true" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto px-8 text-base rounded-full border-primary/20 hover:bg-primary/10 text-primary transition-all font-medium"
                >
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="py-16 sm:py-20 md:py-24 border-t border-border" aria-labelledby="features-heading">
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
                  className="group space-y-3 sm:space-y-4 p-6 rounded-2xl border border-white/10 bg-card/50 backdrop-blur-md shadow-lg hover:border-primary/30 transition-all hover:translate-y-[-2px]"
                >
                  <div
                    className="w-12 h-12 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"
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

      {/* Footer */}
      <footer className="py-8 sm:py-12 border-t border-border" role="contentinfo">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p className="order-2 sm:order-1">© 2025 Hunter AI. All rights reserved.</p>
          <nav className="order-1 sm:order-2 flex gap-4 sm:gap-6" aria-label="Footer navigation">
            <Link to="/privacy" className="hover:text-foreground transition-colors py-2">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors py-2">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Index;
