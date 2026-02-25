import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, LogOut, CheckCircle2, Sparkles, Settings2, PenLine } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { VisibilityScore } from "@/lib/visibility_engine";
import { useAuth } from "@/hooks/useAuth";
import { UserPreferences } from "@/lib/user_preferences";

interface DashboardSidebarProps {
    profile: CandidateProfile | null;
    visibility: VisibilityScore | null;
    preferences: UserPreferences | null;
    onRefreshProfile: () => void;
    onSignOut: () => void;
    onEditPreferences?: () => void;
}

export const DashboardSidebar = ({
    profile,
    visibility,
    preferences,
    onRefreshProfile,
    onSignOut,
    onEditPreferences
}: DashboardSidebarProps) => {
    const { user } = useAuth();
    const initials = profile?.identity?.name
        ? profile.identity.name.split(' ').map(n => n[0]).join('').slice(0, 2)
        : user?.email?.charAt(0).toUpperCase();

    return (
        <div className="space-y-6 animate-fade-in">

            {/* Profile Identity - Integrated Look */}
            <div className="rounded-lg p-5 border border-border bg-card">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="relative">
                        <Avatar className="h-20 w-20 ring-2 ring-border">
                            <AvatarImage src={user?.user_metadata?.avatar_url} />
                            <AvatarFallback className="bg-secondary text-foreground text-xl font-bold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        {profile && (
                            <div className="absolute bottom-0 right-0 bg-foreground rounded-full p-1 ring-2 ring-background" title="Profile Active">
                                <CheckCircle2 className="w-3 h-3 text-background" />
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
                            <Button variant="outline" size="sm" className="w-full text-xs h-8">
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
                    <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-3 text-center">
                            Build your profile to unlock features
                        </p>
                        <Link to="/onboarding">
                            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                                <PenLine className="w-3 h-3" />
                                Build Profile
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Match Score - Premium Card */}
            {visibility && (
                <div className="rounded-lg p-5 border border-border bg-card space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                            Employability Score
                        </h4>
                        <Sparkles className="w-3 h-3 text-muted-foreground" />
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
                            <Progress value={visibility.atsPassRate} className="h-1.5 bg-secondary" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Recruiter Appeal</span>
                                <span className="font-medium">{visibility.recruiterAppeal}%</span>
                            </div>
                            <Progress value={visibility.recruiterAppeal} className="h-1.5 bg-secondary" />
                        </div>
                    </div>
                </div>
            )}

            {/* Job Preferences */}
            <div className="rounded-lg p-5 border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Job Preferences
                    </h4>
                    <button onClick={onEditPreferences} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Settings2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                {preferences?.target_roles?.length ? (
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-1.5">
                            {preferences.target_roles.slice(0, 3).map((role, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] py-0.5 px-2">
                                    {role}
                                </Badge>
                            ))}
                            {preferences.target_roles.length > 3 && (
                                <Badge variant="outline" className="text-[10px] py-0.5 px-2">
                                    +{preferences.target_roles.length - 3}
                                </Badge>
                            )}
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-1">
                            {preferences.locations?.length > 0 && (
                                <p>{preferences.locations.join(", ")}</p>
                            )}
                            <p className="capitalize">{preferences.remote_policy} · ${preferences.min_salary_usd?.toLocaleString()}+</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                            No preferences set. Configure your target roles to start finding jobs.
                        </p>
                        <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={onEditPreferences}>
                            <Settings2 className="w-3 h-3 mr-1.5" />
                            Set Preferences
                        </Button>
                    </div>
                )}
            </div>

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
