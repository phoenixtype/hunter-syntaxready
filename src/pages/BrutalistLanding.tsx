import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGeo } from "@/hooks/useGeo";
import { getPrice } from "@/lib/pricing";
import SEOHead from "@/components/SEOHead";
import SkipLink from "@/components/SkipLink";

// ─────────────────────────────────────────────────────────────
//  BRUTALIST LANDING — single-file, scoped under .brutal class
// ─────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "INDEX", href: "#index" },
  { label: "SYSTEM", href: "#system" },
  { label: "MANIFESTO", href: "#manifesto" },
  { label: "PRICING", href: "#pricing" },
];

const TICKER = [
  "REAL-TIME JOB CRAWL",
  "AI MATCH SCORING",
  "ATS-OPTIMIZED RESUMES",
  "INSTANT TAILORING",
  "INTERVIEW SIMULATOR",
  "RECRUITER REACH-OUTS",
  "PIPELINE TRACKING",
  "SALARY INTELLIGENCE",
];

const SYSTEM_MODULES = [
  {
    id: "01",
    code: "DSC",
    name: "DISCOVERY",
    title: "Jobs ranked by fit. Not keywords.",
    body:
      "We crawl live boards, score every listing against your profile, and learn from every swipe. Your feed sharpens daily.",
    metric: "1,200+",
    metricLabel: "JOBS / DAY",
  },
  {
    id: "02",
    code: "TLR",
    name: "TAILORING",
    title: "One click rewrites everything.",
    body:
      "Each application gets a resume mirroring the JD's language and a cover letter that actually sounds like you. Export PDF or DOCX.",
    metric: "45s",
    metricLabel: "AVG. APPLY TIME",
  },
  {
    id: "03",
    code: "INT",
    name: "INTELLIGENCE",
    title: "Walk in already prepared.",
    body:
      "Practice behavioral, technical, and negotiation modes against an AI coach trained on the role. Get scored. Iterate.",
    metric: "3 / 3",
    metricLabel: "INTERVIEW MODES",
  },
  {
    id: "04",
    code: "OPS",
    name: "OPERATIONS",
    title: "Every application in one pipeline.",
    body:
      "Kanban + timeline + reminders. Hunter learns your taste. Recruiters see your profile and reach out, not the other way around.",
    metric: "100%",
    metricLabel: "VISIBILITY",
  },
];

const MANIFESTO = [
  ["01", "JOB BOARDS ARE BROKEN.", "Endless scrolling. Stale postings. Keyword roulette."],
  ["02", "RESUMES ARE A FORMAT, NOT A STORY.", "Templates flatten what makes you hireable. We restore the signal."],
  ["03", "INTERVIEWS ARE A SKILL.", "You wouldn't ship code without testing. Don't ship yourself untested."],
  ["04", "TIME IS THE REAL CURRENCY.", "Hunter buys it back — measured in callbacks, not clicks."],
];

const PROOF = [
  { v: "1,200+", l: "Jobs crawled / day" },
  { v: "45s", l: "To tailor an app" },
  { v: "95%", l: "ATS pass rate" },
  { v: "24/7", l: "Background discovery" },
];

const FAQ = [
  {
    q: "How is this different from LinkedIn or Indeed?",
    a: "Those are search engines for jobs. Hunter is an operating system for your career — discovery, tailoring, prep, and tracking in one loop.",
  },
  {
    q: "Will my resume get past ATS systems?",
    a: "Every export is structurally clean, parseable, and scored against the JD before you submit. We tell you when something will get filtered.",
  },
  {
    q: "Do recruiters actually use this?",
    a: "Yes. Verified recruiters search the candidate pool directly and reach out — you stay anonymous until you accept.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Free forever tier. Pro is monthly, cancel from settings, no email gymnastics.",
  },
];

// ── Small primitives ───────────────────────────────────────────

function CornerTicks({ className = "" }: { className?: string }) {
  return (
    <>
      <span className={`absolute top-0 left-0 w-3 h-3 border-l border-t border-current ${className}`} />
      <span className={`absolute top-0 right-0 w-3 h-3 border-r border-t border-current ${className}`} />
      <span className={`absolute bottom-0 left-0 w-3 h-3 border-l border-b border-current ${className}`} />
      <span className={`absolute bottom-0 right-0 w-3 h-3 border-r border-b border-current ${className}`} />
    </>
  );
}

