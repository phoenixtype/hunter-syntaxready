import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, Trash2, Shield, Bell, Moon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export all user data (GDPR compliance)
  const handleExportData = async () => {
    if (!user) return;
    
    setIsExporting(true);
    try {
      // Gather all user data from various tables
      const [
        profileResult,
        preferencesResult,
        candidateResult,
        applicationsResult,
        tailoredResumesResult,
        feedbackResult
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
        supabase.from('candidate_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('application_history').select('*').eq('user_id', user.id),
        supabase.from('tailored_resumes').select('*').eq('user_id', user.id),
        supabase.from('feedback_actions').select('*').eq('user_id', user.id)
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        userId: user.id,
        email: user.email,
        profile: profileResult.data,
        preferences: preferencesResult.data,
        candidateProfile: candidateResult.data,
        applications: applicationsResult.data || [],
        tailoredResumes: tailoredResumesResult.data || [],
        feedbackActions: feedbackResult.data || [],
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hunter-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Delete account and all user data (GDPR compliance)
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Delete data from all tables (cascading should handle most, but be explicit)
      await Promise.all([
        supabase.from('feedback_actions').delete().eq('user_id', user.id),
        supabase.from('tailored_resumes').delete().eq('user_id', user.id),
        supabase.from('application_history').delete().eq('user_id', user.id),
        supabase.from('agent_activity_logs').delete().eq('user_id', user.id),
        supabase.from('learning_weights').delete().eq('user_id', user.id),
        supabase.from('notification_preferences').delete().eq('user_id', user.id),
        supabase.from('candidate_profiles').delete().eq('user_id', user.id),
        supabase.from('user_preferences').delete().eq('user_id', user.id),
        supabase.from('subscriptions').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('id', user.id),
      ]);

      // Sign out
      await signOut();
      
      toast.success("Account deleted successfully. We're sorry to see you go.");
      navigate('/');
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete account. Please contact support.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pb-24 lg:pb-12">
      <SEOHead title="Settings" description="Manage your account settings and privacy preferences." path="/settings" noIndex />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <main className="container max-w-3xl mx-auto px-4 pt-20 sm:pt-24 space-y-8 animate-fade-in pb-8">
        
        {/* Privacy & Data Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Privacy & Data
            </CardTitle>
            <CardDescription>
              Manage your data and exercise your privacy rights (GDPR/CCPA)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Export Data */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Export Your Data</Label>
                <p className="text-sm text-muted-foreground">
                  Download a copy of all your data in JSON format
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
              </Button>
            </div>

            <Separator />

            {/* Delete Account */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium text-destructive">Delete Account</Label>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>This action cannot be undone. This will permanently delete:</p>
                      <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Your profile and resume data</li>
                        <li>All tailored resumes and cover letters</li>
                        <li>Your application history</li>
                        <li>All preferences and settings</li>
                      </ul>
                      <p className="mt-4 font-medium">
                        We recommend exporting your data before deleting your account.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive job alerts and application updates via email
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Weekly Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Get a summary of your job search activity each week
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Product updates, tips, and promotional content
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use the theme toggle in the corner to switch themes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Links */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Legal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/privacy')}>
                Privacy Policy
              </Button>
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/terms')}>
                Terms of Service
              </Button>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Settings;
