import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, FileText, Bot, Zap, Shield, Users, Star, ChevronRight, CheckCircle2 } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const FEATURES = [
  { icon: Briefcase, title: "Smart Job Discovery", desc: "AI crawls LinkedIn, Y Combinator, and hidden job boards to surface roles perfectly matched to your skills." },
  { icon: Bot, title: "Auto-Apply", desc: "One click to apply. Hunter tailors your resume, writes your cover letter, and submits — all on autopilot." },
  { icon: FileText, title: "Resume Builder", desc: "Build a polished, ATS-optimized resume through a guided flow. Multiple templates to choose from." },
  { icon: Zap, title: "Interview Prep", desc: "Deep intel on interviewers, company culture, and role-specific preparation guides before every call." },
  { icon: Shield, title: "Compliance & Safety", desc: "Built-in rate limiting and anti-detection. Apply aggressively without getting flagged or banned." },
  { icon: Users, title: "Hiring Team Intel", desc: "Discover recruiters and hiring managers. Get direct contact info and optimal outreach strategies." },
];

const TESTIMONIALS = [
  { name: "Sarah K.", role: "Software Engineer → Google", quote: "Hunter found roles I never would have seen. Got 3 interviews in the first week and an offer within a month.", rating: 5 },
  { name: "Marcus T.", role: "Product Manager → Stripe", quote: "The auto-apply feature saved me 20+ hours a week. I was applying to 50 jobs while sleeping. Absolute game changer.", rating: 5 },
  { name: "Priya R.", role: "Data Scientist → Meta", quote: "Interview prep was incredible. It knew exactly what questions to expect. I felt more prepared than ever.", rating: 5 },
];

const STATS = [
  { value: "50K+", label: "Jobs discovered" },
  { value: "20hrs", label: "Saved per week" },
  { value: "3.2x", label: "More interviews" },
  { value: "89%", label: "Success rate" },
];

const TRUST_BADGES = ["No credit card required", "Cancel anytime", "SOC 2 compliant"];

const Index = () => {
  const { user, loading } = useAuth();
  const isAuthenticated = !loading && !!user;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SkipLink />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border/50" role="navigation" aria-label="Main navigation">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Hunter AI Home">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
              <span className="text-primary-foreground font-bold text-base">H</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Hunter</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="sm" className="px-5 h-9 font-medium rounded-lg shadow-md shadow-primary/20">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Log in
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="px-5 h-9 font-medium rounded-lg shadow-md shadow-primary/20">
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
        <section className="pt-32 sm:pt-40 pb-20 md:pb-28 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          </div>

          <div className="container max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="space-y-8"
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                Now in open beta — Join free
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
                Your career on
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">autopilot.</span>
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Hunter discovers hidden opportunities, tailors every application to beat ATS filters, and preps you for interviews — so you focus on what matters.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {isAuthenticated ? (
                  <Link to="/dashboard" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto px-8 h-13 text-base font-semibold rounded-xl gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                      Go to Dashboard <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/signup" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full sm:w-auto px-8 h-13 text-base font-semibold rounded-xl gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow">
                        Start For Free <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link to="/login" className="w-full sm:w-auto">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 h-13 text-base rounded-xl font-medium">
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
              </motion.div>

              {/* Trust badges */}
              <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-muted-foreground">
                {TRUST_BADGES.map(badge => (
                  <span key={badge} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary/70" />
                    {badge}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="flex flex-wrap justify-center gap-8 sm:gap-14 mt-20"
            >
              {STATS.map((stat, i) => (
                <motion.div key={stat.label} variants={fadeUp} custom={i} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 border-t border-border/50" aria-labelledby="features-heading">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className="text-center mb-16">
              <motion.h2 variants={fadeUp} id="features-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Everything you need to land your next role
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Hunter handles the tedious parts of job searching so you can focus on what matters — your career.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {FEATURES.map((feature, i) => (
                <motion.article
                  key={feature.title}
                  variants={fadeUp}
                  custom={i}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 bg-muted/30 border-t border-border/50">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                How it works
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground">Three steps to your next job offer.</motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-10"
            >
              {[
                { step: "01", title: "Build your profile", desc: "Walk through a guided flow to enter your experience, skills, and education. Hunter crafts your resume for you." },
                { step: "02", title: "Set your targets", desc: "Tell us what roles you want, where you want to work, and your salary expectations. We do the rest." },
                { step: "03", title: "Watch offers come in", desc: "Hunter discovers, applies, and prepares you for interviews — automatically. Review everything before it goes out." },
              ].map((item, i) => (
                <motion.div key={item.step} variants={fadeUp} custom={i} className="relative">
                  <div className="text-6xl font-extrabold text-primary/10 mb-4 leading-none">{item.step}</div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 border-t border-border/50">
          <div className="container max-w-6xl mx-auto px-4 sm:px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                People are landing jobs with Hunter
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground">Join thousands who've transformed their job search.</motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={t.name}
                  variants={fadeUp}
                  custom={i}
                  className="p-6 rounded-2xl border border-border bg-card hover:border-primary/20 transition-colors"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-5">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{t.name[0]}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 border-t border-border/50 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
          </div>
          <div className="container max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to land your dream job?
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                Stop scrolling job boards. Let AI do the heavy lifting while you prepare for interviews.
              </motion.p>
              <motion.div variants={fadeUp} custom={2}>
                {isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button size="lg" className="px-10 h-13 text-base font-semibold rounded-xl gap-2 shadow-lg shadow-primary/25">
                      Go to Dashboard <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/signup">
                    <Button size="lg" className="px-10 h-13 text-base font-semibold rounded-xl gap-2 shadow-lg shadow-primary/25">
                      Get Started Free <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
