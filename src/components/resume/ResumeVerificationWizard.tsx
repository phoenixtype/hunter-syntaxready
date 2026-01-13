import { useState, useEffect } from "react";
import { CandidateProfile, saveCandidateProfile, polishText } from "@/lib/resume_engine";
import { scoreProfileHealth, ATSHealthCheck } from "@/lib/ats_scorer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, ChevronLeft, Wand2, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: CandidateProfile;
  onSave: (profile: CandidateProfile) => void;
}

const STEPS = ["Identity", "Skills", "Experience", "Education"];

export const ResumeVerificationWizard = ({ isOpen, onClose, initialData, onSave }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile>(initialData);
  const [atsScore, setAtsScore] = useState<ATSHealthCheck | null>(null);
  const [isPolishing, setIsPolishing] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) setProfile(initialData);
  }, [initialData]);

  useEffect(() => {
    setAtsScore(scoreProfileHealth(profile));
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    try {
      await saveCandidateProfile(user.id, profile);
      onSave(profile);
      toast.success("Profile saved!");
      onClose();
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const handlePolish = async (id: string, text: string) => {
    setIsPolishing(id);
    try {
      const polished = await polishText(text, 'experience');
      const newExp = profile.experience_atoms.map(exp => 
        exp.id === id ? { ...exp, content: polished } : exp
      );
      setProfile({ ...profile, experience_atoms: newExp });
      toast.success("Polished!");
    } catch {
      toast.error("Polish failed");
    } finally {
      setIsPolishing(null);
    }
  };

  const nextStep = () => setStep(Math.min(step + 1, STEPS.length - 1));
  const prevStep = () => setStep(Math.max(step - 1, 0));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Verify Your Profile</DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
            {atsScore && (
              <Badge variant={atsScore.totalScore > 70 ? "default" : "secondary"}>
                ATS Score: {atsScore.totalScore}/100
              </Badge>
            )}
          </DialogDescription>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-1 mt-2" />
        </DialogHeader>

        <ScrollArea className="flex-1 py-4">
          <div className="space-y-4 px-1">
            {/* Step 0: Identity */}
            {step === 0 && (
              <>
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Input value={profile.identity.name} onChange={(e) => setProfile({...profile, identity: {...profile.identity, name: e.target.value}})} />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={profile.identity.email} onChange={(e) => setProfile({...profile, identity: {...profile.identity, email: e.target.value}})} />
                </div>
                <div className="grid gap-2">
                  <Label>Links (LinkedIn, GitHub, etc.)</Label>
                  {profile.identity.links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={link} onChange={(e) => {
                        const newLinks = [...profile.identity.links];
                        newLinks[i] = e.target.value;
                        setProfile({...profile, identity: {...profile.identity, links: newLinks}});
                      }} />
                      <Button size="icon" variant="ghost" onClick={() => {
                        setProfile({...profile, identity: {...profile.identity, links: profile.identity.links.filter((_, idx) => idx !== i)}});
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setProfile({...profile, identity: {...profile.identity, links: [...profile.identity.links, ""]}})}>
                    <Plus className="w-3 h-3 mr-2" /> Add Link
                  </Button>
                </div>
              </>
            )}

            {/* Step 1: Skills */}
            {step === 1 && (
              <>
                <Label>Your Skills</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[80px]">
                  {profile.skills.length === 0 && <span className="text-muted-foreground text-sm">No skills yet</span>}
                  {profile.skills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {skill.name}
                      <button onClick={() => setProfile({...profile, skills: profile.skills.filter((_, idx) => idx !== i)})} className="ml-1 hover:text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
                <Input placeholder="Type skill and press Enter" onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    setProfile({...profile, skills: [...profile.skills, { name: e.currentTarget.value, proficiency: 3, evidence: [] }]});
                    e.currentTarget.value = "";
                  }
                }} />
              </>
            )}

            {/* Step 2: Experience */}
            {step === 2 && (
              <>
                {profile.experience_atoms.map((exp, i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{exp.company || "Company"} - {exp.role || "Role"}</span>
                      <Button size="icon" variant="ghost" onClick={() => setProfile({...profile, experience_atoms: profile.experience_atoms.filter((_, idx) => idx !== i)})}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Company" value={exp.company} onChange={(e) => {
                        const newExp = [...profile.experience_atoms];
                        newExp[i] = { ...newExp[i], company: e.target.value };
                        setProfile({...profile, experience_atoms: newExp});
                      }} />
                      <Input placeholder="Role" value={exp.role} onChange={(e) => {
                        const newExp = [...profile.experience_atoms];
                        newExp[i] = { ...newExp[i], role: e.target.value };
                        setProfile({...profile, experience_atoms: newExp});
                      }} />
                    </div>
                    <Input placeholder="Duration (e.g., Jan 2020 - Present)" value={exp.duration} onChange={(e) => {
                      const newExp = [...profile.experience_atoms];
                      newExp[i] = { ...newExp[i], duration: e.target.value };
                      setProfile({...profile, experience_atoms: newExp});
                    }} />
                    <div className="relative">
                      <Textarea placeholder="Description..." className="min-h-[80px] pr-10" value={exp.content} onChange={(e) => {
                        const newExp = [...profile.experience_atoms];
                        newExp[i] = { ...newExp[i], content: e.target.value };
                        setProfile({...profile, experience_atoms: newExp});
                      }} />
                      <Button size="icon" variant="ghost" className="absolute bottom-2 right-2" title="Smart Polish" onClick={() => handlePolish(exp.id, exp.content)} disabled={isPolishing === exp.id}>
                        <Wand2 className={`w-4 h-4 ${isPolishing === exp.id ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => setProfile({...profile, experience_atoms: [...profile.experience_atoms, { id: Date.now().toString(), company: "", role: "", duration: "", keywords: [], content: "" }]})}>
                  <Plus className="w-4 h-4 mr-2" /> Add Experience
                </Button>
              </>
            )}

            {/* Step 3: Education */}
            {step === 3 && (
              <>
                {profile.education.map((edu, i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">{edu.school || "School"}</span>
                      <Button size="icon" variant="ghost" onClick={() => setProfile({...profile, education: profile.education.filter((_, idx) => idx !== i)})}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input placeholder="School" value={edu.school} onChange={(e) => {
                      const newEdu = [...profile.education];
                      newEdu[i] = { ...newEdu[i], school: e.target.value };
                      setProfile({...profile, education: newEdu});
                    }} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Degree" value={edu.degree} onChange={(e) => {
                        const newEdu = [...profile.education];
                        newEdu[i] = { ...newEdu[i], degree: e.target.value };
                        setProfile({...profile, education: newEdu});
                      }} />
                      <Input placeholder="Year" value={edu.year} onChange={(e) => {
                        const newEdu = [...profile.education];
                        newEdu[i] = { ...newEdu[i], year: e.target.value };
                        setProfile({...profile, education: newEdu});
                      }} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => setProfile({...profile, education: [...profile.education, { school: "", degree: "", year: "" }]})}>
                  <Plus className="w-4 h-4 mr-2" /> Add Education
                </Button>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={prevStep} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={nextStep}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-1" /> Save Profile
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
