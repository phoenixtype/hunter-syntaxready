import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Settings2, User, Briefcase, FileText, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

const AutoApplierSettings = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  const steps = [
    { num: 1, title: "Personal Details", icon: User },
    { num: 2, title: "Search Preferences", icon: Briefcase },
    { num: 3, title: "Questionnaires", icon: FileText },
    { num: 4, title: "Bot Settings", icon: Settings2 },
  ];

  const handleStartBot = () => {
    setIsRunning(!isRunning);
    toast.success(isRunning ? "Auto-applier paused." : "Auto-applier started successfully in the background!");
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 w-full z-50 border-b border-white/10 bg-background/60 backdrop-blur-xl">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              <span className="font-semibold text-lg hidden sm:inline">Auto-Applier Core</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isRunning ? "default" : "secondary"} className={`animate-pulse-slow ${isRunning ? 'bg-green-500/20 text-green-500 border-green-500/50' : ''}`}>
              {isRunning ? "Running" : "Idle"}
            </Badge>
            <ThemeToggle />
            <Button onClick={handleStartBot} size="sm" variant={isRunning ? "destructive" : "default"} className="shadow-glow transition-all">
              {isRunning ? "Stop Agent" : <><Play className="w-4 h-4 mr-2" /> Start Agent</>}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-8 md:py-12 animate-fade-in-up">
        <div className="mb-10 text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Configure Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">AI Job Hunter</span></h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Set your preferences once and let the bot apply to hundreds of jobs on LinkedIn while you sleep.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Steps */}
          <div className="md:col-span-1 space-y-2">
            {steps.map((step) => (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-300 ${
                  activeStep === step.num 
                  ? "bg-primary/10 border-primary/30 border shadow-glow" 
                  : "hover:bg-white/5 border border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  activeStep === step.num ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <div className="font-medium text-sm">{step.title}</div>
              </button>
            ))}
          </div>

          {/* Config Forms */}
          <div className="md:col-span-3">
            <Card className="border-white/10 bg-card/50 backdrop-blur-md shadow-xl overflow-hidden animate-scale-in">
              <CardContent className="p-8">
                {activeStep === 1 && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Personal Details</h2>
                      <p className="text-sm text-muted-foreground">Information used to fill out basic application forms.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input placeholder="John Doe" className="bg-background/50 border-white/10 focus:border-primary transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input placeholder="+1 234 567 8900" className="bg-background/50 border-white/10" />
                      </div>
                      <div className="space-y-2">
                        <Label>Current Location</Label>
                        <Input placeholder="San Francisco, CA" className="bg-background/50 border-white/10" />
                      </div>
                      <div className="space-y-2">
                        <Label>LinkedIn Profile URL</Label>
                        <Input placeholder="https://linkedin.com/in/..." className="bg-background/50 border-white/10" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Personal Website / Portfolio</Label>
                        <Input placeholder="https://..." className="bg-background/50 border-white/10" />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Search Preferences</h2>
                      <p className="text-sm text-muted-foreground">Define what jobs the bot should target on LinkedIn.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Job Titles (comma separated)</Label>
                        <Input placeholder="Software Engineer, Frontend Developer, React Developer" className="bg-background/50 border-white/10" />
                      </div>
                      <div className="space-y-2">
                        <Label>Locations (comma separated)</Label>
                        <Input placeholder="United States, Remote, New York" className="bg-background/50 border-white/10" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Years of Experience</Label>
                          <Input type="number" placeholder="5" className="bg-background/50 border-white/10" />
                        </div>
                        <div className="space-y-2">
                          <Label>Work Setup</Label>
                          <select className="flex h-10 w-full rounded-md border border-white/10 bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <option>Remote Only</option>
                            <option>Hybrid</option>
                            <option>On-site</option>
                            <option>Any</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2 pt-4 border-t border-white/10">
                        <Label className="text-destructive">Company Blacklist (Do not apply)</Label>
                        <Input placeholder="Crossover, Canonical, Revature" className="bg-background/50 border-red-500/20 focus:border-red-500" />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Standard Questionnaires</h2>
                      <p className="text-sm text-muted-foreground">Pre-fill answers to common ATS questions.</p>
                    </div>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-background/30">
                        <div>
                          <Label className="text-base">Require Sponsorship?</Label>
                          <p className="text-sm text-muted-foreground">Will you now or in the future require visa sponsorship?</p>
                        </div>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-background/30">
                        <div>
                          <Label className="text-base">Clearance</Label>
                          <p className="text-sm text-muted-foreground">Do you possess an active security clearance?</p>
                        </div>
                        <Switch />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Salary (Numeric)</Label>
                        <Input type="number" placeholder="120000" className="bg-background/50 border-white/10" />
                      </div>
                      <div className="space-y-2">
                        <Label>Notice Period (Days)</Label>
                        <Input type="number" placeholder="14" className="bg-background/50 border-white/10" />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Bot Behavior Configuration</h2>
                      <p className="text-sm text-muted-foreground">Control how the automation engine operates.</p>
                    </div>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-background/30">
                        <div>
                          <Label className="text-base">Stealth Mode</Label>
                          <p className="text-sm text-muted-foreground">Run headless browser to avoid detection (Recommended).</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-background/30">
                        <div>
                          <Label className="text-base">Pause Before Submission</Label>
                          <p className="text-sm text-muted-foreground">Allow manual review of each application before it sends.</p>
                        </div>
                        <Switch />
                      </div>
                      
                      <div className="pt-6 mt-4 flex justify-end">
                        <Button onClick={() => toast.success("Settings saved to bot config!")} className="shadow-glow px-8">
                          Save All Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AutoApplierSettings;
