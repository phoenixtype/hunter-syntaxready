import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Zap,
  Shield,
  Users,
  Star,
  ChevronRight,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { useGeo } from '@/hooks/useGeo';
import { getPaymentBadge } from '@/lib/pricing';

const FEATURES = [
  { icon: Briefcase, title: "Smart Job Discovery", desc: "Searches real job boards in real time to surface roles matched to your skills, target titles, and location." },
  { icon: FileText, title: "AI Resume Builder", desc: "Build a polished, ATS-optimised resume through a guided flow. AI generates professional copy from your experience." },
  { icon: Zap, title: "One-Click Tailoring", desc: "Hunter rewrites your resume bullets and writes a cover letter matched to any specific job in seconds." },
  { icon: Shield, title: "ATS Compatibility Check", desc: "Scores your resume against applicant tracking systems before you apply, so you know it will actually be read." },
  { icon: Users, title: "Hiring Team Intel", desc: "Find recruiters and hiring managers at target companies with direct LinkedIn search links for every role." },
  { icon: Star, title: "Interview Coach", desc: "Practice behavioral, technical, and salary negotiation scenarios with an AI coach tailored to your target role." },
];

const TESTIMONIALS = [
  { name: "Alex M.", role: "Software Engineer → Staff Engineer", quote: "The resume tailoring is genuinely good. It mirrors the job description language without being obvious — my callback rate went up noticeably.", rating: 5, avatar: "AM" },
  { name: "Jordan T.", role: "Product Manager, Series B Startup", quote: "Having the hiring team search links right on the job card is a huge time saver. I can reach out to the right person immediately.", rating: 5, avatar: "JT" },
  { name: "Priya R.", role: "Data Scientist, Fortune 500", quote: "The interview coach is what I was missing. Being able to practice negotiation scenarios before the real call gave me so much more confidence.", rating: 5, avatar: "PR" },
];

const STATS = [
  { value: "1,200+", label: "Jobs crawled daily" },
  { value: "<45s", label: "To tailor any application" },
  { value: "3 modes", label: "Interview practice" },
  { value: "ATS-ready", label: "Every resume generated" },
];

const TRUST_BADGES = ["Cancel anytime", "Secure payments via Stripe", "Built for serious job seekers"];

const COMPARISON = [
  { feature: "Job discovery", hunter: "AI-matched from live boards", manual: "Scroll through boards manually", other: "Basic keyword alerts" },
  { feature: "Resume tailoring", hunter: "AI rewrites per job in seconds", manual: "Manual rewrite each time", other: "Template fill-in" },
  { feature: "Interview prep", hunter: "AI coach with role-specific Q&A", manual: "Google common questions", other: "Generic tips" },
  { feature: "Hiring team intel", hunter: "Auto-found with LinkedIn links", manual: "Manual LinkedIn searching", other: "Not available" },
];

