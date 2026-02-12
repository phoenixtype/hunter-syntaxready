import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { savePreferences, UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";
import { Loader2, Check, X, Plus, ArrowLeft, Eye, Edit2 } from "lucide-react";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { CandidateProfile, saveCandidateProfile, ExperienceAtom, Education } from "@/lib/resume_engine";
import { triggerJobCrawl } from "@/lib/crawler_engine";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const Onboarding = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Flow: upload -> edit -> preview -> configure
    const [step, setStep] = useState<'upload' | 'edit' | 'preview' | 'configure'>('upload');
    const [pendingProfile, setPendingProfile] = useState<CandidateProfile | null>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [user, authLoading, navigate]);

    // --- Configuration State ---
    const [roles, setRoles] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState("");
    const [salary, setSalary] = useState([120000]);
    const [locations, setLocations] = useState("");
    const [remotePolicy, setRemotePolicy] = useState<UserPreferences['remote_policy']>('any');
    const [aggressiveness, setAggressiveness] = useState([5]);

    const handleResumeParsed = async (profile: CandidateProfile) => {
        setPendingProfile(profile);

        // Pre-fill preferences based on resume
        const suggestedRoles = [
            ...profile.experience_atoms.map(exp => exp.role),
            ...profile.skills.slice(0, 3).map(s => s.name)
        ].slice(0, 5);
        setRoles(prev => Array.from(new Set([...prev, ...suggestedRoles])));

        // Skip edit/preview - go directly to crawling jobs
        toast.info("Resume uploaded! Starting job search...");

        // Trigger job crawl in background using skills/roles as keywords
        const keywords = [
            ...profile.skills.slice(0, 5).map(s => s.name),
            ...profile.experience_atoms.slice(0, 2).map(exp => exp.role)
        ].filter(Boolean);

        try {
            const result = await triggerJobCrawl(undefined, keywords.length > 0 ? keywords : ['remote jobs', 'hiring now']);
            if (result.success) {
                toast.success(`Found ${result.inserted || 0} new job opportunities!`);
            } else {
                console.warn('[CRAWL] Crawl completed with issues:', result.error);
                toast.warning(result.error || 'Job search completed with no results. Try again from the dashboard.');
            }
        } catch (err) {
            console.error('[CRAWL] Failed to trigger crawl:', err);
            toast.error('Job search failed. You can try again from the dashboard.');
        }

        // Skip to configure step (bypass edit/preview)
        setStep('configure');
    };

    // --- Profile Edit Handlers ---
    const updateIdentity = (field: string, value: string) => {
        setPendingProfile(prev => prev ? ({ ...prev, identity: { ...prev.identity, [field]: value } }) : null);
    };

    const updateExperience = (index: number, field: keyof ExperienceAtom, value: any) => {
        setPendingProfile(prev => {
            if (!prev) return null;
            const newExp = [...prev.experience_atoms];
            newExp[index] = { ...newExp[index], [field]: value };
            return { ...prev, experience_atoms: newExp };
        });
    };

    const removeExperience = (index: number) => {
        setPendingProfile(prev => prev ? ({ ...prev, experience_atoms: prev.experience_atoms.filter((_, i) => i !== index) }) : null);
    };

    const removeSkill = (index: number) => {
        setPendingProfile(prev => prev ? ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }) : null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        const prefs: UserPreferences = {
            target_roles: roles,
            min_salary_usd: salary[0],
            locations: locations.split(',').map(s => s.trim()).filter(Boolean),
            remote_policy: remotePolicy,
            aggressiveness: aggressiveness[0],
            safe_mode: true
        };

        try {
            // 1. Save Profile
            if (pendingProfile) {
                await saveCandidateProfile(user.id, pendingProfile);
            }
            // 2. Save Preferences
            await savePreferences(user.id, prefs);

            toast.success("Setup complete! Initializing agent...");
            navigate("/dashboard");
        } catch (error) {
            console.error("Failed to save onboarding data:", error);
            toast.error("Failed to finish setup. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 animate-fade-in py-12">
            <div className="w-full max-w-3xl space-y-8">

                {/* Header */}
                <div className="space-y-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                        {step === 'upload' && <>Upload your <span className="gradient-text">Resume</span></>}
                        {step === 'edit' && <>Refine your <span className="gradient-text">Profile</span></>}
                        {step === 'preview' && <>Confirm <span className="gradient-text">Details</span></>}
                        {step === 'configure' && <>Define your <span className="gradient-text">Hunt</span></>}
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        {step === 'upload' && "Let's analyze your experience to get started."}
                        {step === 'edit' && "Edit any details that we missed or got wrong."}
                        {step === 'preview' && "Review the final profile before proceeding."}
                        {step === 'configure' && "Configure parameters for the autonomous agent."}
                    </p>
                </div>

                {/* STEP 1: UPLOAD */}
                {step === 'upload' && (
                    <div className="animate-scale-in">
                        <ResumeUpload onUploadComplete={handleResumeParsed} />
                    </div>
                )}

                {/* STEP 2: EDIT (Inputs) */}
                {step === 'edit' && pendingProfile && (
                    <div className="space-y-8 animate-fade-in">
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold">Identity</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={pendingProfile.identity.name}
                                        onChange={(e) => updateIdentity('name', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        value={pendingProfile.identity.email}
                                        onChange={(e) => updateIdentity('email', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone</Label>
                                    <Input
                                        value={pendingProfile.identity.phone || ""}
                                        onChange={(e) => updateIdentity('phone', e.target.value)}
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold">Experience</h3>
                            <div className="space-y-4">
                                {pendingProfile.experience_atoms.map((exp, idx) => (
                                    <Card key={idx} className="bg-muted/30">
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 space-y-2">
                                                    <Input
                                                        value={exp.role}
                                                        onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                                                        className="font-bold border-transparent bg-transparent px-0 text-lg focus-visible:bg-background focus-visible:px-3 focus-visible:border-input"
                                                        placeholder="Role"
                                                    />
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={exp.company}
                                                            onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                                                            className="text-sm border-transparent bg-transparent px-0 text-muted-foreground w-1/2 focus-visible:bg-background focus-visible:px-3 focus-visible:border-input"
                                                            placeholder="Company"
                                                        />
                                                        <Input
                                                            value={exp.duration}
                                                            onChange={(e) => updateExperience(idx, 'duration', e.target.value)}
                                                            className="text-sm border-transparent bg-transparent px-0 text-muted-foreground w-1/2 text-right focus-visible:bg-background focus-visible:px-3 focus-visible:border-input"
                                                            placeholder="Duration"
                                                        />
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => removeExperience(idx)} className="text-destructive">
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <Textarea
                                                value={exp.content}
                                                onChange={(e) => updateExperience(idx, 'content', e.target.value)}
                                                className="min-h-[80px] text-sm text-muted-foreground"
                                                placeholder="Responsibilites..."
                                            />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep('upload')}>
                                Re-upload
                            </Button>
                            <Button onClick={() => setStep('preview')} className="px-8">
                                <Eye className="w-4 h-4 mr-2" />
                                Preview Profile
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: PREVIEW (Read Only) */}
                {step === 'preview' && pendingProfile && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-muted/30 p-8 rounded-xl border space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold">{pendingProfile.identity.name}</h2>
                                    <div className="text-muted-foreground space-y-1 mt-1">
                                        <p>{pendingProfile.identity.email}</p>
                                        <p>{pendingProfile.identity.phone}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Skills */}
                            <div>
                                <h3 className="font-semibold mb-3">Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {pendingProfile.skills.map((s, i) => (
                                        <Badge key={i} variant="outline">{s.name}</Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Experience */}
                            <div className="space-y-4">
                                <h3 className="font-semibold border-b pb-2">Experience</h3>
                                {pendingProfile.experience_atoms.map((exp, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex justify-between font-medium">
                                            <span>{exp.role}</span>
                                            <span className="text-muted-foreground text-sm">{exp.duration}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{exp.company}</p>
                                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mt-2">{exp.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep('edit')}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Back to Edit
                            </Button>
                            <Button onClick={() => setStep('configure')} className="px-8">
                                Confirm & Configure
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIGURE */}
                {step === 'configure' && (
                    <form onSubmit={handleSubmit} className="space-y-12 animate-fade-in">
                        {/* Roles */}
                        <div className="space-y-4">
                            <Label className="text-lg font-medium">Target Roles</Label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {roles.map((role, index) => (
                                    <div key={index} className="flex items-center gap-1 bg-secondary/50 text-secondary-foreground px-3 py-1.5 rounded-full text-sm font-medium animate-scale-in border border-primary/20">
                                        <span>{role}</span>
                                        <button
                                            type="button"
                                            onClick={() => setRoles(roles.filter((_, i) => i !== index))}
                                            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={currentRole}
                                    onChange={(e) => setCurrentRole(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (currentRole.trim()) {
                                                if (!roles.includes(currentRole.trim())) {
                                                    setRoles([...roles, currentRole.trim()]);
                                                }
                                                setCurrentRole("");
                                            }
                                        }
                                    }}
                                    placeholder="Type a role and press Enter..."
                                    className="h-14 text-lg bg-transparent border-2 border-muted focus-visible:ring-0 focus-visible:border-primary transition-all duration-300 input-glow"
                                />
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (currentRole.trim()) {
                                            if (!roles.includes(currentRole.trim())) {
                                                setRoles([...roles, currentRole.trim()]);
                                            }
                                            setCurrentRole("");
                                        }
                                    }}
                                    className="h-14 px-6"
                                    variant="secondary"
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Salary */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <Label className="text-lg font-medium">Minimum Base Salary</Label>
                                <span className="text-2xl font-mono">${salary[0].toLocaleString()}</span>
                            </div>
                            <Slider
                                value={salary}
                                onValueChange={setSalary}
                                min={50000}
                                max={500000}
                                step={5000}
                                className="py-4"
                            />
                        </div>

                        {/* Location */}
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-lg font-medium">Locations</Label>
                                <Input
                                    value={locations}
                                    onChange={(e) => setLocations(e.target.value)}
                                    placeholder="e.g. San Francisco, New York, London"
                                    className="h-12 bg-transparent border-muted"
                                />
                            </div>
                            <div className="space-y-4">
                                <Label className="text-lg font-medium">Remote Policy</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['remote', 'hybrid', 'onsite', 'any'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setRemotePolicy(mode)}
                                            className={`h-12 border rounded-lg text-sm font-medium transition-all duration-300 ${remotePolicy === mode
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-muted hover:border-primary/50 hover:bg-secondary/50'
                                                }`}
                                        >
                                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Aggressiveness */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <Label className="text-lg font-medium">Agent Aggressiveness</Label>
                                <span className="text-xl font-mono text-muted-foreground">Level {aggressiveness[0]}</span>
                            </div>
                            <Slider
                                value={aggressiveness}
                                onValueChange={setAggressiveness}
                                min={1}
                                max={10}
                                step={1}
                                className="py-4"
                            />
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="outline" type="button" onClick={() => setStep('upload')}>
                                Re-upload Resume
                            </Button>
                            <Button
                                type="submit"
                                size="lg"
                                variant="gradient"
                                className="w-full md:w-auto h-16 px-12 text-lg font-bold rounded-full ml-auto"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : "Initiate Agent"}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
