import { CandidateProfile } from "@/lib/resume_engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Briefcase, GraduationCap, Code2, User, Mail, Phone, TrendingUp, AlertCircle, FileText, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface ProfilePanelProps {
    profile: CandidateProfile | null;
}

interface StrengthResult {
    score: number;
    label: string;
    color: string;
    ringClass: string;
    barClass: string;
    tips: string[];
}

function getProfileStrength(profile: CandidateProfile | null): StrengthResult {
    const noProfile: StrengthResult = {
        score: 0, label: "No profile", color: "text-destructive",
        ringClass: "stroke-destructive", barClass: "bg-destructive",
        tips: ["Build your profile to unlock AI-powered job matching"],
    };
    if (!profile) return noProfile;

    const checks = [
        { done: !!profile.identity?.name, tip: "Add your full name" },
        { done: !!profile.identity?.email, tip: "Add your email address" },
        { done: !!profile.identity?.phone, tip: "Add your phone number" },
        { done: !!(profile.summary?.trim()), tip: "Write a professional summary" },
        { done: (profile.experience_atoms?.length ?? 0) >= 1, tip: "Add at least one work experience" },
        { done: (profile.experience_atoms?.length ?? 0) >= 3, tip: "Add 3+ work experiences" },
        { done: (profile.skills?.length ?? 0) >= 5, tip: "Add at least 5 skills" },
        { done: (profile.skills?.length ?? 0) >= 10, tip: "Add 10+ skills for better matching" },
        { done: (profile.education?.length ?? 0) >= 1, tip: "Add your education" },
    ];

    const done = checks.filter(c => c.done).length;
    const score = Math.round((done / checks.length) * 100);
    const tips = checks.filter(c => !c.done).map(c => c.tip).slice(0, 3);

    let label = "Getting started";
    let color = "text-destructive";
    let ringClass = "stroke-destructive";
    let barClass = "bg-destructive";

    if (score >= 90) { label = "Elite"; color = "text-success"; ringClass = "stroke-success"; barClass = "bg-success"; }
    else if (score >= 70) { label = "Strong"; color = "text-success"; ringClass = "stroke-success"; barClass = "bg-success"; }
    else if (score >= 50) { label = "Good"; color = "text-warning"; ringClass = "stroke-warning"; barClass = "bg-warning"; }
    else if (score >= 30) { label = "Fair"; color = "text-warning"; ringClass = "stroke-warning"; barClass = "bg-warning"; }

    return { score, label, color, ringClass, barClass, tips };
}

