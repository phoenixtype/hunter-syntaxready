import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Mail, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [errorMessage, setErrorMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");

  // If user is already authenticated, redirect immediately
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const handleEmailVerification = async () => {
      // Check if this is an email confirmation callback
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      // Handle verification token types
      if (token_hash && (type === 'email' || type === 'signup' || type === 'magiclink')) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as 'email' | 'signup' | 'magiclink',
          });

          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
          } else {
            setStatus('success');
            toast.success("Email verified successfully!");
            // Immediate redirect after successful verification
            setTimeout(() => navigate('/onboarding', { replace: true }), 1500);
          }
        } catch (err) {
          setStatus('error');
          setErrorMessage('An unexpected error occurred');
        }
      } else {
        // Check for stored email from signup
        const storedEmail = sessionStorage.getItem('pendingVerificationEmail');
        if (storedEmail) {
          setLastEmail(storedEmail);
        }
        setStatus('pending');
      }
    };

    // Only run verification if not already authenticated
    if (!authLoading && !user) {
      handleEmailVerification();
    }
  }, [searchParams, navigate, authLoading, user]);

  const handleResendEmail = async () => {
    const emailToResend = lastEmail || manualEmail;

    if (!emailToResend) {
      toast.error("Please enter your email address.");
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Verification email sent to ${emailToResend}! Check your inbox.`);
        // If successful, save to session storage for convenience
        if (!lastEmail) {
          setLastEmail(emailToResend);
          sessionStorage.setItem('pendingVerificationEmail', emailToResend);
        }
      }
    } catch (err) {
      toast.error("Failed to resend email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background transition-colors duration-500 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="w-full max-w-md animate-scale-in">
        <div className="bg-card/50 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-8 md:p-12 space-y-6 text-center">
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse shadow-glow">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Verifying your email...</h1>
                <p className="text-muted-foreground text-sm">Please wait while we confirm your email address.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shadow-glow">
                <CheckCircle2 className="w-10 h-10 text-primary animate-bounce" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Email Verified!</h1>
                <p className="text-muted-foreground text-sm">
                  Taking you to complete your profile...
                </p>
              </div>
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting...</span>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Verification Failed</h1>
                <p className="text-muted-foreground text-sm">
                  {errorMessage || "The verification link may have expired or is invalid."}
                </p>
              </div>
              <div className="space-y-3 pt-4">
                <Link to="/signup">
                  <Button variant="outline" className="w-full h-12 rounded-xl border-white/20 hover:bg-white/5 transition-all">
                    Try signing up again
                  </Button>
                </Link>
                <Link to="/login">
                  <Button className="w-full h-12 rounded-xl shadow-glow transition-all">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shadow-glow">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Check Your Email</h1>
                <p className="text-muted-foreground text-sm">
                  We've sent you a verification link. Click the link in your email to continue.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground space-y-2">
                <p>Didn't receive the email? Check your spam folder.</p>
                {lastEmail ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResendEmail}
                    disabled={resending}
                    className="text-foreground hover:text-foreground/80 whitespace-normal h-auto py-2 text-center"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend verification email to {lastEmail}
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 mt-4 max-w-xs mx-auto">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="h-10 text-sm"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleResendEmail}
                      disabled={resending || !manualEmail}
                      className="w-full"
                    >
                      {resending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend verification email"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-6">
                <Link to="/login">
                  <Button className="w-full h-12 rounded-xl shadow-glow hover:shadow-glow-lg transition-all">
                    Already Verified? Sign In <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