const Index = () => {
  const { user, loading } = useAuth();
  const isAuthenticated = !loading && !!user;
  const { isNigeria } = useGeo();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        }
      });
    }, { threshold: 0.1 });

    const revealElements = document.querySelectorAll(".reveal");
    revealElements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  const trustBadges = TRUST_BADGES.map(badge =>
    badge === 'Secure payments via Stripe' ? getPaymentBadge(isNigeria) : badge
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SEOHead path="/" />
      <SkipLink />

      {/* MD3 Top App Bar — Elevated, white, shadow on scroll */}
      <nav
        className="fixed top-0 w-full z-50 bg-card border-b border-border shadow-md-1"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo — MD3 brand mark */}
          <Link to="/" className="flex items-center gap-2.5" aria-label="Hunter AI Home">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-md-1">
              <span className="text-primary-foreground font-bold text-base leading-none">H</span>
            </div>
            <span className="text-lg font-medium tracking-tight text-foreground">Hunter</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/dashboard" className="ml-2">
                <Button size="sm" className="px-6 h-9 font-medium rounded-full shadow-md-1">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors px-4 py-2 rounded-full"
                >
                  Log in
                </Link>
                <Link to="/signup" className="ml-1">
                  <Button size="sm" className="px-6 h-9 font-medium rounded-full shadow-md-1">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <MobileNav isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </nav>

      <main id="main-content">

        {/* ── Hero ── MD3 Display typography, tonal chip, pill buttons */}
        <section className="relative pt-28 sm:pt-40 pb-20 md:pb-28 overflow-hidden bg-background">
          {/* Animated Background Blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] animate-blob" />
            <div className="absolute top-[20%] -right-[10%] w-[35%] h-[35%] rounded-full bg-secondary/30 blur-[100px] animate-blob animation-delay-2000" />
            <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[80px] animate-blob animation-delay-4000" />
          </div>

          <div className="container max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
            {/* MD3 Assist chip */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium border border-primary/20 mb-8 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Now in open beta — Join free
            </div>

            {/* MD3 Display Large */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight leading-[1.06] text-foreground mb-6 animate-fade-in-up">
              Build <span className="font-medium text-primary">skills</span> while we find the <span className="font-medium text-primary">job you desire.</span>
            </h1>

            {/* MD3 Body Large */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up [animation-delay:200ms] opacity-0 [animation-fill-mode:forwards]">
              Accelerate your career with Hunter. Master high-demand skills through AI coaching while our engine discovers and tailors your path to the perfect role.
            </p>

            {/* Floating Mock UI element (hidden on small mobile) */}
            <div className="hidden lg:block absolute -right-20 top-20 w-64 p-4 rounded-2xl bg-card border border-border shadow-elevated animate-float opacity-0 [animation-fill-mode:forwards] [animation-delay:600ms]">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                   <Zap className="w-4 h-4 text-green-600" />
                 </div>
                 <div className="flex-1">
                   <div className="h-2 w-20 bg-muted rounded mb-1" />
                   <div className="h-1.5 w-12 bg-muted/60 rounded" />
                 </div>
                 <span className="text-xs font-bold text-green-600">98% Match</span>
               </div>
               <div className="space-y-2">
                 <div className="h-2 w-full bg-muted/40 rounded" />
                 <div className="h-2 w-full bg-muted/40 rounded" />
                 <div className="h-2 w-[80%] bg-muted/40 rounded" />
               </div>
            </div>

            {/* MD3 Filled + Outlined buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 animate-fade-in-up [animation-delay:400ms] opacity-0 [animation-fill-mode:forwards]">
              {isAuthenticated ? (
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-[0.9375rem] font-medium rounded-full gap-2 shadow-md-1">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-[0.9375rem] font-medium rounded-full gap-2 shadow-md-1">
                      Start For Free <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/login" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto px-8 h-12 text-[0.9375rem] rounded-full font-medium border-border hover:bg-muted"
                    >
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground animate-fade-in [animation-delay:800ms] opacity-0 [animation-fill-mode:forwards]">
              {trustBadges.map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Stats bar — MD3 tonal surface container */}
          <div className="container max-w-4xl mx-auto px-4 sm:px-6 mt-20 reveal">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden shadow-md-1 hover:shadow-md-2 transition-shadow duration-300">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-card px-6 py-6 text-center">
                  <div className="text-2xl sm:text-3xl font-medium text-primary">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* ── Features ── MD3 Elevated Cards */}
        <section className="py-24 bg-card border-t border-border reveal" aria-labelledby="features-heading">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Features</p>
              <h2
                id="features-heading"
                className="text-3xl sm:text-4xl font-normal tracking-tight mb-4"
              >
                Everything you need to land your next role
              </h2>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                Hunter handles the tedious parts of job searching so you can focus on what matters — your career.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature, i) => (
                <article
                  key={feature.title}
                  className="group p-6 rounded-2xl border border-border bg-background hover:shadow-lg hover:border-primary/25 transition-all duration-300 transform hover:-translate-y-1 reveal"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  {/* MD3 Icon container — tonal surface */}
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-[0.9375rem] font-medium mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison ── MD3 Data table inside Elevated card */}
        <section className="py-24 bg-background border-t border-border reveal">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Why Hunter</p>
              <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mb-4">
                How Hunter compares
              </h2>
              <p className="text-base text-muted-foreground">
                See why candidates switch from manual job searching.
              </p>
            </div>

            {/* MD3 Elevated Card wrapping the table */}
            <div className="rounded-2xl border border-border bg-white/50 dark:bg-card/50 backdrop-blur-sm overflow-hidden shadow-md-1 hover:shadow-lg transition-all duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="text-left py-4 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/4">
                        Feature
                      </th>
                      <th className="text-left py-4 px-5 w-1/4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md-1">
                            <span className="text-primary-foreground font-bold text-[10px]">H</span>
                          </div>
                          <span className="font-semibold text-primary">Hunter</span>
                        </div>
                      </th>
                      <th className="text-left py-4 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/4">
                        Manual Search
                      </th>
                      <th className="text-left py-4 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/4">
                        Other Tools
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row, i) => (
                      <tr
                        key={row.feature}
                        className={`border-b border-border last:border-0 transition-colors hover:bg-muted/40 ${
                          i % 2 === 1 ? "bg-muted/20" : ""
                        }`}
                      >
                        <td className="py-4 px-5 font-medium text-foreground">{row.feature}</td>
                        <td className="py-4 px-5 font-medium text-primary">{row.hunter}</td>
                        <td className="py-4 px-5 text-muted-foreground">{row.manual}</td>
                        <td className="py-4 px-5 text-muted-foreground">{row.other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── MD3 step indicators */}
        <section className="py-24 bg-card border-t border-border reveal">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Process</p>
              <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mb-4">
                How it works
              </h2>
              <p className="text-base text-muted-foreground">Three steps to your next job offer.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-6 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-border" aria-hidden="true" />

              {[
                { step: "1", title: "Build your profile", desc: "Walk through a guided flow to enter your experience, skills, and education. Hunter generates a polished, ATS-ready resume." },
                { step: "2", title: "Find matching roles", desc: "Tell Hunter what roles you want and where. It searches live job boards and ranks matches by fit in real time." },
                { step: "3", title: "Apply with confidence", desc: "Tailor any application in seconds, prep with an AI interview coach, and track every application in one place." },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center md:items-start md:text-left relative">
                  {/* MD3 Filled icon step button */}
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium mb-5 shadow-md-2 flex-shrink-0 relative z-10">
                    {item.step}
                  </div>
                  <h3 className="text-[0.9375rem] font-medium mb-2 text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── MD3 Elevated Cards */}
        <section className="py-24 bg-background border-t border-border reveal">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mb-4">
                What users are saying
              </h2>
              <p className="text-base text-muted-foreground">
                Early users on what's actually working for them.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="p-6 rounded-2xl border border-border bg-card hover:shadow-md-2 hover:border-primary/20 transition-all duration-200 flex flex-col"
                >
                  {/* Stars — Google yellow #fbbc05 */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-[#fbbc05] text-[#fbbc05]" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-6 flex-1">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    {/* MD3 Avatar — circular tonal container */}
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">{t.avatar}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ── CTA ── MD3 Tonal Surface container */}
        <section className="py-24 bg-background border-t border-border reveal">
          <div className="container max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="bg-secondary rounded-3xl px-8 py-14 sm:px-14 sm:py-16 border border-primary/15">
              <h2 className="text-3xl sm:text-4xl font-normal tracking-tight mb-4 text-foreground">
                Ready to land your dream job?
              </h2>
              <p className="text-base text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
                Stop scrolling job boards. Let AI do the heavy lifting while you prepare for interviews.
              </p>
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button size="lg" className="px-10 h-12 text-[0.9375rem] font-medium rounded-full gap-2 shadow-md-2">
                    Go to Dashboard <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link to="/signup">
                  <Button size="lg" className="px-10 h-12 text-[0.9375rem] font-medium rounded-full gap-2 shadow-md-2">
                    Get Started Free <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