function Coord({ x, y }: { x: string; y: string }) {
  return (
    <span className="mono text-[10px] tracking-widest opacity-60">
      {x} · {y}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function BrutalistLanding() {
  const { user, loading } = useAuth();
  const isAuth = !loading && !!user;
  const { currency } = useGeo();
  const proPrice = getPrice("pro", currency).label;

  // live clock for status bar — pure UI flourish
  const [now, setNow] = useState<string>(() =>
    new Date().toLocaleTimeString("en-GB", { hour12: false })
  );
  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date().toLocaleTimeString("en-GB", { hour12: false })),
      1000
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="brutal min-h-screen overflow-x-hidden">
      <SEOHead path="/" />
      <SkipLink />

      {/* ── Top status bar ──────────────────────────────────── */}
      <div className="border-b border-current/15 mono text-[10px] uppercase tracking-[0.2em]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="brutal-blink inline-block w-1.5 h-1.5 bg-current" />
            <span className="hidden sm:inline">SYSTEM ONLINE</span>
            <span className="opacity-50">/</span>
            <span className="truncate">CRAWL ACTIVE · 1,247 NEW TODAY</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline opacity-60">UTC</span>
            <span>{now}</span>
          </div>
        </div>
      </div>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-current backdrop-blur" style={{ background: "hsl(var(--paper) / 0.92)" }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" aria-label="hunter.ai">
            <div className="w-8 h-8 border border-current flex items-center justify-center">
              <span className="mono font-bold text-sm">H</span>
            </div>
            <div className="leading-none">
              <div className="mono text-[11px] tracking-[0.25em] opacity-60">HUNTER</div>
              <div className="mono text-[11px] tracking-[0.25em]">/CAREER.OS</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 mono text-[11px] tracking-[0.2em]">
            {NAV_LINKS.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 hover:bg-current hover:text-[hsl(var(--paper))] transition-colors"
              >
                <span className="opacity-50 mr-1.5">0{i + 1}</span>
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isAuth ? (
              <Link to="/dashboard" className="brutal-btn brutal-btn-accent h-10 text-[11px]">
                DASHBOARD →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline mono text-[11px] tracking-[0.2em] px-3 py-1.5 hover:bg-current hover:text-[hsl(var(--paper))]"
                >
                  LOG IN
                </Link>
                <Link to="/signup" className="brutal-btn brutal-btn-accent h-10 text-[11px]">
                  GET ACCESS →
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main id="main-content">
        {/* ── HERO ────────────────────────────────────────── */}
        <section className="relative border-b border-current">
          <div className="brutal-grid absolute inset-0 pointer-events-none opacity-50" aria-hidden />

          <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 pt-20 pb-16 md:pt-32 md:pb-24">
            {/* Eyebrow row */}
            <div className="flex flex-wrap items-center gap-3 mb-10 md:mb-16">
              <span className="brutal-tag brutal-tag-accent">● V.4.0 / LIVE</span>
              <span className="mono text-[11px] tracking-[0.2em] opacity-60">
                FILE: HOMEPAGE.HTM &nbsp;//&nbsp; BUILD: 2026.04.20
              </span>
            </div>

            {/* Headline grid */}
            <div className="grid grid-cols-12 gap-x-4 gap-y-6 md:gap-y-10">
              {/* Left margin coordinates */}
              <div className="hidden md:block col-span-1">
                <Coord x="X.001" y="Y.001" />
              </div>

              <h1 className="col-span-12 md:col-span-11 font-display font-medium tracking-[-0.045em] leading-[0.88] text-[14vw] md:text-[10vw] lg:text-[9.4rem] xl:text-[11rem]">
                <span className="block">STOP</span>
                <span className="block">
                  <span className="serif italic font-light opacity-90">searching.</span>
                </span>
                <span className="block">
                  START&nbsp;
                  <span className="brutal-annotate">LANDING</span>
                  <span className="brutal-cursor" aria-hidden />
                </span>
              </h1>
            </div>

            {/* Sub grid — descriptor / actions / vital signs */}
            <div className="mt-12 md:mt-20 grid grid-cols-12 gap-4 md:gap-8">
              {/* descriptor */}
              <div className="col-span-12 md:col-span-5 md:col-start-2">
                <div className="mono text-[11px] tracking-[0.2em] opacity-60 mb-4">
                  // ABSTRACT
                </div>
                <p className="text-lg md:text-xl leading-snug max-w-md">
                  Hunter is the career operating system for people who refuse to spend
                  their weekends on job boards. Crawl. Match. Tailor. Apply. Track.
                  All on one canvas.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {isAuth ? (
                    <Link to="/dashboard" className="brutal-btn brutal-btn-accent">
                      ENTER DASHBOARD →
                    </Link>
                  ) : (
                    <>
                      <Link to="/signup" className="brutal-btn brutal-btn-accent">
                        START FREE →
                      </Link>
                      <a href="#system" className="brutal-btn brutal-btn-ghost">
                        SEE THE SYSTEM
                      </a>
                    </>
                  )}
                </div>
                <p className="mono text-[10px] tracking-[0.18em] opacity-60 mt-5">
                  NO CARD · CANCEL ANY TIME · WORKS WORLDWIDE
                </p>
              </div>

              {/* vital signs panel */}
              <div className="col-span-12 md:col-span-5 md:col-start-8">
                <div className="brutal-cell relative p-6 md:p-8">
                  <CornerTicks className="text-[hsl(var(--ink))]" />
                  <div className="flex items-center justify-between mb-6">
                    <span className="mono text-[10px] tracking-[0.25em] opacity-60">
                      // VITAL.SIGNS
                    </span>
                    <span className="mono text-[10px] tracking-[0.25em]">REV. 04</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                    {PROOF.map((p) => (
                      <div key={p.l}>
                        <div className="brutal-numeral text-4xl md:text-5xl">{p.v}</div>
                        <div className="mono text-[10px] tracking-[0.22em] mt-2 opacity-70 uppercase">
                          {p.l}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-5 border-t border-current/30 flex items-center justify-between mono text-[10px] tracking-[0.22em] opacity-70">
                    <span>LAST CRAWL: {now}</span>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[hsl(var(--accent))] brutal-blink" />
                      OK
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── MARQUEE ─────────────────────────────────────── */}
        <section className="border-b border-current overflow-hidden" style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-ink))" }}>
          <div className="brutal-marquee-track py-4 mono text-sm md:text-base font-bold tracking-[0.3em]">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex items-center gap-10 px-5">
                {TICKER.map((t, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-10">
                    <span>{t}</span>
                    <span className="opacity-60">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ── SYSTEM MODULES ──────────────────────────────── */}
        <section id="system" className="border-b border-current">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 md:py-28">
            <header className="grid grid-cols-12 gap-4 mb-12 md:mb-20">
              <div className="col-span-12 md:col-span-5">
                <div className="mono text-[11px] tracking-[0.25em] opacity-60 mb-3">
                  /SECTION.02 — SYSTEM
                </div>
                <h2 className="text-4xl md:text-6xl font-medium tracking-[-0.04em] leading-[0.95]">
                  Four modules.<br />
                  <span className="serif italic font-light">One career.</span>
                </h2>
              </div>
              <div className="col-span-12 md:col-span-5 md:col-start-8 flex items-end">
                <p className="mono text-sm leading-relaxed opacity-80 max-w-sm">
                  Each module runs in isolation but composes with the others. Use one. Use all four. Hunter scales to the depth you need.
                </p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l border-current">
              {SYSTEM_MODULES.map((m) => (
                <article
                  key={m.id}
                  className="border-r border-b border-current p-6 md:p-10 flex flex-col gap-6 group hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="mono text-[11px] tracking-[0.25em] opacity-60">
                        MODULE.{m.id}
                      </div>
                      <div className="mono text-[11px] tracking-[0.25em] mt-1">
                        [{m.code}] {m.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="brutal-numeral text-3xl md:text-4xl">{m.metric}</div>
                      <div className="mono text-[10px] tracking-[0.22em] opacity-60 mt-1">
                        {m.metricLabel}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-medium tracking-[-0.03em] leading-[1.05] max-w-md">
                    {m.title}
                  </h3>
                  <p className="text-base leading-relaxed max-w-md opacity-90">
                    {m.body}
                  </p>

                  <div className="mt-auto flex items-center justify-between mono text-[11px] tracking-[0.22em]">
                    <span className="opacity-70">→ ACTIVE</span>
                    <span className="opacity-70 group-hover:opacity-100">{m.id}/04</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── MANIFESTO ───────────────────────────────────── */}
        <section id="manifesto" className="border-b border-current bg-[hsl(var(--ink))] text-[hsl(var(--paper))]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 md:py-28">
            <div className="grid grid-cols-12 gap-4 mb-12 md:mb-20">
              <div className="col-span-12 md:col-span-5">
                <div className="mono text-[11px] tracking-[0.25em] opacity-60 mb-3">
                  /SECTION.03 — MANIFESTO
                </div>
                <h2 className="text-4xl md:text-6xl font-medium tracking-[-0.04em] leading-[0.95]">
                  We don't build<br />
                  <span className="serif italic font-light">job boards.</span>
                </h2>
              </div>
              <div className="col-span-12 md:col-span-5 md:col-start-8 flex items-end">
                <p className="mono text-sm leading-relaxed opacity-70 max-w-sm">
                  A career is a long, recursive bet. Hunter is the toolkit we wished we'd had at every inflection point.
                </p>
              </div>
            </div>

            <ol className="space-y-0 border-t border-current/20">
              {MANIFESTO.map(([n, h, s]) => (
                <li
                  key={n}
                  className="grid grid-cols-12 gap-4 md:gap-8 py-8 md:py-12 border-b border-current/20 group"
                >
                  <div className="col-span-12 md:col-span-1 mono text-[11px] tracking-[0.25em] opacity-60">
                    {n} /
                  </div>
                  <h3 className="col-span-12 md:col-span-7 text-2xl md:text-4xl font-medium tracking-[-0.03em] leading-[1.05]">
                    {h}
                  </h3>
                  <p className="col-span-12 md:col-span-4 text-base leading-relaxed opacity-80 mono md:text-sm md:tracking-wide">
                    {s}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── BIG QUOTE ───────────────────────────────────── */}
        <section className="border-b border-current">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-20 md:py-32 grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-1 mono text-[11px] tracking-[0.25em] opacity-60">
              QTE.001 /
            </div>
            <blockquote className="col-span-12 md:col-span-10 serif italic text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              "I stopped opening LinkedIn. Hunter brings the right roles to me, rewrites the resume, and rehearses the interview. It feels like having a chief of staff for my career."
            </blockquote>
            <div className="col-span-12 md:col-span-10 md:col-start-2 mt-6 mono text-xs tracking-[0.22em] opacity-70 flex items-center gap-3">
              <span className="w-8 h-px bg-current" />
              ALEX M. — STAFF ENGINEER, SF
            </div>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────── */}
        <section id="pricing" className="border-b border-current">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 md:py-28">
            <header className="grid grid-cols-12 gap-4 mb-12 md:mb-16">
              <div className="col-span-12 md:col-span-6">
                <div className="mono text-[11px] tracking-[0.25em] opacity-60 mb-3">
                  /SECTION.04 — PRICING
                </div>
                <h2 className="text-4xl md:text-6xl font-medium tracking-[-0.04em] leading-[0.95]">
                  Two plans.<br />
                  <span className="serif italic font-light">Zero theatre.</span>
                </h2>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-l border-current">
              {/* FREE */}
              <div className="border-r border-b border-current p-8 md:p-12 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <span className="mono text-[11px] tracking-[0.25em]">PLAN.A — FREE</span>
                  <span className="brutal-tag">FOREVER</span>
                </div>
                <div className="brutal-numeral text-7xl md:text-8xl mb-2">$0</div>
                <div className="mono text-[11px] tracking-[0.22em] opacity-60 mb-10">
                  / FOREVER
                </div>
                <ul className="space-y-3 mono text-sm mb-10">
                  {[
                    "Live job discovery feed",
                    "5 tailored applications / mo",
                    "Resume builder + ATS score",
                    "Application pipeline",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="opacity-50 mt-1">▸</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="brutal-btn brutal-btn-ghost mt-auto">
                  CLAIM ACCOUNT →
                </Link>
              </div>

              {/* PRO */}
              <div
                className="border-r border-b border-current p-8 md:p-12 flex flex-col relative"
                style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-ink))" }}
              >
                <CornerTicks className="text-[hsl(var(--accent-ink))]" />
                <div className="flex items-center justify-between mb-8">
                  <span className="mono text-[11px] tracking-[0.25em]">PLAN.B — PRO</span>
                  <span className="brutal-tag" style={{ background: "hsl(var(--accent-ink))", color: "hsl(var(--accent))", borderColor: "hsl(var(--accent-ink))" }}>
                    RECOMMENDED
                  </span>
                </div>
                <div className="brutal-numeral text-7xl md:text-8xl mb-2">{proPrice}</div>
                <div className="mono text-[11px] tracking-[0.22em] opacity-70 mb-10">
                  / MONTH · CANCEL ANY TIME
                </div>
                <ul className="space-y-3 mono text-sm mb-10">
                  {[
                    "Unlimited tailored applications",
                    "AI Interview Coach (3 modes)",
                    "Salary Intelligence",
                    "Auto-Applier with safe-mode",
                    "Recruiter outreach inbox",
                    "Priority job crawl",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-1">▸</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="brutal-btn mt-auto">
                  GO PRO →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────── */}
        <section className="border-b border-current">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-16 md:py-28 grid grid-cols-12 gap-4 md:gap-8">
            <div className="col-span-12 md:col-span-4">
              <div className="mono text-[11px] tracking-[0.25em] opacity-60 mb-3">
                /SECTION.05 — FAQ
              </div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-[-0.04em] leading-[0.95]">
                Asked<br />
                <span className="serif italic font-light">often.</span>
              </h2>
            </div>
            <div className="col-span-12 md:col-span-8 border-t border-current">
              {FAQ.map((f, i) => (
                <details key={f.q} className="group border-b border-current py-6">
                  <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
                    <div className="flex items-start gap-4">
                      <span className="mono text-[11px] tracking-[0.25em] opacity-60 mt-1.5">
                        0{i + 1}
                      </span>
                      <h3 className="text-lg md:text-2xl font-medium tracking-[-0.02em] leading-tight">
                        {f.q}
                      </h3>
                    </div>
                    <span className="mono text-2xl leading-none mt-1 group-open:rotate-45 transition-transform shrink-0">
                      +
                    </span>
                  </summary>
                  <p className="mt-5 ml-9 max-w-2xl text-base leading-relaxed opacity-80">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────── */}
        <section className="border-b border-current bg-[hsl(var(--ink))] text-[hsl(var(--paper))] relative overflow-hidden">
          <div className="brutal-grid absolute inset-0 opacity-10 pointer-events-none" aria-hidden />
          <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 py-20 md:py-32 grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-1 mono text-[11px] tracking-[0.25em] opacity-60">
              END /
            </div>
            <div className="col-span-12 md:col-span-10">
              <h2 className="font-display font-medium tracking-[-0.045em] leading-[0.9] text-[12vw] md:text-[8vw] lg:text-[7rem]">
                The job hunt is<br />
                <span className="serif italic font-light">over.</span> Begin the work.
              </h2>
              <div className="mt-12 flex flex-wrap gap-4">
                <Link to="/signup" className="brutal-btn brutal-btn-accent">
                  CREATE ACCOUNT →
                </Link>
                <a href="#system" className="brutal-btn brutal-btn-ghost" style={{ borderColor: "hsl(var(--paper))", color: "hsl(var(--paper))", boxShadow: "4px 4px 0 0 hsl(var(--paper))" }}>
                  REVIEW THE SYSTEM
                </a>
              </div>
              <p className="mono text-[11px] tracking-[0.22em] opacity-60 mt-6">
                FREE FOREVER · NO CREDIT CARD · BUILT BY OPERATORS, FOR OPERATORS
              </p>
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────── */}
        <footer className="bg-[hsl(var(--paper))]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-12 grid grid-cols-12 gap-6 mono text-[11px] tracking-[0.22em]">
            <div className="col-span-12 md:col-span-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 border border-current flex items-center justify-center">
                  <span className="font-bold text-sm">H</span>
                </div>
                <span>HUNTER / CAREER.OS</span>
              </div>
              <p className="opacity-60 leading-relaxed normal-case tracking-normal text-sm">
                Built for people who treat their career like a craft.
              </p>
            </div>
            <div className="col-span-6 md:col-span-2">
              <div className="opacity-60 mb-4">PRODUCT</div>
              <ul className="space-y-2.5">
                <li><a href="#system" className="hover:underline">System</a></li>
                <li><a href="#pricing" className="hover:underline">Pricing</a></li>
                <li><Link to="/recruiter-portal" className="hover:underline">Recruiters</Link></li>
              </ul>
            </div>
            <div className="col-span-6 md:col-span-2">
              <div className="opacity-60 mb-4">COMPANY</div>
              <ul className="space-y-2.5">
                <li><Link to="/privacy" className="hover:underline">Privacy</Link></li>
                <li><Link to="/terms" className="hover:underline">Terms</Link></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4 md:text-right">
              <div className="opacity-60 mb-4">SIGNAL</div>
              <p className="normal-case tracking-normal text-sm leading-relaxed opacity-80">
                © {new Date().getFullYear()} Hunter Labs. All systems nominal.
              </p>
            </div>
          </div>
          <div className="border-t border-current">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-10 flex items-center justify-between mono text-[10px] tracking-[0.25em] opacity-60">
              <span>EOF</span>
              <span>v4.0.0 · {now}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
