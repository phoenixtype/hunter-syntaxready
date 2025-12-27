
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="container max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tighter">hunter.</div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm" className="rounded-full px-6">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="container max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-secondary text-secondary-foreground/80 text-xs font-medium mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Accepting beta users
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
            Your Career, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/50">
              Autopilot.
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
            The agentic AI system that autonomously manages job discovery, applications, and interview prep.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
            <Link to="/signup">
              <Button size="lg" className="rounded-full h-12 px-8 text-base">
                Start Hunting <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login?demo=true">
              <Button variant="outline" size="lg" className="rounded-full h-12 px-8 text-base bg-transparent border-primary/20 hover:bg-secondary/50">
                View Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Abstract Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl -z-10 opacity-60"></div>
      </section>

      {/* Value Props */}
      <section className="py-24 border-t border-border/50 bg-secondary/20">
        <div className="container max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12">
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
              <div key={i} className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center border border-border/50 shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container max-w-5xl mx-auto px-6 flex justify-between items-center text-sm text-muted-foreground">
          <p>© 2025 Hunter AI. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
