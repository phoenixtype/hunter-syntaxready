import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SingleLocationPicker from "@/components/SingleLocationPicker";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import SEOHead from "@/components/SEOHead";
import { saveCandidateProfile, CandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, X, Edit2, Eye, Ban, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DashboardSkeleton from "@/components/DashboardSkeleton";

function handleBulletKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  setter: (val: string) => void
) {
  if (e.key === "Enter") {
    e.preventDefault();
    const { selectionStart, selectionEnd } = e.currentTarget;
    const newVal = value.substring(0, selectionStart) + "\n• " + value.substring(selectionEnd);
    setter(newVal);
    const newPos = selectionStart + 3;
    setTimeout(() => e.currentTarget.setSelectionRange(newPos, newPos), 0);
  }
}

const Profile = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { profile, loading, setProfile } = useResume();

    // Modes: 'view' (Read Only) -> 'edit' (Inputs) -> 'preview' (Confirmation)
    const [mode, setMode] = useState<'view' | 'edit' | 'preview'>('view');
    const [formData, setFormData] = useState<CandidateProfile | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize form data when profile fetches or when entering edit mode
    useEffect(() => {
        const state = location.state as { pendingProfile?: CandidateProfile; mode?: 'edit' | 'view' | 'preview' };

        // Priority 1: Use pending profile from navigation (e.g., from resume upload)
        if (state?.pendingProfile) {
            setFormData(state.pendingProfile);
            if (state.mode) {
                setMode(state.mode);
            } else {
                setMode('edit'); // Default to edit mode when coming from upload
            }
            // Clear navigation state to prevent reload issues
            window.history.replaceState({}, document.title);
        }
        // Priority 2: Use existing profile from database (only if not already editing)
        else if (profile && !formData) {
            setFormData(JSON.parse(JSON.stringify(profile))); // Deep copy
        }
        // Priority 3: Explicitly update formData when profile changes after a save (handled by handleSave)
        // We remove the overly aggressive auto-update that was causing state loss
    }, [profile, user?.id, location.state, formData]);

    // Auto-save draft to localStorage (debounced)
    useEffect(() => {
        if (!user?.id || mode !== 'edit' || !formData) return;

        const timer = setTimeout(() => {
            localStorage.setItem(`hunter_profile_draft_${user.id}`, JSON.stringify(formData));
        }, 2000);
 
        return () => clearTimeout(timer);
    }, [formData, mode, user?.id]);

    // Check for draft on mount or mode change
    useEffect(() => {
        if (!user?.id || mode !== 'edit' || !formData) return;

        const savedDraft = localStorage.getItem(`hunter_profile_draft_${user.id}`);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                // Simple heuristic: if draft name/email/etc differs from current formData, offer to restore or just notify
                // For now, we'll just check if it's different and maybe log it or auto-restore if formData is "clean"
                if (JSON.stringify(draft) !== JSON.stringify(profile)) {
                    // console.log("[PROFILE] Local draft detected, could restore...");
                    // toast.info("Found an unsaved draft from your last visit");
                }
            } catch (e) {
                console.error("Failed to parse profile draft", e);
            }
        }
    }, [mode, user?.id, formData, profile]);

    const handleSave = async () => {
        if (!user || !formData) return;

        setIsSaving(true);
        try {
            await saveCandidateProfile(user.id, formData);
            localStorage.removeItem(`hunter_profile_draft_${user.id}`);
            setProfile(formData); // Update global context
            toast.success("Profile updated successfully!");
            setMode('view'); // Return to view mode
        } catch (error) {
            console.error("Failed to save profile:", error);
            toast.error("Failed to save profile changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        // Reset data and go back to view
        if (profile) {
            setFormData(JSON.parse(JSON.stringify(profile)));
        }
        if (user?.id) {
            localStorage.removeItem(`hunter_profile_draft_${user.id}`);
        }
        setMode('view');
    };

    // --- Handlers (Only work in 'edit' mode) ---
    const updateIdentity = (field: string, value: string) => {
        setFormData(prev => prev ? ({ ...prev, identity: { ...prev.identity, [field]: value } }) : null);
    };

    const updateExperience = (index: number, field: keyof ExperienceAtom, value: string | string[]) => {
      setFormData(prev => {
            if (!prev) return null;
            const newExp = [...prev.experience_atoms];
            newExp[index] = { ...newExp[index], [field]: value };
            return { ...prev, experience_atoms: newExp };
        });
    };

    const addExperience = () => {
        setFormData(prev => {
            if (!prev) return null;
            const newAtom: ExperienceAtom = {
                id: crypto.randomUUID(),
                role: "New Role",
                company: "Company Name",
                duration: "YYYY - Present",
                content: "Description...",
                keywords: []
            };
            return { ...prev, experience_atoms: [newAtom, ...prev.experience_atoms] };
        });
    };

    const removeExperience = (index: number) => {
        setFormData(prev => {
            if (!prev) return null;
            const newExp = prev.experience_atoms.filter((_, i) => i !== index);
            return { ...prev, experience_atoms: newExp };
        });
    };

    const moveExperience = (index: number, direction: 'up' | 'down') => {
        setFormData(prev => {
            if (!prev) return null;
            const newExp = [...prev.experience_atoms];
            if (direction === 'up' && index > 0) {
                [newExp[index - 1], newExp[index]] = [newExp[index], newExp[index - 1]];
            } else if (direction === 'down' && index < newExp.length - 1) {
                [newExp[index + 1], newExp[index]] = [newExp[index], newExp[index + 1]];
            }
            return { ...prev, experience_atoms: newExp };
        });
    };

    const sortExperiencesByDate = () => {
        setFormData(prev => {
            if (!prev) return null;
            const sorted = [...prev.experience_atoms].sort((a, b) => {
                const parseDate = (dateStr: string) => {
                    if (!dateStr) return 0;
                    const parts = dateStr.split('-');
                    const endStr = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                    if (endStr.toLowerCase() === 'present') return Infinity;
                    const date = new Date(endStr);
                    return isNaN(date.getTime()) ? 0 : date.getTime();
                };
                return parseDate(b.duration) - parseDate(a.duration);
            });
            return { ...prev, experience_atoms: sorted };
        });
    };

    const updateEducation = (index: number, field: keyof Education, value: string) => {
        setFormData(prev => {
            if (!prev) return null;
            const newEdu = [...prev.education];
            newEdu[index] = { ...newEdu[index], [field]: value };
            return { ...prev, education: newEdu };
        });
    };

    const addEducation = () => {
        setFormData(prev => {
            if (!prev) return null;
            const newEdu: Education = { school: "University", degree: "Degree", year: "Year" };
            return { ...prev, education: [...prev.education, newEdu] };
        });
    };

    const removeEducation = (index: number) => {
        setFormData(prev => {
            if (!prev) return null;
            const newEdu = prev.education.filter((_, i) => i !== index);
            return { ...prev, education: newEdu };
        });
    };

    const removeSkill = (index: number) => {
        setFormData(prev => {
            if (!prev) return null;
            // The following line `const skills = (data.skills || []) as unknown as Record<string, unknown>[];` was removed as `data` is undefined in this scope.
            const newSkills = prev.skills.filter((_, i) => i !== index);
            return { ...prev, skills: newSkills };
        });
    };

    const addSkill = (name: string) => {
        if (!name.trim()) return;
        setFormData(prev => {
            if (!prev) return null;
            if (prev.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) return prev;
            return { ...prev, skills: [...prev.skills, { name, proficiency: 1, evidence: [] }] };
        });
    };


    if (loading || !formData) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-background text-foreground  pb-24 lg:pb-12 safe-area-inset-bottom">
            <SEOHead title="Profile" description="Manage your candidate profile, experience, and skills." path="/profile" noIndex />
            <PageHeader
                breadcrumbs={[
                    { label: "Dashboard", href: "/dashboard" },
                    { label: "Profile" },
                ]}
                actions={
                <div className="flex gap-1.5 sm:gap-2">
                        {mode === 'view' && (
                            <Button onClick={() => setMode('edit')} variant="outline" size="sm">
                                <Edit2 className="w-4 h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Edit Profile</span>
                            </Button>
                        )}
                        {mode === 'edit' && (
                            <>
                                <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
                                <Button size="sm" onClick={() => setMode('preview')} className=" hover: transition-all">
                                    <Eye className="w-4 h-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Preview</span>
                                </Button>
                            </>
                        )}
                        {mode === 'preview' && (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => setMode('edit')}>Back</Button>
                                <Button size="sm" onClick={handleSave} disabled={isSaving} className=" hover: transition-all">
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 sm:mr-2" />
                                            <span className="hidden sm:inline">Save</span>
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            <main className="container max-w-4xl mx-auto px-4 pt-20 sm:pt-24 space-y-8 animate-fade-in pb-8">

                {/* --- VIEW / PREVIEW MODE (READ ONLY) --- */}
                {(mode === 'view' || mode === 'preview') && (
                    <div className="space-y-8">
                        {mode === 'preview' && (
                            <div className="bg-secondary border border-border p-4 rounded-md text-foreground flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                <span className="font-semibold">Preview Mode - Review your changes before saving.</span>
                            </div>
                        )}

                        {/* Identity */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold">Personal Information</h2>
                            <Card className="border-border bg-card">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                    <div>
                                        <Label className="text-muted-foreground">Full Name</Label>
                                        <p className="text-lg font-medium">{formData.identity.name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Email</Label>
                                        <p className="text-lg font-medium">{formData.identity.email}</p>
                                    </div>
                                    <div>
                                        <Label className="text-muted-foreground">Phone</Label>
                                        <p className="text-lg font-medium">{formData.identity.phone || "Not set"}</p>
                                    </div>
                                    {formData.identity.location && (
                                        <div>
                                            <Label className="text-muted-foreground">Current Location</Label>
                                            <p className="text-lg font-medium">{formData.identity.location}</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </section>

                        {/* Summary */}
                        {formData.summary && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Professional Summary</h2>
                                <Card className="border-border bg-card">
                                    <CardContent className="p-6">
                                        <p className="text-lg leading-relaxed whitespace-pre-wrap">{formData.summary}</p>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {/* Experience */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold">Experience</h2>
                            <div className="space-y-4">
                                {formData.experience_atoms.map((exp, idx) => (
                                    <Card key={idx} className="border-border bg-card hover:border-primary/30 transition-colors">
                                        <CardContent className="p-6 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-bold">{exp.role}</h3>
                                                    <p className="text-muted-foreground">{exp.company}</p>
                                                </div>
                                                <Badge variant="secondary">{exp.duration}</Badge>
                                            </div>
                                            <Separator className="my-2" />
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{exp.content}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>

                        {/* Education */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold">Education</h2>
                            <div className="grid gap-4">
                                {formData.education.map((edu, idx) => (
                                    <Card key={idx} className="border-border bg-card hover:border-primary/30 transition-colors">
                                        <CardContent className="p-6 flex justify-between items-start">
                                            <div>
                                                <h3 className="font-semibold">{edu.school}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {edu.degree}{edu.field ? ` — ${edu.field}` : ""}
                                                </p>
                                            </div>
                                            <Badge variant="outline">{edu.year}</Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>

                        {/* Skills */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold">Skills</h2>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.map((s, i) => (
                                    <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm">{s.name}</Badge>
                                ))}
                            </div>
                        </section>


                        {/* Custom Sections */}
                        {formData.custom_sections && formData.custom_sections.length > 0 && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Additional Information</h2>
                                <div className="space-y-4">
                                    {formData.custom_sections.map((section, idx) => (
                                        <Card key={idx} className="border-border bg-card hover:border-primary/30 transition-colors">
                                            <CardContent className="p-6 space-y-2">
                                                <h3 className="text-lg font-bold">{section.title}</h3>
                                                <Separator className="my-2" />
                                                <ul className="list-disc pl-5 space-y-1">
                                                    {section.content.map((item, i) => (
                                                        <li key={i} className="text-sm leading-relaxed">{item}</li>
                                                    ))}
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )
                }


                {/* --- EDIT MODE (INPUTS) --- */}
                {
                    mode === 'edit' && (
                        <div className="space-y-8 animate-fade-in-up">
                            {/* Identity Section */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Personal Information</h2>
                                <Card className="border-border bg-card">
                                    <CardContent className="p-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Full Name</Label>
                                                <Input
                                                    value={formData.identity.name || ""}
                                                    onChange={(e) => updateIdentity("name", e.target.value)}
                                                    className="bg-transparent"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Email</Label>
                                                <Input
                                                    value={formData.identity.email || ""}
                                                    onChange={(e) => updateIdentity("email", e.target.value)}
                                                    className="bg-transparent"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.identity.phone || ""}
                                                    onChange={(e) => updateIdentity("phone", e.target.value)}
                                                    className="bg-background/50 border-border focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Current Location</Label>
                                            <SingleLocationPicker
                                                value={formData.identity.location || ""}
                                                onChange={(loc) => updateIdentity("location", loc)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Summary Section */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Professional Summary</h2>
                                <Card className="border-border bg-card">
                                    <CardContent className="p-6">
                                        <Textarea
                                            value={formData.summary || ""}
                                            onChange={(e) => setFormData(prev => prev ? ({ ...prev, summary: e.target.value }) : null)}
                                            className="min-h-[120px] bg-background/50 border-border focus:border-primary rounded-md resize-y text-lg"
                                            placeholder="Brief professional summary..."
                                        />
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Experience Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold">Experience</h2>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={sortExperiencesByDate}>
                                            <ArrowUpDown className="w-4 h-4 mr-2" />
                                            Sort by Date
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={addExperience}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Role
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {formData.experience_atoms.map((exp, index) => (
                                        <Card key={exp.id || index} className="group border-border bg-card hover:border-primary/30 transition-colors">
                                            <CardHeader className="flex flex-row items-start justify-between pb-2">
                                                <div className="space-y-1 w-full mr-4">
                                                    <Input
                                                        value={exp.role}
                                                        onChange={(e) => updateExperience(index, "role", e.target.value)}
                                                        className="font-semibold text-lg h-auto px-0 border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/50"
                                                        placeholder="Role Title"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={exp.company}
                                                            onChange={(e) => updateExperience(index, "company", e.target.value)}
                                                            className="text-sm text-muted-foreground h-auto p-0 border-0 bg-transparent focus-visible:ring-0 w-1/2"
                                                            placeholder="Company"
                                                        />
                                                        <Input
                                                            value={exp.duration}
                                                            onChange={(e) => updateExperience(index, "duration", e.target.value)}
                                                            className="text-sm text-muted-foreground h-auto p-0 border-0 bg-transparent focus-visible:ring-0 w-1/2 text-right"
                                                            placeholder="Duration"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground"
                                                        onClick={() => moveExperience(index, 'up')}
                                                        disabled={index === 0}
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground"
                                                        onClick={() => moveExperience(index, 'down')}
                                                        disabled={index === formData.experience_atoms.length - 1}
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => removeExperience(index)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <Textarea
                                                    value={exp.content}
                                                    onChange={(e) => updateExperience(index, "content", e.target.value)}
                                                    onKeyDown={(e) => handleBulletKeyDown(e, exp.content, (val) => updateExperience(index, "content", val))}
                                                    className="min-h-[100px] bg-background/50 border-border focus:border-primary rounded-md resize-y"
                                                    placeholder="• Led a team of 5 engineers…&#10;• Improved performance by 30%&#10;&#10;Press Enter to add a new bullet."
                                                />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>

                            {/* Education Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold">Education</h2>
                                    <Button size="sm" variant="outline" onClick={addEducation}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Education
                                    </Button>
                                </div>
                                <div className="grid gap-4">
                                    {formData.education.map((edu, index) => (
                                        <Card key={index} className="group border-border bg-card hover:border-primary/30 transition-colors">
                                            <CardContent className="p-4 flex items-start gap-4">
                                                <div className="flex-1 space-y-2">
                                                    <Input
                                                        value={edu.school}
                                                        onChange={(e) => updateEducation(index, "school", e.target.value)}
                                                        className="font-medium bg-transparent"
                                                        placeholder="School / University"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={edu.degree}
                                                            onChange={(e) => updateEducation(index, "degree", e.target.value)}
                                                            className="text-sm bg-transparent flex-1"
                                                            placeholder="Degree (e.g. B.S.)"
                                                        />
                                                        <Input
                                                            value={edu.year}
                                                            onChange={(e) => updateEducation(index, "year", e.target.value)}
                                                            className="text-sm bg-transparent w-24"
                                                            placeholder="Year"
                                                        />
                                                    </div>
                                                    <Input
                                                        value={edu.field || ""}
                                                        onChange={(e) => updateEducation(index, "field", e.target.value)}
                                                        className="text-sm bg-transparent"
                                                        placeholder="Program of Study / Course (e.g. Computer Science)"
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive h-8 w-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                    onClick={() => removeEducation(index)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>

                            {/* Skills Section */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Skills</h2>
                                <Card className="border-border bg-card">
                                    <CardContent className="p-6 space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {formData.skills.map((skill, index) => (
                                                <Badge key={index} variant="secondary" className="pl-3 pr-1.5 py-1.5 h-8 text-sm gap-1 ">
                                                    {skill.name}
                                                    <button
                                                        onClick={() => removeSkill(index)}
                                                        className="hover:text-destructive transition-colors ml-1"
                                                    >
                                                <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 max-w-sm">
                                            <Input
                                                placeholder="Add a skill..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        addSkill(e.currentTarget.value);
                                                        e.currentTarget.value = "";
                                                    }
                                                }}
                                                className="bg-background/50 border-border focus:border-primary"
                                            />
                                            <Button variant="secondary" size="icon" className="rounded-md" onClick={() => {
                                                const input = document.querySelector('input[placeholder="Add a skill..."]') as HTMLInputElement;
                                                if (input) {
                                                    addSkill(input.value);
                                                    input.value = "";
                                                }
                                            }}>
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Custom Sections */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold">Additional Information</h2>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        setFormData(prev => {
                                            if (!prev) return null;
                                            return {
                                                ...prev,
                                                custom_sections: [
                                                    ...(prev.custom_sections || []),
                                                    { title: "New Section", content: ["Item 1"] }
                                                ]
                                            };
                                        });
                                    }}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Section
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {formData.custom_sections?.map((section, idx) => (
                                        <Card key={idx} className="group border-border bg-card hover:border-primary/30 transition-colors">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                <Input
                                                    value={section.title}
                                                    onChange={(e) => {
                                                        const newSections = [...(formData.custom_sections || [])];
                                                        newSections[idx].title = e.target.value;
                                                        setFormData(prev => prev ? ({ ...prev, custom_sections: newSections }) : null);
                                                    }}
                                                    className="font-bold text-lg h-auto px-0 border-0 bg-transparent focus-visible:ring-0 w-1/2"
                                                    placeholder="Section Title"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newSections = (formData.custom_sections || []).filter((_, i) => i !== idx);
                                                        setFormData(prev => prev ? ({ ...prev, custom_sections: newSections }) : null);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                <Textarea
                                                    value={section.content.join('\n')}
                                                    onChange={(e) => {
                                                        const newSections = [...(formData.custom_sections || [])];
                                                        newSections[idx].content = e.target.value.split('\n');
                                                        setFormData(prev => prev ? ({ ...prev, custom_sections: newSections }) : null);
                                                    }}
                                                    className="min-h-[100px] bg-background/50 border-border focus:border-primary rounded-md resize-y"
                                                    placeholder="List items (one per line)..."
                                                />
                                                <p className="text-xs text-muted-foreground">One item per line</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )
                }

            </main >
        </div>
    )
};

export default Profile;
