import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, RefreshCw, LogOut, CheckCircle2, Upload, Sparkles } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { VisibilityScore } from "@/lib/visibility_engine";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { useAuth } from "@/hooks/useAuth";
import { UserPreferences } from "@/lib/user_preferences";

interface DashboardSidebarProps {
    profile: CandidateProfile | null;
    visibility: VisibilityScore | null;
    preferences: UserPreferences | null;
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
    const { user } = useAuth();
    const initials = profile?.identity?.name
        ? profile.identity.name.split(' ').map(n => n[0]).join('').slice(0, 2)
        : user?.email?.charAt(0).toUpperCase();

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Profile Identity - Integrated Look */}
            <div className="glass-card rounded-2xl p-5 border-white/10 relative overflow-hidden group">
                {/* Decoration background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-opacity duration-500 group-hover:opacity-100" />

                <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                    <div className="relative">
                        <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
                            <AvatarImage src={user?.user_metadata?.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xl font-bold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        {profile && (
                            <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-1 ring-2 ring-background" title="Profile Active">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <h3 className="font-semibold text-lg leading-tight">
                            {profile?.identity?.name || "Guest User"}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px] mx-auto">
                            {user?.email}
                        </p>
                    </div>

                    <div className="flex gap-2 w-full pt-2">
                        <Link to="/profile" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-background/50 hover:bg-background/80 transition-all">
                                <FileText className="w-3 h-3 mr-1.5" />
                                Edit
                            </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={onRefreshProfile} className="h-8 w-8 p-0" title="Refresh Profile">
                            <RefreshCw className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                {!profile && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-3 text-center">
                            Upload resume to unlock features
                        </p>
                        <ResumeUpload onUploadComplete={onUploadProfile} />
                    </div>
                )}
            </div>

            {/* Match Score - Premium Card */}
            {visibility && (
                <div className="glass-card rounded-2xl p-5 border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                            Employability Score
                        </h4>
                        <Sparkles className="w-3 h-3 text-yellow-500" />
                    </div>

                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold tracking-tight text-foreground">
                            {visibility.totalScore}
                        </span>
                        <span className="text-sm text-muted-foreground mb-1.5">/100</span>
                    </div>

                    <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ATS Compatibility</span>
                                <span className="font-medium">{visibility.atsPassRate}%</span>
                            </div>
                            <Progress value={visibility.atsPassRate} className="h-1.5 bg-primary/10" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Recruiter Appeal</span>
                                <span className="font-medium">{visibility.recruiterAppeal}%</span>
                            </div>
                            <Progress value={visibility.recruiterAppeal} className="h-1.5 bg-primary/10" />
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="hidden lg:block">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-destructive text-xs h-9"
                    onClick={onSignOut}
                >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sign out
                </Button>
            </div>
        </div>
    );
};
