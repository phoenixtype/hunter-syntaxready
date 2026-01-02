import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, TrendingUp, Zap, FileText, Upload, RefreshCw, LogOut, Settings, Award, CheckCircle2, AlertCircle } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { VisibilityScore } from "@/lib/visibility_engine";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ATSAudit from "@/components/ATSAudit";
import { Badge } from "@/components/ui/badge";

interface DashboardSidebarProps {
    profile: CandidateProfile | null;
    visibility: VisibilityScore | null;
    onRefreshProfile: () => void;
    onUploadProfile: (p: CandidateProfile) => void;
    onSignOut: () => void;
}

export const DashboardSidebar = ({
    profile,
    visibility,
    onRefreshProfile,
    onUploadProfile,
    onSignOut
}: DashboardSidebarProps) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <aside className="hidden lg:flex flex-col w-80 h-[calc(100vh-80px)] sticky top-24 gap-6 pr-2 overflow-y-auto custom-scrollbar">

            {/* 1. AGENT IDENTITY CARD */}
            <Card className="glass-card bg-primary/5 border-primary/20 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-lg">
                            <AvatarImage src={user?.user_metadata?.avatar_url} />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                                {profile?.identity?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">
                                {profile?.identity?.name || "Agent Offline"}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] h-5 border-green-500/50 text-green-500 bg-green-500/10">
                                    ONLINE
                                </Badge>
                                {profile && (
                                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="System Active"></span>
                                )}
                            </div>
                        </div>
                    </div>

                    {profile ? (
                        <div className="space-y-3">
                            <div className="bg-background/40 rounded-lg p-3 text-xs border border-white/5 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" /> ATS Status
                                    </span>
                                    <span className="font-medium text-green-500">Optimized</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Top Skill</span>
                                    <span className="font-medium text-primary">{profile.skills[0]?.name || "N/A"}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onRefreshProfile}
                                    className="w-full text-xs h-8 bg-background/50 hover:bg-background"
                                >
                                    <RefreshCw className="w-3 h-3 mr-2" /> Update
                                </Button>
                                <ATSAudit profile={profile} />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-3">
                            <p className="text-xs text-muted-foreground">Upload resume to activate intelligence.</p>
                            <ResumeUpload onUploadComplete={onUploadProfile} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. VISIBILITY SCORE WIDGET */}
            <Card className="glass-card border-white/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 rounded-md text-blue-500">
                            <Eye className="w-4 h-4" />
                        </div>
                        Market Visibility
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {visibility ? (
                        <div className="space-y-4">
                            <div className="flex items-end justify-between">
                                <span className="text-3xl font-bold tracking-tighter">{visibility.totalScore}</span>
                                <Badge variant={visibility.totalScore > 70 ? "default" : "secondary"} className="mb-1">
                                    {visibility.totalScore > 70 ? "Excellent" : "Growing"}
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                                        <span>ATS Readiness</span>
                                        <span>{visibility.atsPassRate}%</span>
                                    </div>
                                    <Progress value={visibility.atsPassRate} className="h-1.5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                                        <span>Demand</span>
                                        <span>{visibility.recruiterAppeal}%</span>
                                    </div>
                                    <Progress value={visibility.recruiterAppeal} className="h-1.5" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 text-center text-xs text-muted-foreground">Calculating...</div>
                    )}
                </CardContent>
            </Card>

            {/* 3. QUICK ACTIONS */}
            {/* <div className="grid grid-cols-2 gap-2">
         <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 bg-secondary/10 border-white/5 hover:bg-secondary/20">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs">Settings</span>
         </Button>
         <Button variant="outline" className="h-auto py-3 flex flex-col gap-2 bg-secondary/10 border-white/5 hover:bg-secondary/20">
            <Award className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs">Achievements</span>
         </Button>
      </div> */}

            <div className="mt-auto">
                <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={onSignOut}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
            </div>

        </aside>
    );
};


