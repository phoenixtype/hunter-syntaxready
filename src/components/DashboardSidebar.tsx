import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, RefreshCw, LogOut, CheckCircle2, Upload } from "lucide-react";
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

    return (
        <div className="space-y-4">
            
            {/* Profile Card */}
            <Card className="border-border/50">
                <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3 mb-4">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={user?.user_metadata?.avatar_url} />
                            <AvatarFallback className="bg-foreground text-background font-medium text-base">
                                {profile?.identity?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">
                                {profile?.identity?.name || "Your Profile"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {profile ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Resume uploaded</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRefreshProfile}
                                className="w-full text-xs h-8"
                            >
                                <RefreshCw className="w-3 h-3 mr-1.5" />
                                Update Resume
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Upload your resume to find matching jobs
                            </p>
                            <ResumeUpload onUploadComplete={onUploadProfile} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Match Score Card */}
            {visibility && (
                <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Your Match Score
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-3xl font-semibold">{visibility.totalScore}</span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">Resume quality</span>
                                    <span>{visibility.atsPassRate}%</span>
                                </div>
                                <Progress value={visibility.atsPassRate} className="h-1.5" />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">Market fit</span>
                                    <span>{visibility.recruiterAppeal}%</span>
                                </div>
                                <Progress value={visibility.recruiterAppeal} className="h-1.5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sign Out - Desktop only */}
            <div className="hidden lg:block pt-4">
                <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full justify-start text-muted-foreground hover:text-foreground text-xs" 
                    onClick={onSignOut}
                >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sign out
                </Button>
            </div>

        </div>
    );
};
