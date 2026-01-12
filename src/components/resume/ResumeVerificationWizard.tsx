import { useState, useEffect } from "react";
import { CandidateProfile, saveCandidateProfile, ExperienceAtom, Education, Skill, polishText } from "@/lib/resume_engine";
import { scoreProfileHealth, ATSHealthCheck } from "@/lib/ats_scorer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, ChevronLeft, AlertCircle, Wand2, Trash2, Plus, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "framer-motion";

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
    if (initialData) {
      setProfile(initialData);
    }
  }, [initialData]);

  useEffect(() => {
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

  const handlePolish = async (id: string, text: string, type: 'experience' | 'skill') => {
      setIsPolishing(id);
      try {
          const polished = await polishText(text, type);
          if (type === 'experience') {
              const newExp = profile.experience_atoms.map(exp => 
                  exp.id === id ? { ...exp, content: polished } : exp
              );
              setProfile({ ...profile, experience_atoms: newExp });
              toast.success("Content polished!");
          }
      } catch (e) {
          toast.error("Failed to polish text");
      } finally {
          setIsPolishing(null);
      }
  };

  const nextStep = () => setStep(Math.min(step + 1, STEPS.length - 1));
  const prevStep = () => setStep(Math.max(step - 1, 0));

  const renderATSGauge = () => {
    if (!atsScore) return null;
    const score = atsScore.totalScore;
    
    return (
      <div className="bg-secondary/30 p-4 rounded-lg border border-white/5 mb-6 shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-400" /> Live ATS Score
          </span>
          <span className={`text-lg font-bold ${score > 80 ? "text-green-400" : score > 60 ? "text-yellow-400" : "text-red-400"}`}>{score}/100</span>
        </div>
        <Progress value={score} className="h-2 mb-2 bg-secondary" />
        <p className="text-xs text-muted-foreground">{atsScore.recommendation}</p>
        
        <div className="mt-3 space-y-1">
          <AnimatePresence>
            {step === 0 && atsScore.checks.identity.issues.map((issue, i) => (
             <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} exit={{opacity:0}} key={i} className="flex items-center gap-2 text-[10px] text-red-400"><AlertCircle className="w-3 h-3"/> {issue}</motion.div>
            ))}
            {step === 1 && atsScore.checks.skills.issues.map((issue, i) => (
             <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} exit={{opacity:0}} key={i} className="flex items-center gap-2 text-[10px] text-red-400"><AlertCircle className="w-3 h-3"/> {issue}</motion.div>
            ))}
            {step === 2 && atsScore.checks.experience.issues.map((issue, i) => (
             <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} exit={{opacity:0}} key={i} className="flex items-center gap-2 text-[10px] text-red-400"><AlertCircle className="w-3 h-3"/> {issue}</motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur-3xl border-white/10 shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 border-b border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold tracking-tight">Verify Your Profile</DialogTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
              STEP {step + 1} / {STEPS.length}
            </div>
          </div>
          <DialogDescription>
            Review extracted data to ensure accuracy. This is what ATS systems see.
          </DialogDescription>
          
          <div className="flex gap-2 mt-4">
            {STEPS.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]' : 'bg-secondary'}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
           {/* Sidebar */}
           <div className="w-72 bg-secondary/5 p-6 hidden md:block border-r border-white/5">
              {renderATSGauge()}
              
              <div className="space-y-4 pt-4">
                 <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-500"/> Pro Tips
                 </h4>
                 <ul className="text-xs space-y-3 text-muted-foreground/80 leading-relaxed">
                     <li>• <strong>Bullet Points:</strong> Use them for readability. Our Smart Polish tool can format them for you.</li>
                     <li>• <strong>Metrics:</strong> Include numbers (e.g., "Increased revenue by 20%").</li>
                     <li>• <strong>Keywords:</strong> Match the job description terms exactly.</li>
                 </ul>
              </div>
           </div>

           {/* Main Form Area */}
           <ScrollArea className="flex-1 p-8 bg-gradient-to-br from-background via-background to-secondary/5">
              <div className="max-w-2xl mx-auto min-h-[400px]">
                 <AnimatePresence mode="wait">
                 {step === 0 && (
                   <motion.div key="identity" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-6">
                      <div className="grid gap-2">
                        <Label>Full Name</Label>
                        <Input 
                            className="bg-secondary/10 border-white/5"
                            value={profile.identity.name} 
                            onChange={(e) => setProfile({...profile, identity: {...profile.identity, name: e.target.value}})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input 
                            className="bg-secondary/10 border-white/5"
                            value={profile.identity.email} 
                            onChange={(e) => setProfile({...profile, identity: {...profile.identity, email: e.target.value}})} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Portfolio / LinkedIn Links</Label>
                        {profile.identity.links.map((link, i) => (
                          <div key={i} className="flex gap-2 group">
                             <Input 
                                className="bg-secondary/10 border-white/5"
                                value={link} 
                                onChange={(e) => {
                                   const newLinks = [...profile.identity.links];
                                   newLinks[i] = e.target.value;
                                   setProfile({...profile, identity: {...profile.identity, links: newLinks}});
                                }} 
                             />
                             <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                 const newLinks = profile.identity.links.filter((_, idx) => idx !== i);
                                 setProfile({...profile, identity: {...profile.identity, links: newLinks}});
                             }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" className="w-fit text-primary" onClick={() => setProfile({...profile, identity: {...profile.identity, links: [...profile.identity.links, ""]}})}>
                           <Plus className="w-3 h-3 mr-2"/> Add Link
                        </Button>
                      </div>
                   </motion.div>
                 )}

                 {step === 1 && (
                   <motion.div key="skills" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-6">
                      <div className="flex flex-wrap gap-2 mb-6 min-h-[100px] content-start p-4 rounded-lg border border-white/5 bg-secondary/5">
                         {profile.skills.length === 0 && <span className="text-muted-foreground text-sm italic">No skills detected yet. Add some below!</span>}
                         {profile.skills.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="pl-3 pr-1 py-1.5 flex gap-2 items-center bg-secondary/40 hover:bg-secondary/60 transition-colors border border-white/5">
                               {skill.name}
                               <button onClick={() => {
                                  const newSkills = profile.skills.filter((_, idx) => idx !== i);
                                  setProfile({...profile, skills: newSkills});
                               }} className="hover:bg-destructive/20 rounded-full p-0.5 text-muted-foreground hover:text-white transition-colors"><X className="w-3 h-3"/></button>
                            </Badge>
                         ))}
                      </div>
                      <div className="grid gap-2">
                         <Label>Add New Skill</Label>
                         <div className="flex gap-2">
                             <Input 
                                className="bg-secondary/10 border-white/5"
                                placeholder="e.g. React, Python, Project Management (Press Enter)" 
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
                   </motion.div>
                 )}

                 {step === 2 && (
                   <motion.div key="experience" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-6">
                      {profile.experience_atoms.map((exp, i) => (
                         <div key={i} className="group p-5 border border-white/5 rounded-xl bg-secondary/5 space-y-4 hover:border-primary/20 transition-all shadow-sm">
                            <div className="flex justify-between items-start">
                               <div className="font-semibold text-lg">{exp.company || "Unknown Company"}</div>
                               <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => {
                                  const newExp = profile.experience_atoms.filter((_, idx) => idx !== i);
                                  setProfile({...profile, experience_atoms: newExp});
                               }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="grid gap-1.5">
                                   <Label className="text-xs text-muted-foreground">Role Title</Label>
                                   <Input 
                                      className="bg-background/50 border-white/10"
                                      value={exp.role} 
                                      onChange={(e) => {
                                         const newExp = [...profile.experience_atoms];
                                         newExp[i] = { ...newExp[i], role: e.target.value };
                                         setProfile({...profile, experience_atoms: newExp});
                                      }}
                                   />
                               </div>
                               <div className="grid gap-1.5">
                                   <Label className="text-xs text-muted-foreground">Duration</Label>
                                   <Input 
                                      className="bg-background/50 border-white/10"
                                      value={exp.duration} 
                                      onChange={(e) => {
                                         const newExp = [...profile.experience_atoms];
                                         newExp[i] = { ...newExp[i], duration: e.target.value };
                                         setProfile({...profile, experience_atoms: newExp});
                                      }}
                                   />
                               </div>
                            </div>
                            <div className="relative">
                                <Textarea 
                                    className="min-h-[120px] text-xs font-mono leading-relaxed bg-background/50 border-white/10 resize-none pr-10"
                                    value={exp.content}
                                    onChange={(e) => {
                                      const newExp = [...profile.experience_atoms];
                                      newExp[i] = { ...newExp[i], content: e.target.value };
                                      setProfile({...profile, experience_atoms: newExp});
                                    }}
                                />
                                <div className="absolute bottom-2 right-2">
                                     <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-primary hover:bg-primary/10"
                                        title="Smart Polish"
                                        onClick={() => handlePolish(exp.id, exp.content, 'experience')}
                                        disabled={isPolishing === exp.id}
                                     >
                                         <Wand2 className={`w-4 h-4 ${isPolishing === exp.id ? 'animate-spin' : ''}`} />
                                     </Button>
                                </div>
                            </div>
                         </div>
                      ))}
                      <Button variant="outline" className="w-full border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5" onClick={() => setProfile({...profile, experience_atoms: [...profile.experience_atoms, { id: Date.now().toString(), company: "", role: "", duration: "", keywords: [], content: "" }]})}>
                         <Plus className="w-4 h-4 mr-2"/> Add Position
                      </Button>
                   </motion.div>
                 )}

                 {step === 3 && (
                   <motion.div key="education" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-6">
                      {profile.education.map((edu, i) => (
                         <div key={i} className="group p-5 border border-white/5 rounded-xl bg-secondary/5 space-y-4 hover:border-primary/20 transition-all">
                             <div className="flex justify-between">
                               <div className="font-semibold text-lg">{edu.school || "School Name"}</div>
                               <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => {
                                  const newEdu = profile.education.filter((_, idx) => idx !== i);
                                  setProfile({...profile, education: newEdu});
                               }}><Trash2 className="w-4 h-4 text-destructive"/></Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <Inputs
                                  label="School / University"
                                  value={edu.school}
                                  onChange={(e) => {
                                     const newEdu = [...profile.education];
                                     newEdu[i].school = e.target.value;
                                     setProfile({...profile, education: newEdu});
                                  }} 
                               />
                               <Inputs
                                  label="Year(s)"
                                  value={edu.year}
                                  onChange={(e) => {
                                     const newEdu = [...profile.education];
                                     newEdu[i].year = e.target.value;
                                     setProfile({...profile, education: newEdu});
                                  }} 
                               />
                            </div>
                            <Inputs
                               label="Degree / Certificate"
                               value={edu.degree}
                               onChange={(e) => {
                                  const newEdu = [...profile.education];
                                  newEdu[i].degree = e.target.value;
                                  setProfile({...profile, education: newEdu});
                               }} 
                            />
                         </div>
                      ))}
                      <Button variant="outline" className="w-full border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5" onClick={() => setProfile({...profile, education: [...profile.education, { school: "", degree: "", year: "" }]})}>
                         <Plus className="w-4 h-4 mr-2"/> Add Education
                      </Button>
                   </motion.div>
                 )}
                 </AnimatePresence>
              </div>
           </ScrollArea>
        </div>

        <DialogFooter className="p-4 border-t border-white/5 bg-secondary/5 backdrop-blur-sm">
           <div className="flex w-full justify-between items-center max-w-4xl mx-auto px-4">
              <Button variant="ghost" onClick={prevStep} disabled={step === 0} className="hover:bg-white/5">
                 <ChevronLeft className="w-4 h-4 mr-2"/> Back
              </Button>
              
              {step < STEPS.length - 1 ? (
                 <Button onClick={nextStep} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Next <ChevronRight className="w-4 h-4 ml-2"/>
                 </Button>
              ) : (
                 <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20">
                    <Check className="w-4 h-4 mr-2"/> Save & Profile
                 </Button>
              )}
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Helper component for cleaner inputs
const Inputs = ({ label, value, onChange }: { label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input className="bg-background/50 border-white/10" value={value} onChange={onChange} />
    </div>
);
