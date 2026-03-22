import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip protocol + www, trim trailing slash, show only domain/path */
function cleanUrl(raw: string): string {
  return raw.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').split('?')[0];
}

/** Normalise raw date tokens → "Jan 2020", pass through "Present" / "Current" */
function fmtDate(raw: string): string {
  if (!raw) return '';
  const norm = raw.trim();
  if (/^(present|current|now|today)$/i.test(norm)) return 'Present';
  // ISO: 2020-01 or 2020-01-15
  const iso = norm.match(/^(\d{4})-(\d{2})/);
  if (iso) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(iso[2], 10) - 1]} ${iso[1]}`;
  }
  // Already readable: "January 2020", "Jan 2020", "2020"
  return norm;
}

/** Convert "Jan 2020 - Dec 2023" or ISO range to "Jan 2020 – Dec 2023" */
function normaliseDuration(raw: string): string {
  if (!raw) return '';
  return raw.split(/[-–—]|to /i).map(p => fmtDate(p.trim())).filter(Boolean).join(' – ');
}

/** Extract bullet strings, strip leading •/-/* */
function parseBullets(content: string): string[] {
  return content
    .split('\n')
    .map(l => l.trim().replace(/^[•\-\*]\s*/, ''))
    .filter(l => l.length > 2);
}

/** Escape HTML entities */
function esc(s: string): string {
  return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Template builders ────────────────────────────────────────────────────────

interface Exp  { role:string; company:string; duration:string; content:string; }
interface Edu  { degree:string; field?:string; school:string; year:string; }
interface Skill{ name:string; proficiency:number; }
interface Identity { name:string; email:string; phone?:string; location?:string; links?:string[]; }
interface Profile  { identity:Identity; summary?:string; skills:Skill[]; experience_atoms:Exp[]; education:Edu[]; }

interface BuildOpts {
  template: string;
  accent: string;
  onePage: boolean;
}

function buildHtml(profile: Profile, opts: BuildOpts): string {
  const { identity, summary, skills, experience_atoms, education } = profile;
  const { accent, onePage } = opts;

  const maxBullets   = onePage ? 2 : 4;
  const maxExp       = onePage ? 3 : 99;
  const maxSkills    = onePage ? 12 : 30;

  // ── Contact line items ──────────────────────────────────────────
  const contactItems: string[] = [];
  if (identity.email)    contactItems.push(esc(identity.email));
  if (identity.phone)    contactItems.push(esc(identity.phone));
  if (identity.location) contactItems.push(esc(identity.location));
  // For one-page, only show first 2 links; for multi-page show all
  const linkLimit = onePage ? 2 : 4;
  (identity.links ?? []).slice(0, linkLimit).forEach(l => {
    if (l) contactItems.push(esc(cleanUrl(l)));
  });

  // ── Experience entries ──────────────────────────────────────────
  const expEntries = experience_atoms.slice(0, maxExp);

  // ── Skills sorted by proficiency ───────────────────────────────
  const topSkills = [...skills]
    .sort((a, b) => (b.proficiency ?? 0) - (a.proficiency ?? 0))
    .slice(0, maxSkills);

  // ── Template-specific CSS ───────────────────────────────────────
  const cssMap: Record<string, string> = {
    minimalist: minimalCss(accent, onePage),
    executive:  executiveCss(accent, onePage),
    tech:       techCss(accent, onePage),
    corporate:  corporateCss(accent, onePage),
  };
  const css = cssMap[opts.template] ?? cssMap.minimalist;

  // ── Build sections HTML ─────────────────────────────────────────
  const summaryHtml = summary
    ? `<p class="summary">${esc(summary)}</p>`
    : '';

  const skillsHtml = topSkills.length > 0
    ? `<section>
        <h2 class="section-head">Skills</h2>
        <p class="skills-list">${topSkills.map(s => `<span class="skill-chip">${esc(s.name)}</span>`).join('')}</p>
       </section>`
    : '';

  const expHtml = expEntries.length > 0
    ? `<section>
        <h2 class="section-head">Professional Experience</h2>
        ${expEntries.map(exp => {
          const bullets = parseBullets(exp.content ?? '').slice(0, maxBullets);
          const dur     = normaliseDuration(exp.duration ?? '');
          return `<div class="exp-block">
            <div class="exp-header">
              <span class="exp-title">${esc(exp.role)}</span>
              ${dur ? `<span class="exp-date">${esc(dur)}</span>` : ''}
            </div>
            ${exp.company ? `<div class="exp-company">${esc(exp.company)}</div>` : ''}
            ${bullets.length > 0
              ? `<ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
              : ''}
          </div>`;
        }).join('')}
       </section>`
    : '';

  const eduHtml = education.length > 0
    ? `<section>
        <h2 class="section-head">Education</h2>
        ${education.map(edu => {
          const degreeDisplay = [edu.degree, edu.field].filter(Boolean).map((s: string) => esc(s)).join(', ');
          return `<div class="edu-block">
            <div class="edu-header">
              <span class="edu-degree">${degreeDisplay}</span>
              ${edu.year ? `<span class="exp-date">${esc(fmtDate(edu.year))}</span>` : ''}
            </div>
            ${edu.school ? `<div class="exp-company">${esc(edu.school)}</div>` : ''}
          </div>`;
        }).join('')}
       </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(identity.name)} — Resume</title>
<style>${css}</style>
</head>
<body>
<div class="page">
  <header class="resume-header">
    <h1 class="cand-name">${esc(identity.name || 'Your Name')}</h1>
    ${contactItems.length > 0
      ? `<div class="contact-line">${contactItems.map(c => `<span>${c}</span>`).join('<span class="sep">·</span>')}</div>`
      : ''}
  </header>
  <main>
    ${summaryHtml}
    ${skillsHtml}
    ${expHtml}
    ${eduHtml}
  </main>
</div>
</body>
</html>`;
}

// ─── Template CSS ─────────────────────────────────────────────────────────────

function basePrintCss(onePage: boolean): string {
  const pageMargin = onePage ? '0.42in 0.55in' : '0.65in 0.7in';
  return `
@page { size: letter portrait; margin: ${pageMargin}; }
@media print {
  html, body { background: white !important; }
  .page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: 100% !important; }
}`;
}

function minimalCss(accent: string, onePage: boolean): string {
  const baseSize  = onePage ? '9pt'   : '10.5pt';
  const h2Size    = onePage ? '7.5pt' : '8.5pt';
  const h1Size    = onePage ? '19pt'  : '22pt';
  const smallSize = onePage ? '8pt'   : '9pt';
  const bodyPad   = onePage ? '0.45in 0.55in' : '0.65in 0.7in';
  const secGap    = onePage ? '12px'  : '18px';
  const liGap     = onePage ? '1px'   : '3px';
  const ulMb      = onePage ? '6px'   : '10px';
  return `
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#f5f5f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:${baseSize};color:#111;line-height:1.45;}
.page{background:#fff;max-width:8.5in;margin:20px auto;padding:${bodyPad};box-shadow:0 2px 14px rgba(0,0,0,.12);}
.resume-header{margin-bottom:${secGap};}
.cand-name{font-size:${h1Size};font-weight:700;letter-spacing:-.5px;color:#0f0f0f;margin-bottom:4px;}
.contact-line{font-size:${smallSize};color:#555;display:flex;flex-wrap:wrap;gap:2px 0;align-items:center;}
.contact-line span{white-space:nowrap;}
.sep{margin:0 6px;color:#ccc;font-size:.7em;user-select:none;}
.summary{font-size:${baseSize};line-height:1.55;color:#333;margin-bottom:${secGap};}
.section-head{font-size:${h2Size};font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${accent};border-bottom:1.5px solid ${accent};padding-bottom:3px;margin:${secGap} 0 8px;}
.exp-block{margin-bottom:${ulMb};}
.exp-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;}
.exp-title{font-weight:600;font-size:${baseSize};}
.exp-date{font-size:${smallSize};color:#777;white-space:nowrap;margin-left:8px;}
.exp-company{font-style:italic;font-size:${smallSize};color:#555;margin-bottom:4px;}
ul{margin:4px 0 0 1.1em;padding:0;}
li{margin-bottom:${liGap};font-size:${baseSize};line-height:1.4;color:#222;}
.skills-list{display:flex;flex-wrap:wrap;gap:4px 6px;margin-bottom:4px;}
.skill-chip{font-size:${smallSize};background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:1px 6px;color:#333;}
.edu-block{margin-bottom:8px;}
.edu-header{display:flex;justify-content:space-between;align-items:baseline;}
.edu-degree{font-weight:600;font-size:${baseSize};}
${basePrintCss(onePage)}`;
}

function executiveCss(accent: string, onePage: boolean): string {
  const baseSize  = onePage ? '9pt'   : '10.5pt';
  const h1Size    = onePage ? '20pt'  : '24pt';
  const h2Size    = onePage ? '8pt'   : '9.5pt';
  const smallSize = onePage ? '8pt'   : '9pt';
  const bodyPad   = onePage ? '0.45in 0.55in' : '0.65in 0.75in';
  const secGap    = onePage ? '10px'  : '16px';
  return `
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#f5f5f5;font-family:Georgia,'Times New Roman',serif;font-size:${baseSize};color:#111;line-height:1.5;}
.page{background:#fff;max-width:8.5in;margin:20px auto;padding:${bodyPad};box-shadow:0 2px 14px rgba(0,0,0,.12);}
.resume-header{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:${secGap};}
.cand-name{font-size:${h1Size};font-weight:700;letter-spacing:1px;color:#0a0a0a;margin-bottom:5px;font-variant:small-caps;}
.contact-line{font-size:${smallSize};color:#555;display:flex;flex-wrap:wrap;gap:2px 0;justify-content:center;align-items:center;}
.contact-line span{white-space:nowrap;}
.sep{margin:0 8px;color:#bbb;}
.summary{font-size:${baseSize};line-height:1.6;color:#333;margin-bottom:${secGap};font-style:italic;}
.section-head{font-size:${h2Size};font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${accent};border-bottom:1px solid ${accent};border-top:1px solid ${accent};padding:3px 0;margin:${secGap} 0 8px;text-align:center;}
.exp-block{margin-bottom:10px;}
.exp-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;}
.exp-title{font-weight:700;font-size:${baseSize};}
.exp-date{font-size:${smallSize};color:#666;white-space:nowrap;margin-left:8px;}
.exp-company{font-style:italic;font-size:${smallSize};color:#555;margin-bottom:4px;}
ul{margin:4px 0 0 1.2em;}
li{margin-bottom:2px;font-size:${baseSize};line-height:1.45;}
.skills-list{display:flex;flex-wrap:wrap;gap:4px 8px;margin-bottom:4px;}
.skill-chip{font-size:${smallSize};color:#333;padding:0;}
.skill-chip::after{content:'  ·  ';color:#bbb;}
.skill-chip:last-child::after{content:'';}
.edu-block{margin-bottom:8px;}
.edu-header{display:flex;justify-content:space-between;align-items:baseline;}
.edu-degree{font-weight:700;}
${basePrintCss(onePage)}`;
}

function techCss(accent: string, onePage: boolean): string {
  const baseSize  = onePage ? '8.5pt' : '10pt';
  const h1Size    = onePage ? '18pt'  : '21pt';
  const h2Size    = onePage ? '7.5pt' : '8.5pt';
  const smallSize = onePage ? '7.5pt' : '8.5pt';
  const bodyPad   = onePage ? '0.4in 0.5in' : '0.6in 0.65in';
  const secGap    = onePage ? '10px'  : '15px';
  return `
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#f5f5f5;font-family:'Fira Code','Courier New',monospace;font-size:${baseSize};color:#1a1a1a;line-height:1.5;}
.page{background:#fff;max-width:8.5in;margin:20px auto;padding:${bodyPad};box-shadow:0 2px 14px rgba(0,0,0,.12);}
.resume-header{border-left:4px solid ${accent};padding-left:12px;margin-bottom:${secGap};}
.cand-name{font-size:${h1Size};font-weight:700;color:#0f0f0f;margin-bottom:4px;font-family:system-ui,sans-serif;letter-spacing:-.5px;}
.contact-line{font-size:${smallSize};color:#555;display:flex;flex-wrap:wrap;gap:2px 0;align-items:center;}
.contact-line span{white-space:nowrap;font-family:'Fira Code','Courier New',monospace;}
.sep{margin:0 7px;color:#ddd;}
.summary{font-size:${baseSize};font-family:system-ui,sans-serif;line-height:1.5;color:#333;margin-bottom:${secGap};}
.section-head{font-size:${h2Size};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${accent};margin:${secGap} 0 6px;padding-left:8px;border-left:3px solid ${accent};}
.exp-block{margin-bottom:10px;padding-left:4px;}
.exp-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;}
.exp-title{font-weight:700;font-family:system-ui,sans-serif;font-size:${baseSize};}
.exp-date{font-size:${smallSize};color:#777;white-space:nowrap;margin-left:8px;font-family:'Fira Code',monospace;}
.exp-company{font-size:${smallSize};color:${accent};margin-bottom:4px;font-weight:600;}
ul{margin:4px 0 0 1.1em;}
li{margin-bottom:2px;font-size:${baseSize};line-height:1.4;font-family:system-ui,sans-serif;}
.skills-list{display:flex;flex-wrap:wrap;gap:4px;}
.skill-chip{font-size:${smallSize};background:transparent;border:1px solid ${accent};color:${accent};border-radius:2px;padding:1px 5px;}
.edu-block{margin-bottom:8px;padding-left:4px;}
.edu-header{display:flex;justify-content:space-between;align-items:baseline;}
.edu-degree{font-weight:700;font-family:system-ui,sans-serif;}
.exp-company.edu-school{font-family:system-ui,sans-serif;}
${basePrintCss(onePage)}`;
}

function corporateCss(accent: string, onePage: boolean): string {
  const baseSize  = onePage ? '9.5pt' : '11pt';
  const h1Size    = onePage ? '18pt'  : '22pt';
  const h2Size    = onePage ? '8pt'   : '9pt';
  const smallSize = onePage ? '8.5pt' : '9.5pt';
  const bodyPad   = onePage ? '0.45in 0.55in' : '0.7in 0.75in';
  const secGap    = onePage ? '10px'  : '16px';
  return `
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;font-size:${baseSize};color:#111;line-height:1.5;}
.page{background:#fff;max-width:8.5in;margin:20px auto;padding:${bodyPad};box-shadow:0 2px 14px rgba(0,0,0,.12);}
.resume-header{margin-bottom:${secGap};}
.cand-name{font-size:${h1Size};font-weight:700;color:#0a0a0a;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;}
.contact-line{font-size:${smallSize};color:#555;display:flex;flex-wrap:wrap;gap:2px 0;align-items:center;}
.contact-line span{white-space:nowrap;}
.sep{margin:0 8px;color:#bbb;}
.summary{font-size:${baseSize};line-height:1.55;color:#333;margin-bottom:${secGap};}
.section-head{font-size:${h2Size};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#111;border-bottom:2px solid #111;padding-bottom:2px;margin:${secGap} 0 8px;}
.exp-block{margin-bottom:10px;}
.exp-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;}
.exp-title{font-weight:700;font-size:${baseSize};}
.exp-date{font-size:${smallSize};color:#666;white-space:nowrap;margin-left:8px;}
.exp-company{font-size:${smallSize};color:#444;margin-bottom:4px;}
ul{margin:4px 0 0 1.2em;}
li{margin-bottom:2px;font-size:${baseSize};line-height:1.45;}
.skills-list{display:block;margin-bottom:4px;}
.skill-chip{font-size:${baseSize};}
.skill-chip::after{content:' · ';}
.skill-chip:last-child::after{content:'';}
.edu-block{margin-bottom:8px;}
.edu-header{display:flex;justify-content:space-between;align-items:baseline;}
.edu-degree{font-weight:700;}
${basePrintCss(onePage)}`;
}

// ─── Edge function handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return jsonWithCors({ status: 'healthy' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorWithCors('Auth required', 401);
    }

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient      = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return errorWithCors('Invalid session', 401);
    }

    // Rate limiting
    const { RateLimiter } = await import("../_shared/rate-limiter.ts");
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const limiter  = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('generate-resume', {
      free: { max: 15, window: 300 },
      pro:  { max: 60, window: 300 },
    });
    if (!allowed) {
      return errorWithCors(limitError || 'Too many requests', 429);
    }

    const { profile, template = 'minimalist', accentColor = '#475569', onePage = false } = await req.json();

    if (!profile?.identity) {
      return errorWithCors('Profile data required', 400);
    }

    const content = buildHtml(profile as Profile, {
      template,
      accent: accentColor,
      onePage,
    });

    console.log(`[RESUME] Built HTML (template=${template}, onePage=${onePage}), length=${content.length}`);

    return jsonWithCors({ success: true, content });

  } catch (error: unknown) {
    console.error('[RESUME] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return errorWithCors(msg, 500);
  }
});
