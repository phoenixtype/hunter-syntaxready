import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { openBillingPortal, upgradeToPro } from "@/lib/subscription";
import { useGeo } from "@/hooks/useGeo";
import { PaystackCheckout } from "@/components/payment/PaystackCheckout";
import SEOHead from "@/components/SEOHead";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { Download, Trash2, Shield, Bell, Moon, Loader2, CreditCard, ExternalLink, User, Settings as SettingsIcon, HelpCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NotificationSettings from "@/components/NotificationSettings";
import ProfilePanel from "@/components/ProfilePanel";
import PreferencesPanel from "@/components/PreferencesPanel";
import ThemeToggle from "@/components/ThemeToggle";
import ReferralPanel from "@/components/ReferralPanel";
import { useResume } from "@/hooks/useResume";
import { useDashboardData } from "@/hooks/useDashboardData";
import { format } from "date-fns";
import PageTour, { PageTourHandle } from "@/components/PageTour";
import { Step } from "react-joyride";

const SETTINGS_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Settings is where you manage your profile, preferences, notifications, and subscription.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"settings-tabs\"]",
    content: "Switch between Profile, Preferences, Notifications, and Account sections using these tabs.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"settings-subscription\"]",
    content: "View your current plan and manage billing — upgrade to Pro or access the customer portal here.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"settings-privacy\"]",
    content: "Export a copy of your data or permanently delete your account here. Your privacy controls are always available.",
    disableBeacon: true,
  },
];

