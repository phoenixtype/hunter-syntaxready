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
  GraduationCap,
  Bot,
  TrendingUp,
  Target,
  Sparkles,
  Building2,
  BarChart3,
} from "lucide-react";
import { createElement, useRef } from "react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { useGeo } from "@/hooks/useGeo";
import { getPrice } from "@/lib/pricing";

try { (globalThis as { __HUNTER_STEP__?: (n: string) => void }).__HUNTER_STEP__?.('Index:body-start'); } catch { /* ignore */ }

// ── Animation helpers (mobile-safe static fallback) ──────────────────────────

const STATIC_MOTION_PROPS = new Set([
  "animate",
  "custom",
  "exit",
  "initial",
  "transition",
  "variants",
  "viewport",
  "whileHover",
  "whileInView",
  "whileTap",
]);

const motion = new Proxy(
  {},
  {
    get: (_, tagName: string) => {
      return ({ children, ...props }: Record<string, any>) => {
        const safeProps = Object.fromEntries(
          Object.entries(props).filter(([key]) => !STATIC_MOTION_PROPS.has(key))
        );

        return createElement(tagName, safeProps, children);
      };
    },
  }
) as Record<string, (props: Record<string, any>) => JSX.Element>;

// Animation variants - only used if framer-motion loads successfully
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

// fadeIn variant removed (unused)

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className}>
      {children}
    </section>
  );
}

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className="tabular-nums">
      {Math.round(value).toLocaleString()}{suffix}
    </span>
  );
}

// Helper component for conditional motion elements
function MotionElement({
  as: Component = 'div',
  style = {},
  initial,
  animate,
  transition,
  className,
  children,
  ...props
}: {
  as?: keyof JSX.IntrinsicElements;
  style?: React.CSSProperties;
  initial?: any;
  animate?: any;
  transition?: any;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}) {
  const MotionComponent = motion[Component as keyof typeof motion] ?? Component;

  return (
    <MotionComponent
      style={style}
      initial={initial}
      animate={animate}
      transition={transition}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Briefcase,
    title: "Smart Job Discovery",
    desc: "AI searches real job boards in real time, ranks matches by fit, and delivers a personalized feed — no more endless scrolling.",
  },
  {
    icon: FileText,
    title: "AI Resume Builder",
    desc: "Build an ATS-optimized resume through a guided flow. Our AI generates professional bullets from your raw experience.",
  },
  {
    icon: Zap,
    title: "One-Click Tailoring",
    desc: "Rewrite your resume and generate a custom cover letter for any specific job — in seconds, not hours.",
  },
  {
    icon: Shield,
    title: "ATS Compatibility",
    desc: "Score your resume against applicant tracking systems before applying. Know your resume will actually be read by a human.",
  },
  {
    icon: GraduationCap,
    title: "Interview Coach",
    desc: "Practice behavioral, technical, and salary negotiation scenarios with an AI coach tailored to your target role.",
  },
  {
    icon: Bot,
    title: "Hunt Planner",
    desc: "Set your preferences once — target titles, locations, salary. hunter.ai surfaces the most relevant jobs and can apply on your behalf.",
  },
];

const SHOWCASE_SECTIONS = [
  {
    badge: "Discover",
    title: "Jobs matched to you, not keywords",
    desc: "hunter.ai crawls job boards in real time and ranks every role by how well it fits your skills, experience, and preferences. Your feed gets smarter over time.",
    points: [
      "Real-time crawling across multiple boards",
      "AI match scoring for every listing",
      "Personalized feed that improves with feedback",
    ],
    icon: Target,
  },
  {
    badge: "Apply",
    title: "Tailored applications in seconds",
    desc: "One click rewrites your resume bullets to mirror the job description language and generates a matching cover letter. Download as PDF or DOCX instantly.",
    points: [
      "AI rewrites bullets per job description",
      "Custom cover letter for every application",
      "Export as ATS-friendly PDF or DOCX",
    ],
    icon: Sparkles,
  },
  {
    badge: "Prepare",
    title: "Walk in ready to win",
    desc: "Practice with an AI interview coach that knows the role, the company, and your background. Behavioral, technical, and negotiation modes.",
    points: [
      "Role-specific mock interviews",
      "Real-time feedback on your answers",
      "Salary negotiation practice",
    ],
    icon: GraduationCap,
  },
];

const STATS = [
  { value: 1200, suffix: "+", label: "Jobs crawled daily" },
  { value: 45, suffix: "s", label: "To tailor any application" },
  { value: 3, suffix: "", label: "Interview practice modes" },
  { value: 95, suffix: "%", label: "ATS pass rate" },
];

