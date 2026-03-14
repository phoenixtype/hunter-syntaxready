import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, FileText, Zap, Shield, Users, Star, ChevronRight, CheckCircle2 } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";


const FEATURES = [
  { icon: Briefcase, title: "Smart Job Discovery", desc: "Searches real job boards in real time to surface roles matched to your skills, target titles, and location." },
  { icon: FileText, title: "AI Resume Builder", desc: "Build a polished, ATS-optimised resume through a guided flow. AI generates professional copy from your experience." },
  { icon: Zap, title: "One-Click Tailoring", desc: "Hunter rewrites your resume bullets and writes a cover letter matched to any specific job in seconds." },
  { icon: Shield, title: "ATS Compatibility Check", desc: "Scores your resume against applicant tracking systems before you apply, so you know it will actually be read." },
  { icon: Users, title: "Hiring Team Intel", desc: "Find recruiters and hiring managers at target companies with direct LinkedIn search links for every role." },
  { icon: Star, title: "Interview Coach", desc: "Practice behavioral, technical, and salary negotiation scenarios with an AI coach tailored to your target role." },
];

const TESTIMONIALS = [
  {
    name: "Alex M.",
    role: "Software Engineer → Staff Engineer",
    quote: "The resume tailoring is genuinely good. It mirrors the job description language without being obvious — my callback rate went up noticeably.",
    rating: 5,
    avatar: "AM",
  },
  {
    name: "Jordan T.",
    role: "Product Manager, Series B Startup",
    quote: "Having the hiring team search links right on the job card is a huge time saver. I can reach out to the right person immediately.",
    rating: 5,
    avatar: "JT",
  },
  {
    name: "Priya R.",
    role: "Data Scientist, Fortune 500",
    quote: "The interview coach is what I was missing. Being able to practice negotiation scenarios before the real call gave me so much more confidence.",
    rating: 5,
    avatar: "PR",
  },
];

const STATS = [
  { value: "1,200+", label: "Jobs crawled daily" },
  { value: "<45s", label: "To tailor any application" },
  { value: "3 modes", label: "Interview practice" },
  { value: "ATS-ready", label: "Every resume generated" },
];

const TRUST_BADGES = ["No credit card required", "Cancel anytime", "Free tier available"];

const COMPARISON = [
  { feature: "Job discovery", hunter: "AI-matched from live boards", manual: "Scroll through boards manually", other: "Basic keyword alerts" },
  { feature: "Resume tailoring", hunter: "AI rewrites per job in seconds", manual: "Manual rewrite each time", other: "Template fill-in" },
  { feature: "Interview prep", hunter: "AI coach with role-specific Q&A", manual: "Google common questions", other: "Generic tips" },
  { feature: "Hiring team intel", hunter: "Auto-found with LinkedIn links", manual: "Manual LinkedIn searching", other: "Not available" },
];

const Index = () => {
  const { user, loading } = useAuth();
  const isAuthenticated = !loading && !!user;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground font-sans">
      <SEOHead path="/" />
      <SkipLink />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-sm border-b border-border" role="navigation" aria-label="Main navigation">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Hunter AI Home">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-base">H</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Hunter</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="sm" className="px-5 h-9 font-medium rounded-md">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="px-5 h-9 font-medium rounded-md">
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
        <section className="pt-28 sm:pt-40 pb-16 md:pb-28 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5" />
          </div>

          <div className="container max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                Now in open beta — Join free
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                Your career on
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">autopilot.</span>
              </h1>

              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
                Hunter discovers hidden opportunities, tailors every application to beat ATS filters, and preps you for interviews — so you focus on what matters.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {isAuthenticated ? (
                  <Link to="/dashboard" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto px-8 h-13 text-base font-semibold rounded-md gap-2">
                      Go to Dashboard <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full sm:w-auto px-8 h-13 text-base font-semibold rounded-md gap-2">
                        Start For Free <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to="/login" className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 h-13 text-base rounded-md font-medium">
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
                {TRUST_BADGES.map(badge => (
                  <span key={badge} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary/70" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div
              className="flex flex-wrap justify-center gap-8 sm:gap-14 mt-20"
            >
              {STATS.map((stat, i) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Product Demo Screenshot */}
            <div className="mt-20 relative">
              <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/50 border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                  <span className="ml-3 text-[10px] text-muted-foreground font-mono">hunter.app/dashboard</span>
                </div>
                <img
                  src="/images/image.png"
                  alt="Hunter AI dashboard showing job listings with match scores, filters, and application tracking"
                  className="w-full"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-primary/10 rounded-full" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 border-t border-border" aria-labelledby="features-heading">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Everything you need to land your next role
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Hunter handles the tedious parts of job searching so you can focus on what matters — your career.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feature, i) => (
                <article
                  key={feature.title}
                  className="group p-6 rounded-md border border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center mb-3">
                    <feature.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-2 ">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-24 bg-muted/30 border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                How Hunter compares
              </h2>
              <p className="text-lg text-muted-foreground">See why candidates switch from manual job searching.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 text-muted-foreground font-medium w-1/4">Feature</th>
                    <th className="text-left py-4 px-4 font-semibold text-primary w-1/4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                          <span className="text-primary-foreground font-bold text-[10px]">H</span>
                        </div>
                        Hunter
                      </div>
                    </th>
                    <th className="text-left py-4 px-4 text-muted-foreground font-medium w-1/4">Manual Search</th>
                    <th className="text-left py-4 px-4 text-muted-foreground font-medium w-1/4">Other Tools</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-b border-border">
                      <td className="py-4 px-4 font-medium">{row.feature}</td>
                      <td className="py-4 px-4 text-primary font-medium">{row.hunter}</td>
                      <td className="py-4 px-4 text-muted-foreground">{row.manual}</td>
                      <td className="py-4 px-4 text-muted-foreground">{row.other}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                How it works
              </h2>
              <p className="text-lg text-muted-foreground">Three steps to your next job offer.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { step: "01", title: "Build your profile", desc: "Walk through a guided flow to enter your experience, skills, and education. Hunter generates a polished, ATS-ready resume." },
                { step: "02", title: "Find matching roles", desc: "Tell Hunter what roles you want and where. It searches live job boards and ranks matches by fit in real time." },
                { step: "03", title: "Apply with confidence", desc: "Tailor any application in seconds, prep with an AI interview coach, and track every application in one place." },
              ].map((item, i) => (
                <div key={item.step} className="relative">
                  <div className="text-6xl font-extrabold text-primary/10 mb-4 leading-none">{item.step}</div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-muted/30 border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                What users are saying
              </h2>
              <p className="text-lg text-muted-foreground">Early users on what's actually working for them.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={t.name}
                  className="p-6 rounded-md border border-border bg-card hover:border-primary/20 transition-colors"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-5">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border border-border">
                      <span className="text-xs font-bold text-primary">{t.avatar}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 border-t border-border relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5" />
          </div>
          <div className="container max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to land your dream job?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                Stop scrolling job boards. Let AI do the heavy lifting while you prepare for interviews.
              </p>
              <div>
                {isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button size="lg" className="px-10 h-13 text-base font-semibold rounded-md gap-2">
                      Go to Dashboard <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/signup">
                    <Button size="lg" className="px-10 h-13 text-base font-semibold rounded-md gap-2">
                      Get Started Free <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