type SettingsTab = "profile" | "preferences" | "account" | "notifications";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { currentSubscription: subscription, isPro } = useSubscription();
  const { profile } = useResume();
  const { preferences } = useDashboardData();
  const tourRef = useRef<PageTourHandle>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const { isNigeria, isLoading: geoLoading } = useGeo();
  const [showPaystack, setShowPaystack] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'canceled') {
      toast.info("Checkout was canceled.");
      navigate(window.location.pathname, { replace: true });
    } else if (params.get('checkout') === 'success') {
      toast.success("Payment successful! Your new plan will be active shortly.");
      navigate(window.location.pathname, { replace: true });
    }
  }, [navigate]);

  const handleOpenBillingPortal = async () => {
    setIsOpeningPortal(true);
    try {
      await openBillingPortal();
    } catch (err) {
      console.error("Billing portal error:", err);
      toast.error("Could not open billing portal. Please try again.");
      setIsOpeningPortal(false);
    }
  };

  // Export all user data (GDPR compliance)
  const handleExportData = async () => {
    if (!user) return;

    setIsExporting(true);
    try {
      const [
        profileResult,
        preferencesResult,
        candidateResult,
        applicationsResult,
        tailoredResumesResult,
        feedbackResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('candidate_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('application_history').select('*').eq('user_id', user.id),
        supabase.from('tailored_resumes').select('*').eq('user_id', user.id),
        supabase.from('feedback_actions').select('*').eq('user_id', user.id),
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
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Delete account and all user data (GDPR compliance).
  // Table data is deleted first, then the auth user record is removed via the
  // delete-account edge function (requires service-role key, cannot be done client-side).
  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      // Delete all user data and the auth record via edge function (service role required).
      // The edge function handles all table cleanup + auth.admin.deleteUser in one operation.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please sign in and try again.");

      const { data: deleteData, error: deleteFnError } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (deleteFnError || !deleteData?.success) {
        throw new Error(deleteFnError?.message || deleteData?.error || "Failed to delete account. Please contact support@syntaxready.com.");
      }

      // Sign out locally and redirect
      await signOut();
      toast.success("Your account has been permanently deleted.");
      navigate('/');
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Account deletion failed. Please contact support@syntaxready.com.");
    } finally {
      setIsDeleting(false);
    }
  };

  const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "profile",       label: "Profile",       icon: User },
    { id: "preferences",   label: "Preferences",   icon: SettingsIcon },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "account",       label: "Account",       icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 lg:pb-12">
      <SEOHead title="Settings" description="Manage your account settings and privacy preferences." path="/settings" noIndex />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
        actions={
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => tourRef.current?.start()} title="Page tour">
            <HelpCircle className="w-4 h-4" />
          </Button>
        }
      />

      <main className="container max-w-3xl mx-auto px-4 pt-20 sm:pt-24 animate-fade-in pb-8">
        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-md border border-border w-full overflow-x-auto mb-8" data-tour="settings-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(id)}
              className={`h-8 px-2 sm:px-4 text-xs flex-1 min-w-0 ${activeTab === id ? "shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden truncate">{label}</span>
            </Button>
          ))}
        </div>

        {/* Profile */}
        {activeTab === "profile" && <ProfilePanel profile={profile} />}

        {/* Preferences */}
        {activeTab === "preferences" && <PreferencesPanel preferences={preferences ?? null} />}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        )}

        {/* Account */}
        {activeTab === "account" && <div className="space-y-8">

        {/* Subscription */}
        <Card className="border-border" data-tour="settings-subscription">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your plan and billing details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-base font-medium">Current Plan</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={isPro ? "default" : "secondary"} className="text-xs">
                    {isPro ? "hunter.ai Pro" : "Free"}
                  </Badge>
                  {subscription?.cancel_at_period_end && subscription.current_period_end && (
                    <span className="text-xs text-warning font-medium">
                      Cancels {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
                    </span>
                  )}
                  {isPro && !subscription?.cancel_at_period_end && subscription?.current_period_end && (
                    <span className="text-xs text-muted-foreground">
                      Renews {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
              {isPro ? (
                <Button
                  variant="outline"
                  onClick={handleOpenBillingPortal}
                  disabled={isOpeningPortal}
                  className="w-full sm:w-auto"
                >
                  {isOpeningPortal ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Manage Billing
                </Button>
              ) : (
                <>
                  <Button onClick={async () => {
                    if (isNigeria) {
                      setShowPaystack(true);
                    } else {
                      setIsUpgrading(true);
                      try {
                        await upgradeToPro('stripe', '/settings');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to start checkout");
                        setIsUpgrading(false);
                      }
                    }
                  }} disabled={isUpgrading || geoLoading} className="w-full sm:w-auto">
                    {isUpgrading || geoLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Upgrade to Pro
                  </Button>
                  {showPaystack && (
                    <PaystackCheckout
                      planName="pro"
                      interval="monthly"
                      onSuccess={() => {
                        setShowPaystack(false);
                        window.location.href = '/settings?checkout=success';
                      }}
                      onClose={() => setShowPaystack(false)}
                    />
                  )}
                </>
              )}
            </div>

            {isPro && (
              <>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-base font-medium text-destructive">Cancel Subscription</Label>
                    <p className="text-sm text-muted-foreground">
                      You keep Pro access until the end of your billing period
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/60">
                        Cancel Plan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>
                            You'll be taken to the billing portal to confirm cancellation. Your Pro features remain active until the end of your current billing period.
                          </p>
                          <p className="font-medium">
                            You can resubscribe at any time.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep my plan</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleOpenBillingPortal}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isOpeningPortal ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Continue to cancel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Referrals */}
        <ReferralPanel />

        {/* Privacy & Data */}
        <Card className="border-border" data-tour="settings-privacy">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-base font-medium">Export Your Data</Label>
                <p className="text-sm text-muted-foreground">
                  Download a copy of all your data in JSON format
                </p>
              </div>
              <Button variant="outline" onClick={handleExportData} disabled={isExporting} className="w-full sm:w-auto">
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
              </Button>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* Appearance */}
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
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-base font-medium">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark mode
                </p>
              </div>
              <ThemeToggle />
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

        </div>}

      <PageTour ref={tourRef} tourKey="settings" steps={SETTINGS_TOUR_STEPS} />
      </main>
    </div>
  );
};

export default Settings;
