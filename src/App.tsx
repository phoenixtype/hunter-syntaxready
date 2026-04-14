import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import { GeoProvider } from "@/hooks/useGeo";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EmailVerification from "./pages/EmailVerification";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PublicRoute } from "./components/auth/PublicRoute";
import AppLayout from "./layouts/AppLayout";
import RecruiterLayout from "./layouts/RecruiterLayout";
import AdminLayout from "./layouts/AdminLayout";
import RequireAdmin from "./components/admin/RequireAdmin";
import RequireRecruiter from "./components/auth/RequireRecruiter";
import RecruiterPortal from "./pages/RecruiterPortal";
import RecruiterSetup from "./pages/RecruiterSetup";
import FloatingThemeToggle from "./components/FloatingThemeToggle";
import CookieConsent from "./components/CookieConsent";
import CommandPalette from "./components/CommandPalette";
import Footer from "./components/Footer";
import { runStartupValidation } from "./lib/env_validator";
import { checkDatabaseHealth, logHealthStatus } from "./lib/database_health";
import { logMobileBrowserInfo } from "./lib/mobile-safety";
import PageLoader from "./components/PageLoader";
import { HunterAIMobile } from "./mobile-app-init";
import { BottomNavigation } from "./components/mobile/BottomNavigation";

try { (globalThis as { __HUNTER_STEP__?: (n: string) => void }).__HUNTER_STEP__?.('App:body-start'); } catch { /* ignore */ }

// Admin pages (lazy)
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const RecruiterApplicationsPage = lazy(() => import("./pages/admin/RecruiterApplications"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));

// Lazy-load heavy tool pages — reduces initial bundle by ~40%
// Onboarding + Profile are lazy because they pull `country-state-city`
// (7.7MB of city data) which blows iOS Safari's parser stack if eagerly
// bundled into the main chunk.
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const ApplicationWizard = lazy(() => import("./pages/ApplicationWizard"));
const AutoApplierSettings = lazy(() => import("./pages/AutoApplierSettings"));
const InterviewCoach = lazy(() => import("./pages/InterviewCoach"));
const PostInterview = lazy(() => import("./pages/PostInterview"));
const ResumeBuilder = lazy(() => import("./pages/ResumeBuilder"));
const TailoredResumes = lazy(() => import("./pages/TailoredResumes"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));

// Recruiter pages (lazy)
const RecruiterDashboard = lazy(() => import("./pages/recruiter/RecruiterDashboard"));
const PostJob = lazy(() => import("./pages/recruiter/PostJob"));
const MyJobs = lazy(() => import("./pages/recruiter/MyJobs"));
const JobApplicants = lazy(() => import("./pages/recruiter/JobApplicants"));
const EditJob = lazy(() => import("./pages/recruiter/EditJob"));
const CompanyProfile = lazy(() => import("./pages/recruiter/CompanyProfile"));
const CandidateTalentSearch = lazy(() => import("./pages/recruiter/CandidateTalentSearch"));
const RecruiterAnalytics = lazy(() => import("./pages/recruiter/RecruiterAnalytics"));
const RecruiterPricing = lazy(() => import("./pages/recruiter/RecruiterPricing"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - aggressive caching for performance
      gcTime: 10 * 60 * 1000,   // 10 minutes - keep data in memory longer
      refetchOnWindowFocus: false, // Prevent excessive requests on tab focus
      retry: (failureCount, error: unknown) => {
        // Don't retry on rate limit errors to prevent cascade failures
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('429') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests')) {
          return false;
        }
        // Only retry twice for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff with max 30s
    },
  },
});

const AppInitializer = () => {
  useEffect(() => {
    const runChecks = async () => {
      runStartupValidation();
      logMobileBrowserInfo();

      // Initialize mobile app features — wrapped in try/catch because
      // @capacitor/core can throw on certain mobile browsers (Safari/Chrome)
      // where the native bridge is absent.
      try {
        await HunterAIMobile.initialize();
      } catch (err) {
        console.warn('Mobile init skipped (not a native app):', err);
      }

      try {
        const healthStatus = await checkDatabaseHealth();
        logHealthStatus(healthStatus);
      } catch {
        // Silent fail in production
      }
    };
    runChecks();
  }, []);
  return null;
};

import { useRole } from "./hooks/useRole";
import { useAuth } from "./hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Unified "Gatekeeper" component that handles all top-level redirects.
 * Centralizing this logic prevents "Ping-Pong" redirect loops on mobile.
 */
const AppGatekeeper = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for both auth and role to finish loading before making navigation decisions
    if (authLoading || roleLoading) return;

    // ── Public -> Private ──
    // If logged in and on a public-only page (login/signup), move to dashboard
    if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password")) {
      const isRecruiter = role === "recruiter" || role === "admin";
      const destination = isRecruiter ? "/recruiter" : "/dashboard";

      // Prevent navigation loops - only navigate if we're not already going there
      if (pathname !== (destination as string)) {
        navigate(destination, { replace: true });
      }
    }

    // ── Private -> Public ──
    // If logged out and on a protected page, move to login (handled by ProtectedRoute guards,
    // but Gatekeeper can provide an extra layer of sanity if needed).
  }, [user, role, authLoading, roleLoading, pathname]);

  return <>{children}</>;
};

