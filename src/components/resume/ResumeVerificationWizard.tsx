import { useState, useEffect } from "react";
import { CandidateProfile, saveCandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { scoreProfileHealth, ATSHealthCheck } from "@/lib/ats_scorer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, ChevronLeft, AlertCircle, Wand2, Trash2, Plus } from "lucide-react";
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

  useEffect(() => {
    if (initialData) {
      setProfile(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    // Recalculate ATS score whenever profile changes
    const score = scoreProfileHealth(profile);
    setAtsScore(score);
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    try {
      await saveCandidateProfile(user.id, profile);
      onSave(profile);
      toast.success("Profile verified and saved!");
      onClose();
    } catch (e) {
      toast.error("Failed to save profile");
    }
  };

  const nextStep = () => setStep(Math.min(step + 1, STEPS.length - 1));
  const prevStep = () => setStep(Math.max(step - 1, 0));

  const renderATSGauge = () => {
    if (!atsScore) return null;
    const score = atsScore.totalScore;
    const color = score > 80 ? "bg-green-500" : score > 60 ? "bg-yellow-500" : "bg-red-500";
    
    return (
      <div className="bg-secondary/30 p-4 rounded-lg border border-white/5 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-400" /> Live ATS Score
          </span>
          <span className={`text-lg font-bold ${score > 80 ? "text-green-400" : "text-yellow-400"}`}>{score}/100</span>
        </div>
        <Progress value={score} className="h-2 mb-2" />
        <p className="text-xs text-muted-foreground">{atsScore.recommendation}</p>
        
        {/* Dynamic Issues List */}
        <div className="mt-3 space-y-1">
          {step === 0 && atsScore.checks.identity.issues.map((issue, i) => (
             <div key={i} className="flex items-center gap-2 text-[10px] text-red-400"><AlertCircle className="w-3 h-3"/> {issue}</div>
          ))}
          {step === 1 && atsScore.checks.skills.issues.map((issue, i) => (
             <div key={i} className="flex items-center gap-2 text-[10px] text-red-400"><AlertCircle className="w-3 h-3"/> {issue}</div>
          ))}
          {step === 2 && atsScore.checks.experience.issues.map((issue, i) => (
             <div key={i} className="flex items-center gap-2 text-[10px] text-red-400"><AlertCircle className="w-3 h-3"/> {issue}</div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-xl border-white/20">
        <DialogHeader className="p-6 border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Verify Your Profile</DialogTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </div>
          </div>
          <DialogDescription>
            Review extracted data to ensure accuracy. This is what systems see.
          </DialogDescription>
          
          {/* Step Indicator */}
          <div className="flex gap-2 mt-4">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
           {/* Sidebar / Stats */}
           <div className="w-64 bg-secondary/10 p-6 hidden md:block border-r border-white/5">
              {renderATSGauge()}
              
              <div className="space-y-4">
                 <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Tips</h4>
                 <ul className="text-xs space-y-2 text-muted-foreground">
                     <li>• Use bullet points for readability</li>
                     <li>• Quantify results (e.g., "Increased revenue by 20%")</li>
                     <li>• Include keywords from job descriptions</li>
                 </ul>
              </div>
           </div>

           {/* Main Form Area */}
           <ScrollArea className="flex-1 p-6">
              <div className="space-y-6 max-w-xl mx-auto">
                 {step === 0 && (
                   <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <div className="grid gap-2">
                        <Label>Full Name</Label>
                        <Input 
                            value={profile.identity.name} 
                            onChange={(e) => setProfile({...profile, identity: {...profile.identity, name: e.target.value}})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input 
                            value={profile.identity.email} 
                            onChange={(e) => setProfile({...profile, identity: {...profile.identity, email: e.target.value}})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Portfolio / LinkedIn Links</Label>
                        {profile.identity.links.map((link, i) => (
                          <div key={i} className="flex gap-2">
                             <Input 
                                value={link} 
                                onChange={(e) => {
                                   const newLinks = [...profile.identity.links];
                                   newLinks[i] = e.target.value;
                                   setProfile({...profile, identity: {...profile.identity, links: newLinks}});
                                }} 
                             />
                             <Button size="icon" variant="ghost" onClick={() => {
                                 const newLinks = profile.identity.links.filter((_, idx) => idx !== i);
                                 setProfile({...profile, identity: {...profile.identity, links: newLinks}});
                             }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => setProfile({...profile, identity: {...profile.identity, links: [...profile.identity.links, ""]}})}>
                           <Plus className="w-3 h-3 mr-2"/> Add Link
                        </Button>
                      </div>
                   </div>
                 )}

                 {step === 1 && (
                   <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <div className="flex flex-wrap gap-2 mb-4">
                         {profile.skills.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="pl-3 pr-1 py-1 flex gap-2 items-center">
                               {skill.name}
                               <button onClick={() => {
                                  const newSkills = profile.skills.filter((_, idx) => idx !== i);
                                  setProfile({...profile, skills: newSkills});
                               }} className="hover:bg-destructive/20 rounded-full p-0.5"><Trash2 className="w-3 h-3"/></button>
                            </Badge>
                         ))}
                      </div>
                      <div className="grid gap-2">
                         <Label>Add Skill</Label>
                         <Input 
                            placeholder="Press Enter to add..." 
                            onKeyDown={(e) => {
                               if (e.key === 'Enter') {
                                  const val = (e.currentTarget as HTMLInputElement).value;
                                  if (val) {
                                     setProfile({...profile, skills: [...profile.skills, { name: val, proficiency: 3, evidence: [] }]});
                                     (e.currentTarget as HTMLInputElement).value = "";
                                  }
                               }
                            }}
                         />
                      </div>
                   </div>
                 )}

                 {step === 2 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                      {profile.experience_atoms.map((exp, i) => (
                         <div key={i} className="p-4 border rounded-lg bg-secondary/5 space-y-3">
                            <div className="flex justify-between">
                               <div className="font-semibold">{exp.company || "Unknown Company"}</div>
                               <Button size="icon" variant="ghost" onClick={() => {
                                  const newExp = profile.experience_atoms.filter((_, idx) => idx !== i);
                                  setProfile({...profile, experience_atoms: newExp});
                               }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <Input 
                                  placeholder="Role" 
                                  value={exp.role} 
                                  onChange={(e) => {
                                     const newExp = [...profile.experience_atoms];
                                     newExp[i] = { ...newExp[i], role: e.target.value };
                                     setProfile({...profile, experience_atoms: newExp});
                                  }}
                               />
                               <Input 
                                  placeholder="Duration" 
                                  value={exp.duration} 
                                  onChange={(e) => {
                                     const newExp = [...profile.experience_atoms];
                                     newExp[i] = { ...newExp[i], duration: e.target.value };
                                     setProfile({...profile, experience_atoms: newExp});
                                  }}
                               />
                            </div>
                            <Textarea 
                               placeholder="Description..." 
                               className="min-h-[100px] text-xs font-mono"
                               value={exp.content}
                               onChange={(e) => {
                                 const newExp = [...profile.experience_atoms];
                                 newExp[i] = { ...newExp[i], content: e.target.value };
                                 setProfile({...profile, experience_atoms: newExp});
                               }}
                            />
                         </div>
                      ))}
                      <Button variant="outline" className="w-full" onClick={() => setProfile({...profile, experience_atoms: [...profile.experience_atoms, { id: Date.now().toString(), company: "", role: "", duration: "", keywords: [], content: "" }]})}>
                         <Plus className="w-4 h-4 mr-2"/> Add Position
                      </Button>
                   </div>
                 )}

                 {step === 3 && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                      {profile.education.map((edu, i) => (
                         <div key={i} className="p-4 border rounded-lg bg-secondary/5 space-y-3">
                             <div className="flex justify-between">
                               <div className="font-semibold">{edu.school}</div>
                               <Button size="icon" variant="ghost" onClick={() => {
                                  const newEdu = profile.education.filter((_, idx) => idx !== i);
                                  setProfile({...profile, education: newEdu});
                               }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <Input 
                                  placeholder="School" 
                                  value={edu.school}
                                  onChange={(e) => {
                                     const newEdu = [...profile.education];
                                     newEdu[i].school = e.target.value;
                                     setProfile({...profile, education: newEdu});
                                  }} 
                               />
                               <Input 
                                  placeholder="Year" 
                                  value={edu.year}
                                  onChange={(e) => {
                                     const newEdu = [...profile.education];
                                     newEdu[i].year = e.target.value;
                                     setProfile({...profile, education: newEdu});
                                  }} 
                               />
                            </div>
                            <Input 
                               placeholder="Degree" 
                               value={edu.degree}
                               onChange={(e) => {
                                  const newEdu = [...profile.education];
                                  newEdu[i].degree = e.target.value;
                                  setProfile({...profile, education: newEdu});
                               }} 
                            />
                         </div>
                      ))}
                      <Button variant="outline" className="w-full" onClick={() => setProfile({...profile, education: [...profile.education, { school: "", degree: "", year: "" }]})}>
                         <Plus className="w-4 h-4 mr-2"/> Add Education
                      </Button>
                   </div>
                 )}
              </div>
           </ScrollArea>
        </div>

        <DialogFooter className="p-4 border-t border-white/10 bg-secondary/5">
           <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={prevStep} disabled={step === 0}>
                 <ChevronLeft className="w-4 h-4 mr-2"/> Back
              </Button>
              
              {step < STEPS.length - 1 ? (
                 <Button onClick={nextStep}>
                    Next <ChevronRight className="w-4 h-4 ml-2"/>
                 </Button>
              ) : (
                 <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="w-4 h-4 mr-2"/> Save & Profile
                 </Button>
              )}
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