const TESTIMONIALS = [
  {
    name: "Alex M.",
    role: "Software Engineer → Staff Engineer",
    quote:
      "The resume tailoring is genuinely good. It mirrors the job description language without being obvious — my callback rate went up noticeably.",
    avatar: "AM",
  },
  {
    name: "Jordan T.",
    role: "Product Manager, Series B Startup",
    quote:
      "Having the hiring team search links right on the job card is a huge time saver. I can reach out to the right person immediately.",
    avatar: "JT",
  },
  {
    name: "Priya R.",
    role: "Data Scientist, Fortune 500",
    quote:
      "The interview coach is what I was missing. Being able to practice negotiation scenarios before the real call gave me so much more confidence.",
    avatar: "PR",
  },
];

const COMPARISON = [
  {
    feature: "Job discovery",
    hunter: "AI-matched from live boards",
    others: "Basic keyword alerts",
    hunterCheck: true,
  },
  {
    feature: "Resume tailoring",
    hunter: "AI rewrites per job in seconds",
    others: "Template fill-in",
    hunterCheck: true,
  },
  {
    feature: "Interview prep",
    hunter: "AI coach with role-specific Q&A",
    others: "Generic question lists",
    hunterCheck: true,
  },
  {
    feature: "Application tracking",
    hunter: "Built-in board + timeline",
    others: "Spreadsheet or separate tool",
    hunterCheck: true,
  },
  {
    feature: "Hiring team intel",
    hunter: "Auto-found with LinkedIn links",
    others: "Not available",
    hunterCheck: true,
  },
  {
    feature: "Recruiter matching",
    hunter: "Recruiters see your profile, reach out",
    others: "Recruiter spam",
    hunterCheck: true,
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload your resume",
    desc: "hunter.ai parses it in seconds and builds a structured candidate profile — skills, experience, education, all tagged.",
    icon: FileText,
  },
  {
    step: "2",
    title: "Set your preferences",
    desc: "Target roles, locations, salary, work style. Your preferences power everything — job matching, recommendations, autopilot.",
    icon: Target,
  },
  {
    step: "3",
    title: "Discover & apply",
    desc: "Browse your personalized job feed, tailor applications in one click, and prep with interview coaching — all in one place.",
    icon: Zap,
  },
  {
    step: "4",
    title: "Track & improve",
    desc: "Follow every application through your pipeline. hunter.ai learns from your choices and gets smarter over time.",
    icon: TrendingUp,
  },
];

// ── Component ────────────────────────────────────────────────────────────────

