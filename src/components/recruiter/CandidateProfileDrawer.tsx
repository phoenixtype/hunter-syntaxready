import { X, MapPin, Briefcase, GraduationCap, Link2, Mail, Phone, Star, ExternalLink, Github, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TalentCandidate, type RecruiterJob, LOCATION_TYPE_LABELS } from "@/lib/recruiter_engine";

interface CandidateProfileDrawerProps {
  candidate: TalentCandidate;
  jobs: RecruiterJob[];
  onClose: () => void;
  onOutreach: (candidate: TalentCandidate) => void;
}

const REMOTE_POLICY_LABELS: Record<string, string> = {
  remote: "Remote only",
  hybrid: "Hybrid",
  onsite: "On-site",
  any: "Open to all",
};

const MatchBadge = ({ score }: { score?: number }) => {
  if (score === undefined) return null;
  const color =
    score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    score >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
      <Star className="w-3 h-3" />
      {score}% match
    </span>
  );
};

const getLinkIcon = (type: string) => {
  if (type === "linkedin") return <Linkedin className="w-3.5 h-3.5" />;
  if (type === "github") return <Github className="w-3.5 h-3.5" />;
  if (type === "phone") return <Phone className="w-3.5 h-3.5" />;
  if (type === "email") return <Mail className="w-3.5 h-3.5" />;
  return <Link2 className="w-3.5 h-3.5" />;
};

const getLinkLabel = (type: string) => {
  const labels: Record<string, string> = {
    linkedin: "LinkedIn",
    github: "GitHub",
    phone: "Phone",
    email: "Email",
    portfolio: "Portfolio",
    website: "Website",
    twitter: "Twitter/X",
  };
  return labels[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
};

const CandidateProfileDrawer = ({ candidate, onClose, onOutreach }: CandidateProfileDrawerProps) => {
  const initials = candidate.full_name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] z-50 bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
          <p className="text-sm font-semibold">Candidate Profile</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 text-primary font-bold text-lg flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight">{candidate.full_name}</h2>
                {candidate.match_score !== undefined && <MatchBadge score={candidate.match_score} />}
              </div>
              {candidate.headline && (
                <p className="text-sm text-muted-foreground mt-0.5">{candidate.headline}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                {candidate.locations.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {candidate.locations.slice(0, 2).join(", ")}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {candidate.experience_years}y exp
                </span>
                <span>{REMOTE_POLICY_LABELS[candidate.remote_policy] ?? candidate.remote_policy}</span>
                {candidate.min_salary_usd > 0 && (
                  <span>${Math.round(candidate.min_salary_usd / 1000)}k+ expected</span>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          {candidate.skills.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs rounded-full font-normal">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Target roles */}
          {candidate.target_roles.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Open to roles</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.target_roles.map(r => (
                  <Badge key={r} variant="outline" className="text-xs rounded-full">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {candidate.experience_atoms.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Experience</p>
              <div className="space-y-4">
                {candidate.experience_atoms.map((atom, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{atom.title}</p>
                      <p className="text-xs text-muted-foreground">{atom.company}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{atom.start} — {atom.end}</p>
                      {atom.bullets && atom.bullets.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {atom.bullets.slice(0, 3).map((b, j) => (
                            <li key={j} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
                              <span className="text-primary mt-1 shrink-0">·</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {candidate.education.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Education</p>
              <div className="space-y-3">
                {candidate.education.map((edu, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{edu.school ?? edu.institution}</p>
                      {(edu.degree || edu.field) && (
                        <p className="text-xs text-muted-foreground">{[edu.degree, edu.field].filter(Boolean).join(", ")}</p>
                      )}
                      {(edu.year ?? edu.end) && (
                        <p className="text-xs text-muted-foreground">{edu.year ?? edu.end}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {candidate.links.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links & Contact</p>
              <div className="space-y-2">
                {candidate.links.map((link, i) => {
                  const href = link.url ?? (link.type === "phone" ? `tel:${link.value}` : undefined);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{getLinkIcon(link.type)}</span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          {getLinkLabel(link.type)}
                          {link.type !== "phone" && <ExternalLink className="w-3 h-3" />}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">{link.value ?? getLinkLabel(link.type)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 border-t border-border flex gap-2 shrink-0">
          <Button className="flex-1 gap-1.5 h-10" onClick={() => onOutreach(candidate)}>
            <Mail className="w-4 h-4" />
            Reach out
          </Button>
          {candidate.links.find(l => l.type === "linkedin") && (
            <Button
              variant="outline"
              className="h-10 px-3"
              asChild
            >
              <a
                href={candidate.links.find(l => l.type === "linkedin")!.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default CandidateProfileDrawer;
