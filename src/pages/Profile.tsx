import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import { saveCandidateProfile, CandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Loader2, X, Edit2, Eye, Ban } from "lucide-react";
import DashboardSkeleton from "@/components/DashboardSkeleton";

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
            console.log("[PROFILE] Initializing with pending profile from upload:", state.pendingProfile.identity.name);
            setFormData(state.pendingProfile);
            if (state.mode) {
                setMode(state.mode);
            } else {
                setMode('edit'); // Default to edit mode when coming from upload
            }
            // Clear navigation state to prevent reload issues
            window.history.replaceState({}, document.title);
        }
        // Priority 2: Use existing profile from database
        else if (profile && !formData) {
            console.log("[PROFILE] Initializing with existing profile from database:", profile.identity.name);
            setFormData(JSON.parse(JSON.stringify(profile))); // Deep copy
        }
        // Priority 3: Update formData when profile changes (e.g., after save)
        else if (profile && formData && profile.identity.name !== formData.identity.name) {
            console.log("[PROFILE] Updating formData with refreshed profile:", profile.identity.name);
            setFormData(JSON.parse(JSON.stringify(profile)));
        }
    }, [profile, location.state]);

    const handleSave = async () => {
        if (!user || !formData) return;

        setIsSaving(true);
        try {
            await saveCandidateProfile(user.id, formData);
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
        setMode('view');
    };

    // --- Handlers (Only work in 'edit' mode) ---
    const updateIdentity = (field: string, value: string) => {
        setFormData(prev => prev ? ({ ...prev, identity: { ...prev.identity, [field]: value } }) : null);
    };

    const updateExperience = (index: number, field: keyof ExperienceAtom, value: any) => {
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
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Header */}
            <header className="fixed top-0 w-full z-50 border-b border-border bg-background">
                <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Button>

                    <div className="flex gap-2">
                        {mode === 'view' && (
                            <Button onClick={() => setMode('edit')} variant="outline">
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit Profile
                            </Button>
                        )}
                        {mode === 'edit' && (
                            <>
                                <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                                <Button onClick={() => setMode('preview')} variant="default">
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview Changes
                                </Button>
                            </>
                        )}
                        {mode === 'preview' && (
                            <>
                                <Button variant="ghost" onClick={() => setMode('edit')}>Back to Edit</Button>
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="container max-w-4xl mx-auto px-4 pt-24 space-y-8 animate-fade-in">

                {/* --- VIEW / PREVIEW MODE (READ ONLY) --- */}
                {(mode === 'view' || mode === 'preview') && (
                    <div className="space-y-8">
                        {mode === 'preview' && (
                            <div className="bg-secondary border border-border p-4 rounded-lg text-foreground flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                <span className="font-semibold">Preview Mode - Review your changes before saving.</span>
                            </div>
                        )}

                        {/* Identity */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold">Personal Information</h2>
                            <Card className="">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                </CardContent>
                            </Card>
                        </section>

                        {/* Summary */}
                        {formData.summary && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Professional Summary</h2>
                                <Card className="">
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
                                    <Card key={idx} className="">
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
                                    <Card key={idx} className="">
                                        <CardContent className="p-6 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-semibold">{edu.school}</h3>
                                                <p className="text-sm text-muted-foreground">{edu.degree}</p>
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
                                    <Badge key={i} variant="secondary" className="px-3 py-1">{s.name}</Badge>
                                ))}
                            </div>
                        </section>


                        {/* Custom Sections */}
                        {formData.custom_sections && formData.custom_sections.length > 0 && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Additional Information</h2>
                                <div className="space-y-4">
                                    {formData.custom_sections.map((section, idx) => (
                                        <Card key={idx} className="">
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
                        <div className="space-y-8 animate-fade-in">
                            {/* Identity Section */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Personal Information</h2>
                                <Card className="">
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
                                                    className="bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Summary Section */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Professional Summary</h2>
                                <Card className="">
                                    <CardContent className="p-6">
                                        <Textarea
                                            value={formData.summary || ""}
                                            onChange={(e) => setFormData(prev => prev ? ({ ...prev, summary: e.target.value }) : null)}
                                            className="min-h-[120px] bg-transparent resize-y text-lg"
                                            placeholder="Brief professional summary..."
                                        />
                                    </CardContent>
                                </Card>
                            </section>

                            {/* Experience Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold">Experience</h2>
                                    <Button size="sm" variant="outline" onClick={addExperience}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Role
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {formData.experience_atoms.map((exp, index) => (
                                        <Card key={exp.id || index} className=" group hover:border-foreground/20 transition-colors">
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
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => removeExperience(index)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </CardHeader>
                                            <CardContent>
                                                <Textarea
                                                    value={exp.content}
                                                    onChange={(e) => updateExperience(index, "content", e.target.value)}
                                                    className="min-h-[100px] bg-transparent resize-y"
                                                    placeholder="Describe your responsibilities and achievements..."
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
                                        <Card key={index} className=" group hover:border-foreground/20 transition-colors">
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
                                                            placeholder="Degree"
                                                        />
                                                        <Input
                                                            value={edu.year}
                                                            onChange={(e) => updateEducation(index, "year", e.target.value)}
                                                            className="text-sm bg-transparent w-24"
                                                            placeholder="Year"
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
                                <Card className="">
                                    <CardContent className="p-6 space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {formData.skills.map((skill, index) => (
                                                <Badge key={index} variant="secondary" className="pl-3 pr-1 py-1 h-8 text-sm">
                                                    {skill.name}
                                                    <button
                                                        onClick={() => removeSkill(index)}
                                                        className="ml-2 hover:bg-destructive/20 rounded-full p-0.5"
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
                                            />
                                            <Button variant="outline" size="icon" onClick={() => {
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
                                        <Card key={idx} className=" group hover:border-foreground/20 transition-colors">
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
                                                    className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                                                    className="min-h-[100px] bg-transparent resize-y"
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