const Index = () => {
  const { user, loading } = useAuth();
  const isAuthenticated = !loading && !!user;
  const { currency } = useGeo();
  const proPrice = getPrice("pro", currency).label;

  const heroRef = useRef(null);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SEOHead path="/" />
      <SkipLink />

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 w-full z-50 bg-card/80 backdrop-blur-lg border-b border-border/50"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="hunter.ai Home">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-md-1">
              <span className="text-primary-foreground font-bold text-base leading-none">H</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">hunter.ai</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-full transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-full transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-full transition-colors">Pricing</a>
            <Link to="/recruiter-portal" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-full transition-colors">For Recruiters</Link>
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/dashboard" className="ml-2">
                <Button size="sm" className="px-6 h-9 font-medium rounded-full shadow-md-1">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-full transition-colors ml-1">
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

          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <MobileNav isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </nav>

      <main id="main-content">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative pt-32 sm:pt-44 pb-24 md:pb-36 overflow-hidden">
          {/* Animated gradient blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/8 blur-[120px] animate-blob" />
            <div className="absolute top-[20%] -right-[10%] w-[35%] h-[35%] rounded-full bg-secondary/40 blur-[120px] animate-blob animation-delay-2000" />
            <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[100px] animate-blob animation-delay-4000" />
          </div>

          <MotionElement
            className="container max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10"
          >
            {/* Badge */}
            <MotionElement
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium border border-primary/20 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Your AI-powered career platform
            </MotionElement>

            {/* Headline */}
            <MotionElement
              as="h1"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-foreground"
            >
              Stop searching.{" "}
              <span className="text-primary">Start landing.</span>
            </MotionElement>

            {/* Sub */}
            <MotionElement
              as="p"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10"
            >
              hunter.ai discovers jobs matched to your skills, tailors your resume in seconds,
              and coaches you through interviews — so you can focus on what matters.
            </MotionElement>

            {/* CTAs */}
            <MotionElement
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10"
            >
              {isAuthenticated ? (
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-[0.9375rem] font-medium rounded-full gap-2 shadow-md-1">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto px-10 h-13 text-[0.9375rem] font-semibold rounded-full gap-2 shadow-lg">
                      Start For Free <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/login" className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 h-12 text-[0.9375rem] rounded-full font-medium">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </MotionElement>

            {/* Trust badges */}
            <MotionElement
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
            >
              {["No credit card required", "Cancel anytime", "Built for serious job seekers"].map((badge) => (
                <span key={badge} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  {badge}
                </span>
              ))}
            </MotionElement>
          </MotionElement>

          {/* Floating UI mockup — right side (desktop) */}
          <MotionElement
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="hidden xl:block absolute right-8 2xl:right-24 top-44 w-72"
          >
            <div className="p-5 rounded-2xl bg-card border border-border shadow-xl animate-float">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-success" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Senior Frontend Engineer</div>
                  <div className="text-xs text-muted-foreground">Stripe · Remote</div>
                </div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">98% Match</span>
                <span className="text-xs text-muted-foreground">$180k-$220k</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {["React", "TypeScript", "Node.js"].map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{s}</span>
                ))}
              </div>
            </div>
          </MotionElement>

          {/* Floating mockup — left side */}
          <MotionElement
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="hidden xl:block absolute left-8 2xl:left-24 top-72 w-64"
          >
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xl animate-float animation-delay-2000">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-medium">Resume Tailored</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-success ml-auto" />
              </div>
              <div className="space-y-1.5">
                <div className="h-1.5 w-full bg-muted rounded-full" />
                <div className="h-1.5 w-[90%] bg-muted rounded-full" />
                <div className="h-1.5 w-[75%] bg-primary/30 rounded-full" />
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">5 bullets optimized for this role</div>
            </div>
          </MotionElement>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <Section className="py-4 bg-background">
          <div className="container max-w-4xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden shadow-md-1">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  variants={fadeUp}
                  custom={i}
                  className="bg-card px-6 py-8 text-center group hover:bg-secondary/20 transition-colors duration-300"
                >
                  <div className="text-2xl sm:text-3xl font-semibold text-primary group-hover:scale-110 transition-transform duration-300">
                    {stat.value === 1200 ? (
                      <><AnimatedCounter value={stat.value} />{stat.suffix}</>
                    ) : stat.value === 95 ? (
                      <><AnimatedCounter value={stat.value} />{stat.suffix}</>
                    ) : (
                      <>{stat.value === 45 ? "<" : ""}{stat.value}{stat.suffix}</>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Features Grid ────────────────────────────────────────────── */}
        <Section id="features" className="py-24 md:py-32 bg-card border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                Features
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                Everything you need to land your next role
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-base text-muted-foreground max-w-2xl mx-auto">
                hunter.ai handles the tedious parts of job searching so you can focus on what matters — your career.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature, i) => (
                <motion.article
                  key={feature.title}
                  variants={scaleIn}
                  custom={i}
                  className="group p-6 rounded-2xl border border-border bg-background hover:shadow-elevated hover:border-primary/25 transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-secondary text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-[0.9375rem] font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Showcase Sections (alternating) ──────────────────────────── */}
        {SHOWCASE_SECTIONS.map((section, idx) => (
          <Section
            key={section.badge}
            className={`py-24 md:py-32 border-t border-border ${idx % 2 === 0 ? "bg-background" : "bg-card"}`}
          >
            <div className="container max-w-6xl mx-auto px-4 sm:px-6">
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${idx % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                {/* Text */}
                <div className={idx % 2 === 1 ? "lg:order-2" : ""}>
                  <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                    {section.badge}
                  </motion.div>
                  <motion.h3 variants={fadeUp} custom={1} className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
                    {section.title}
                  </motion.h3>
                  <motion.p variants={fadeUp} custom={2} className="text-muted-foreground leading-relaxed mb-6">
                    {section.desc}
                  </motion.p>
                  <div className="space-y-3">
                    {section.points.map((point, pi) => (
                      <motion.div key={point} variants={fadeUp} custom={3 + pi} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm">{point}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Visual */}
                <motion.div
                  variants={scaleIn}
                  custom={1}
                  className={`${idx % 2 === 1 ? "lg:order-1" : ""}`}
                >
                  <div className="relative rounded-2xl bg-secondary/60 p-8 sm:p-12">
                    <div className="bg-card rounded-xl border border-border shadow-xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <section.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="h-2.5 w-32 bg-muted rounded-full" />
                          <div className="h-2 w-20 bg-muted/60 rounded-full mt-1.5" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 w-full bg-muted/50 rounded-full" />
                        <div className="h-2 w-[90%] bg-muted/50 rounded-full" />
                        <div className="h-2 w-[75%] bg-muted/50 rounded-full" />
                        <div className="h-2 w-[85%] bg-primary/20 rounded-full" />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <div className="h-8 flex-1 rounded-lg bg-primary/10" />
                        <div className="h-8 flex-1 rounded-lg bg-muted/40" />
                      </div>
                    </div>
                    {/* Floating accent */}
                    <div className="absolute -top-3 -right-3 w-16 h-16 rounded-xl bg-card border border-border shadow-lg flex items-center justify-center">
                      <section.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </Section>
        ))}

        {/* ── How It Works ─────────────────────────────────────────────── */}
        <Section id="how-it-works" className="py-24 md:py-32 bg-card border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                How it works
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                From upload to offer in 4 steps
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-base text-muted-foreground max-w-xl mx-auto">
                Set up once. hunter.ai works for you continuously.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Connector line (desktop) */}
              <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-border" aria-hidden="true" />

              {HOW_IT_WORKS.map((item, i) => (
                <motion.div
                  key={item.step}
                  variants={fadeUp}
                  custom={i}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-5 shadow-lg relative z-10">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center z-20">
                    <span className="text-[10px] font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Comparison ───────────────────────────────────────────────── */}
        <Section className="py-24 md:py-32 bg-background border-t border-border">
          <div className="container max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                Why hunter.ai
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
                How we compare
              </motion.h2>
            </div>

            <motion.div variants={fadeUp} custom={2} className="rounded-2xl border border-border bg-card overflow-hidden shadow-md-1">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-left py-4 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Feature</th>
                      <th className="text-left py-4 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-[10px]">H</span>
                          </div>
                          <span className="font-semibold text-primary">hunter.ai</span>
                        </div>
                      </th>
                      <th className="text-left py-4 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Others</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row, i) => (
                      <tr key={row.feature} className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="py-3.5 px-5 font-medium">{row.feature}</td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-medium text-primary">{row.hunter}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-muted-foreground text-sm">{row.others}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </Section>

        {/* ── Testimonials ─────────────────────────────────────────────── */}
        <Section className="py-24 md:py-32 bg-card border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                Testimonials
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                Trusted by job seekers worldwide
              </motion.h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={t.name}
                  variants={scaleIn}
                  custom={i}
                  className="p-6 rounded-2xl border border-border bg-background hover:shadow-lg hover:border-primary/20 transition-all duration-300 flex flex-col"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed mb-6 flex-1">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">{t.avatar}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Pricing Teaser ───────────────────────────────────────────── */}
        <Section id="pricing" className="py-24 md:py-32 bg-background border-t border-border">
          <div className="container max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <motion.p variants={fadeUp} custom={0} className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                Pricing
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                Simple, transparent pricing
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-base text-muted-foreground max-w-xl mx-auto">
                Start free. Upgrade when you're ready for the full power.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Free */}
              <motion.div variants={fadeUp} custom={0} className="rounded-2xl border border-border bg-card p-8">
                <h3 className="text-lg font-semibold mb-1">Free</h3>
                <p className="text-muted-foreground text-sm mb-6">Get started with the essentials</p>
                <div className="text-3xl font-bold mb-6">
                  $0<span className="text-base font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="space-y-3 mb-8">
                  {["Job discovery feed", "Basic resume builder", "Application tracking", "3 AI tailoring credits/mo"].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                {!isAuthenticated && (
                  <Link to="/signup">
                    <Button variant="outline" className="w-full rounded-full h-11 font-medium">
                      Get Started Free
                    </Button>
                  </Link>
                )}
              </motion.div>

              {/* Pro */}
              <motion.div variants={fadeUp} custom={1} className="rounded-2xl border-2 border-primary bg-card p-8 relative shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                  Most Popular
                </div>
                <h3 className="text-lg font-semibold mb-1">Pro</h3>
                <p className="text-muted-foreground text-sm mb-6">Full power for serious job seekers</p>
                <div className="text-3xl font-bold mb-6">
                  {proPrice.replace(/\/wk$/, '')}<span className="text-base font-normal text-muted-foreground">/wk</span>
                </div>
                <div className="space-y-3 mb-8">
                  {[
                    "Everything in Free",
                    "Unlimited AI tailoring",
                    "Full interview coaching suite",
                    "Hunt Planner (autopilot)",
                    "Hiring team intel",
                    "Priority job matching",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium">{f}</span>
                    </div>
                  ))}
                </div>
                {!isAuthenticated ? (
                  <Link to="/signup">
                    <Button className="w-full rounded-full h-11 font-semibold shadow-md-1">
                      Start Free Trial <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/settings">
                    <Button className="w-full rounded-full h-11 font-semibold shadow-md-1">
                      Upgrade to Pro <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </motion.div>
            </div>
          </div>
        </Section>

        {/* ── For Recruiters ───────────────────────────────────────────── */}
        <Section className="py-24 md:py-32 bg-card border-t border-border">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                  <Building2 className="w-3.5 h-3.5" /> For Recruiters
                </motion.div>
                <motion.h2 variants={fadeUp} custom={1} className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
                  Hire smarter with AI-matched talent
                </motion.h2>
                <motion.p variants={fadeUp} custom={2} className="text-muted-foreground leading-relaxed mb-6">
                  Post roles and let hunter.ai's AI match you with the best-fit candidates automatically.
                  No resume sifting, no cold outreach — just matched, motivated candidates.
                </motion.p>
                <div className="space-y-3 mb-8">
                  {[
                    { icon: Target, text: "AI-scored candidates for every role" },
                    { icon: Users, text: "Active, opted-in job seekers" },
                    { icon: Zap, text: "Smart-apply fills your pipeline 24/7" },
                    { icon: BarChart3, text: "Analytics on views, applications, and engagement" },
                  ].map((item, i) => (
                    <motion.div key={item.text} variants={fadeUp} custom={3 + i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{item.text}</span>
                    </motion.div>
                  ))}
                </div>
                <motion.div variants={fadeUp} custom={7}>
                  <Link to="/recruiter-portal">
                    <Button variant="outline" className="rounded-full h-11 px-8 font-medium gap-2">
                      Apply as Recruiter <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>
              </div>

              <motion.div variants={scaleIn} custom={2}>
                <div className="rounded-2xl bg-secondary/60 p-8 sm:p-12">
                  <div className="bg-card rounded-xl border border-border shadow-xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Recruiter Dashboard</div>
                        <div className="text-xs text-muted-foreground">3 active listings</div>
                      </div>
                    </div>
                    {[
                      { label: "Senior Frontend Engineer", count: "24 applicants", match: "92%" },
                      { label: "Product Designer", count: "18 applicants", match: "87%" },
                    ].map((job) => (
                      <div key={job.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                        <div>
                          <div className="text-xs font-medium">{job.label}</div>
                          <div className="text-[10px] text-muted-foreground">{job.count}</div>
                        </div>
                        <span className="text-xs font-semibold text-primary">{job.match} avg</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </Section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <Section className="py-24 md:py-32 bg-background border-t border-border">
          <div className="container max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <motion.div
              variants={scaleIn}
              custom={0}
              className="bg-gradient-to-br from-primary/5 to-secondary rounded-3xl px-8 py-14 sm:px-14 sm:py-20 border border-primary/15"
            >
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                Ready to land your next role?
              </h2>
              <p className="text-base text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
                Join thousands of job seekers using AI to apply smarter, not harder.
              </p>
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button size="lg" className="px-10 h-13 text-[0.9375rem] font-semibold rounded-full gap-2 shadow-lg">
                    Go to Dashboard <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Link to="/signup">
                  <Button size="lg" className="px-10 h-13 text-[0.9375rem] font-semibold rounded-full gap-2 shadow-lg">
                    Get Started Free <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <p className="mt-6 text-xs text-muted-foreground">
                No credit card required. Free plan available.
              </p>
            </motion.div>
          </div>
        </Section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card py-12">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-xs">H</span>
                  </div>
                  <span className="font-semibold text-sm">hunter.ai</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI-powered job search platform. Discover, apply, and prepare — smarter.
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Product</h4>
                <div className="space-y-2">
                  <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
                  <a href="#pricing" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
                  <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Company</h4>
                <div className="space-y-2">
                  <Link to="/recruiter-portal" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">For Recruiters</Link>
                  <Link to="/privacy" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
                  <Link to="/terms" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Get Started</h4>
                <div className="space-y-2">
                  <Link to="/signup" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Sign up free</Link>
                  <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} Hunter AI Inc. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
