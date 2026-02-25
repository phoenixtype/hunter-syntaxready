import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, FileText, Bot, Zap, Shield, Users, Star, ChevronRight } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

const FEATURES = [
  {
    icon: Briefcase,
    title: "Smart Job Discovery",
    desc: "AI crawls LinkedIn, Y Combinator, and hidden job boards to surface roles perfectly matched to your skills.",
  },
  {
    icon: Bot,
    title: "Auto-Apply",
    desc: "One click to apply. Hunter tailors your resume, writes your cover letter, and submits — all on autopilot.",
  },
  {
    icon: FileText,
    title: "Resume Builder",
    desc: "Build a polished, ATS-optimized resume through a guided flow. Multiple templates to choose from.",
  },
  {
    icon: Zap,
    title: "Interview Prep",
    desc: "Deep intel on interviewers, company culture, and role-specific preparation guides before every call.",
  },
  {
    icon: Shield,
    title: "Compliance & Safety",
    desc: "Built-in rate limiting and anti-detection. Apply aggressively without getting flagged or banned.",
  },
  {
    icon: Users,
    title: "Hiring Team Intel",
    desc: "Discover recruiters and hiring managers. Get direct contact info and optimal outreach strategies.",
  },
];

const TESTIMONIALS = [
  {
    name: "Sarah K.",
    role: "Software Engineer → Google",
    quote: "Hunter found roles I never would have seen. Got 3 interviews in the first week and an offer within a month.",
    rating: 5,
  },
  {
    name: "Marcus T.",
    role: "Product Manager → Stripe",
    quote: "The auto-apply feature saved me 20+ hours a week. I was applying to 50 jobs while sleeping. Absolute game changer.",
    rating: 5,
  },
  {
    name: "Priya R.",
    role: "Data Scientist → Meta",
    quote: "Interview prep was incredible. It knew exactly what questions to expect. I felt more prepared than ever.",
    rating: 5,
  },
];

const STATS = [
  { value: "50K+", label: "Jobs discovered" },
  { value: "20hrs", label: "Saved per week" },
  { value: "3.2x", label: "More interviews" },
  { value: "89%", label: "Success rate" },
];

const Index = () => {
  const { user, loading } = useAuth();
  const isAuthenticated = !loading && !!user;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SkipLink />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border" role="navigation" aria-label="Main navigation">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Hunter AI Home">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">H</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Hunter</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="sm" className="px-5 h-9 font-medium rounded-lg">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="px-5 h-9 font-medium rounded-lg">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <MobileNav isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </nav>

      <main id="main-content">
        {/* Hero */}
        <section className="pt-32 sm:pt-40 pb-20 md:pb-28">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-8 animate-fade-in">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
              Now in open beta — Join free
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-fadeInUp leading-[1.1]" style={{ animationDelay: "0.1s" }}>
              Your career on
              <br />
              <span className="text-primary">autopilot.</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
              Hunter discovers hidden opportunities, tailors every application to beat ATS filters, and preps you for interviews — so you focus on what matters.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
              {isAuthenticated ? (
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-base font-semibold rounded-lg gap-2">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-base font-semibold rounded-lg gap-2">
                      Start For Free <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/login" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 h-12 text-base rounded-lg font-medium">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 sm:gap-12 mt-16 animate-fadeInUp" style={{ animationDelay: "0.4s" }}>
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 border-t border-border" aria-labelledby="features-heading">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Everything you need to land your next role
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Hunter handles the tedious parts of job searching so you can focus on what matters — your career.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="group p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 bg-muted/30 border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                How it works
              </h2>
              <p className="text-lg text-muted-foreground">Three steps to your next job offer.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "01", title: "Build your profile", desc: "Walk through a guided flow to enter your experience, skills, and education. Hunter crafts your resume for you." },
                { step: "02", title: "Set your targets", desc: "Tell us what roles you want, where you want to work, and your salary expectations. We do the rest." },
                { step: "03", title: "Watch offers come in", desc: "Hunter discovers, applies, and prepares you for interviews — automatically. Review everything before it goes out." },
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="text-5xl font-extrabold text-primary/15 mb-4">{item.step}</div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                People are landing jobs with Hunter
              </h2>
              <p className="text-lg text-muted-foreground">Join thousands who've transformed their job search.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="p-6 rounded-xl border border-border bg-card">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-primary/5 border-t border-border">
          <div className="container max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to land your dream job?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Stop scrolling job boards. Let AI do the heavy lifting while you prepare for interviews.
            </p>
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="lg" className="px-10 h-12 text-base font-semibold rounded-lg gap-2">
                  Go to Dashboard <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/signup">
                <Button size="lg" className="px-10 h-12 text-base font-semibold rounded-lg gap-2">
                  Get Started Free <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 border-t border-border" role="contentinfo">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">H</span>
              </div>
              <span className="font-semibold">Hunter</span>
            </div>
            <nav className="flex gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </nav>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Hunter AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
