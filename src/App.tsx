import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import ApplicationWizard from "./pages/ApplicationWizard";
import AutoApplierSettings from "./pages/AutoApplierSettings";
import InterviewCoach from "./pages/InterviewCoach";
import ResumeBuilder from "./pages/ResumeBuilder";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ForgotPassword from "./pages/ForgotPassword";
import EmailVerification from "./pages/EmailVerification";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PublicRoute } from "./components/auth/PublicRoute";
import FloatingThemeToggle from "./components/FloatingThemeToggle";
import { runStartupValidation } from "./lib/env_validator";
import { checkDatabaseHealth, logHealthStatus } from "./lib/database_health";

const queryClient = new QueryClient();

const AppInitializer = () => {
  useEffect(() => {
    // Run startup validations
    const runChecks = async () => {
      console.log('🚀 Hunter AI - Starting up...');

      // Validate environment variables
      runStartupValidation();

      // Check database health (non-blocking)
      try {
        const healthStatus = await checkDatabaseHealth();
        logHealthStatus(healthStatus);
      } catch (err) {
        console.warn('⚠️ Database health check failed:', err);
      }
    };

    runChecks();
  }, []);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppInitializer />
            <ScrollToTop />
            <FloatingThemeToggle />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/signup" element={
                <PublicRoute>
                  <SignUp />
                </PublicRoute>
              } />
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/application-wizard" element={
                <ProtectedRoute>
                  <ApplicationWizard />
                </ProtectedRoute>
              } />
              <Route path="/auto-applier-settings" element={
                <ProtectedRoute>
                  <AutoApplierSettings />
                </ProtectedRoute>
              } />
              <Route path="/interview-coach" element={
                <ProtectedRoute>
                  <InterviewCoach />
                </ProtectedRoute>
              } />
              <Route path="/resume-builder" element={
                <ProtectedRoute>
                  <ResumeBuilder />
                </ProtectedRoute>
              } />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/forgot-password" element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              } />
              <Route path="/verify-email" element={<EmailVerification />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