const ProfilePanel = ({ profile }: ProfilePanelProps) => {
    const navigate = useNavigate();
    const strength = getProfileStrength(profile);

    const initials = profile?.identity?.name
        ? profile.identity.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    const circumference = 2 * Math.PI * 28;

    if (!profile) {
        return (
            <div className="text-center py-20 space-y-4">
                <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold">No profile yet</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                        Build your profile to unlock AI-powered job matching and tailored resumes
                    </p>
                </div>
                <div className="flex gap-2 justify-center">
                    <Button onClick={() => navigate("/resume-builder")} className="gap-2">
                        <FileText className="w-4 h-4" />
                        Build Profile
                    </Button>
                    <Button onClick={() => navigate("/profile")} variant="outline" className="gap-2">
                        <Edit2 className="w-4 h-4" />
                        Enter Manually
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 max-w-3xl"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    {/* Avatar with animated strength ring */}
                    <div className="relative shrink-0">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                            <motion.circle
                                cx="32" cy="32" r="28" fill="none"
                                className={strength.ringClass}
                                strokeWidth="4"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: circumference - (circumference * strength.score) / 100 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-bold text-primary">{initials}</span>
                        </div>
                    </div>

                    <div>
                        <h1 className="text-xl font-bold leading-tight">{profile.identity.name}</h1>
                        {profile.experience_atoms?.[0] && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {profile.experience_atoms[0].role}
                                {profile.experience_atoms[0].company && ` · ${profile.experience_atoms[0].company}`}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            {profile.identity.email && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="w-3 h-3" />{profile.identity.email}
                                </span>
                            )}
                            {profile.identity.phone && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Phone className="w-3 h-3" />{profile.identity.phone}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button onClick={() => navigate("/profile")} variant="outline" size="sm" className="shrink-0 gap-2">
                        <Edit2 className="w-4 h-4" />
                        Edit Profile
                    </Button>
                    {profile.resume_file_url && (
                        <Button onClick={() => window.open(profile.resume_file_url!, '_blank')} variant="outline" size="sm" className="shrink-0 gap-2">
                            <Download className="w-4 h-4" />
                            Download Resume
                        </Button>
                    )}
                </div>
            </div>

            {/* Profile Strength Card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">Profile Strength</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${strength.color}`}>{strength.label}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{strength.score}%</span>
                    </div>
                </div>

                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full rounded-full ${strength.barClass}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${strength.score}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>

                {strength.tips.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-medium text-muted-foreground">Quick wins to improve your match rate:</p>
                        {strength.tips.map((tip, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    if (tip.includes("experience") || tip.includes("role")) navigate("/resume-builder?section=experience");
                                    else if (tip.includes("skill")) navigate("/resume-builder?section=skills");
                                    else if (tip.includes("education")) navigate("/resume-builder?section=education");
                                    else if (tip.includes("summary")) navigate("/resume-builder?section=summary");
                                    else navigate("/resume-builder");
                                }}
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors w-full text-left group"
                            >
                                <AlertCircle className="w-3 h-3 text-warning shrink-0" />
                                <span className="group-hover:underline">{tip}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { icon: Briefcase, label: "Experiences", value: profile.experience_atoms?.length ?? 0, suffix: profile.experience_atoms?.length === 1 ? "role" : "roles" },
                    { icon: Code2, label: "Skills", value: profile.skills?.length ?? 0, suffix: "listed" },
                    { icon: GraduationCap, label: "Education", value: profile.education?.length ?? 0, suffix: profile.education?.length === 1 ? "entry" : "entries" },
                ].map(stat => (
                    <div key={stat.label} className="rounded-xl border border-border bg-card p-4 text-center">
                        <stat.icon className="w-4 h-4 text-primary mx-auto mb-2" />
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{stat.suffix}</div>
                    </div>
                ))}
            </div>

            {/* Summary */}
            {profile.summary && (
                <div className="space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</h2>
                    <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">{profile.summary}</p>
                </div>
            )}

            {/* Skills */}
            {profile.skills.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills</h2>
                    <div className="flex flex-wrap gap-1.5">
                        {profile.skills.slice(0, 20).map((skill, i) => (
                            <Badge key={i} variant="secondary" className="bg-primary/8 text-primary border-primary/15 text-xs px-2.5 py-1">
                                {skill.name}
                            </Badge>
                        ))}
                        {profile.skills.length > 20 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                +{profile.skills.length - 20} more
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {/* Experience */}
            {profile.experience_atoms.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience</h2>
                    <div className="space-y-2">
                        {profile.experience_atoms.slice(0, 4).map((exp, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/30 hover:border-primary/20 transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Briefcase className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold leading-tight">{exp.role}</p>
                                            <p className="text-xs text-muted-foreground">{exp.company}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] shrink-0 font-normal">{exp.duration}</Badge>
                                    </div>
                                    {exp.content && (
                                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{exp.content}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Education */}
            {profile.education.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Education</h2>
                    <div className="flex flex-wrap gap-2">
                        {profile.education.map((edu, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/30 text-sm">
                                <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-medium">{edu.school}</span>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">{edu.degree}</span>
                                {edu.year && <Badge variant="outline" className="text-[10px] font-normal">{edu.year}</Badge>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                    A complete profile improves your AI match scores by up to 3×
                </p>
                <Button onClick={() => navigate("/profile")} size="sm" className="gap-2 shrink-0">
                    <Edit2 className="w-4 h-4" />
                    Edit Full Profile
                </Button>
            </div>
        </motion.div>
    );
};

export default ProfilePanel;
