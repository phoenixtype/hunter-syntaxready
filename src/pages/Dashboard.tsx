import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, Upload, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { parseResume, CandidateProfile } from "@/lib/resume_engine";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    toast.info("Analyzing resume structure...");

    try {
      const data = await parseResume(file);
      setProfile(data);
      toast.success("Resume parsed successfully");
    } catch (error) {
      toast.error("Failed to parse resume");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    // Check for preferences to enforce onboarding
    if (user) {
      const checkPrefs = async () => {
        // We import dynamically to avoid circular dependencies if any, though here it's fine
        const { getPreferences } = await import("@/lib/user_preferences");
        const prefs = await getPreferences(user.id);
        if (!prefs) {
          toast.info("Please complete your agent configuration.");
          navigate("/onboarding");
        }
      };
      checkPrefs();
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-border/50">
        <div className="container max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tighter">hunter.</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="container max-w-5xl mx-auto px-6">
          <div className="space-y-2 mb-12 animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome to your Hunter AI dashboard</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Resume Section */}
            <div className="glass-card rounded-2xl p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Resume Intelligence</h2>
                <p className="text-sm text-muted-foreground">Upload your base resume to generate your Agent Profile.</p>
              </div>

              {!profile ? (
                <div
                  className={`border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center transition-all hover:bg-muted/50 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <label className="cursor-pointer block">
                    <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleFileUpload} />
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium">Drop your resume here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-2">PDF or DOCX (Max 5MB)</p>
                  </label>
                </div>
              ) : (
                <div className="space-y-6 animate-scale-in">
                  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium">{profile.identity.name}</p>
                      <p className="text-xs text-muted-foreground">Parsed Profile Ready</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Identified Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill) => (
                        <div key={skill.name} className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium">
                          {skill.name} <span className="opacity-50">{(skill.proficiency * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Experience Atoms</h3>
                    <div className="space-y-3">
                      {profile.experience_atoms.map((atom) => (
                        <div key={atom.id} className="p-3 rounded-lg bg-background/50 border border-border text-sm">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{atom.role} @ {atom.company}</span>
                            <span className="text-muted-foreground text-xs">{atom.duration}</span>
                          </div>
                          <p className="text-muted-foreground/80">{atom.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Agent Status Section */}
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-8">
                <h2 className="text-2xl font-semibold mb-4">Agent Status</h2>
                <div className="flex items-center gap-3 text-green-500 mb-6">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <span className="font-medium">Active & Hunting</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Jobs Analyzed</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Applications Sent</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Interviews Scheduled</span>
                    <span className="font-medium">0</span>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-8 bg-primary text-primary-foreground relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-2">Upgrade to Pro</h2>
                  <p className="text-primary-foreground/80 text-sm mb-4">Unlock Perplexity-powered deep search.</p>
                  <Button variant="secondary" size="sm" className="w-full">View Plans</Button>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