/** Wraps a page in ProtectedRoute + the persistent AppLayout shell */
const AppPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

/** Wraps a page in ProtectedRoute + RequireRecruiter + RecruiterLayout */
const RecruiterPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <RequireRecruiter>
      <RecruiterLayout>{children}</RecruiterLayout>
    </RequireRecruiter>
  </ProtectedRoute>
);

/** Wraps a page in ProtectedRoute + AdminLayout + RequireAdmin guard */
const AdminPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <RequireAdmin>
      <AdminLayout>{children}</AdminLayout>
    </RequireAdmin>
  </ProtectedRoute>
);

try { (globalThis as { __HUNTER_STEP__?: (n: string) => void }).__HUNTER_STEP__?.('App:pre-component-def'); } catch { /* ignore */ }

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <GeoProvider>
                <AppGatekeeper>
                  <AppInitializer />
                  <ScrollToTop />
                  <FloatingThemeToggle />
                  <CommandPalette />
                  <CookieConsent />
                  <div className="flex flex-col min-h-screen min-h-[100dvh]">
                    <div className="flex-1">
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          {/* ── Public ─────────────────────────────── */}
                          <Route path="/" element={<Index />} />
                          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                          <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                        <Route path="/verify-email" element={<EmailVerification />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/recruiter-portal" element={<RecruiterPortal />} />
                        <Route path="/recruiter-setup" element={<RecruiterSetup />} />

                        {/* ── Onboarding (full-screen, no sidebar) ─ */}
                        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

                        {/* ── Authenticated app shell (sidebar always visible) ─ */}
                        <Route path="/dashboard"             element={<AppPage><Dashboard /></AppPage>} />
                        <Route path="/profile"               element={<AppPage><Profile /></AppPage>} />
                        <Route path="/resume-builder"        element={<AppPage><ResumeBuilder /></AppPage>} />
                        <Route path="/application-wizard"    element={<AppPage><ApplicationWizard /></AppPage>} />
                        <Route path="/interview-coach"       element={<AppPage><InterviewCoach /></AppPage>} />
                        <Route path="/post-interview"        element={<AppPage><PostInterview /></AppPage>} />
                        <Route path="/auto-applier-settings" element={<AppPage><AutoApplierSettings /></AppPage>} />
                        <Route path="/tailored-resumes"      element={<AppPage><TailoredResumes /></AppPage>} />
                        <Route path="/settings"              element={<AppPage><Settings /></AppPage>} />
                        <Route path="/admin/analytics"       element={<AdminPage><AdminAnalytics /></AdminPage>} />

                        {/* ── Platform admin shell ──────────────────────── */}
                        <Route path="/admin"                            element={<AdminPage><AdminOverview /></AdminPage>} />
                        <Route path="/admin/recruiter-applications"     element={<AdminPage><RecruiterApplicationsPage /></AdminPage>} />
                        <Route path="/admin/users"                      element={<AdminPage><AdminUsers /></AdminPage>} />
                        <Route path="/admin/logs"                       element={<AdminPage><AdminLogs /></AdminPage>} />
                        <Route path="/admin/referrals"                  element={<AdminPage><AdminReferrals /></AdminPage>} />

                        {/* ── Recruiter app shell ──────────────────────── */}
                        <Route path="/recruiter"             element={<RecruiterPage><RecruiterDashboard /></RecruiterPage>} />
                        <Route path="/recruiter/jobs"        element={<RecruiterPage><MyJobs /></RecruiterPage>} />
                        <Route path="/recruiter/post-job"    element={<RecruiterPage><PostJob /></RecruiterPage>} />
                        <Route path="/recruiter/jobs/:jobId"      element={<RecruiterPage><JobApplicants /></RecruiterPage>} />
                        <Route path="/recruiter/jobs/:jobId/edit" element={<RecruiterPage><EditJob /></RecruiterPage>} />
                        <Route path="/recruiter/company"     element={<RecruiterPage><CompanyProfile /></RecruiterPage>} />
                        <Route path="/recruiter/candidates"  element={<RecruiterPage><CandidateTalentSearch /></RecruiterPage>} />
                        <Route path="/recruiter/analytics"   element={<RecruiterPage><RecruiterAnalytics /></RecruiterPage>} />
                        <Route path="/recruiter/pricing"     element={<ProtectedRoute><RecruiterPricing /></ProtectedRoute>} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                      </Suspense>
                    </div>
                    <Footer />
                  </div>
                  <BottomNavigation />
                </AppGatekeeper>
              </GeoProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
