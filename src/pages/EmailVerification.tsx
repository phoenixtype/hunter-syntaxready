import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleEmailVerification = async () => {
      // Check if this is an email confirmation callback
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      if (token_hash && type === 'email') {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'email',
          });
          
          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
          } else {
            setStatus('success');
            // Redirect to dashboard after 3 seconds
            setTimeout(() => navigate('/dashboard'), 3000);
          }
        } catch (err) {
          setStatus('error');
          setErrorMessage('An unexpected error occurred');
        }
      } else {
        // No token - show pending verification message
        setStatus('pending');
      }
    };

    handleEmailVerification();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background transition-colors duration-500">
      <div className="w-full max-w-md animate-scale-in">
        <div className="glass-card rounded-2xl p-8 md:p-12 space-y-6 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Verifying your email...</h1>
                <p className="text-muted-foreground text-sm">Please wait while we confirm your email address.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Email Verified!</h1>
                <p className="text-muted-foreground text-sm">
                  Your email has been successfully verified. Redirecting you to the dashboard...
                </p>
              </div>
              <Link to="/dashboard">
                <Button className="w-full h-12">
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
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
              <div className="space-y-3">
                <Link to="/signup">
                  <Button variant="outline" className="w-full h-12">
                    Try signing up again
                  </Button>
                </Link>
                <Link to="/login">
                  <Button className="w-full h-12">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Check Your Email</h1>
                <p className="text-muted-foreground text-sm">
                  We've sent you a verification link. Please check your inbox and click the link to verify your account.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <p>Didn't receive the email? Check your spam folder or try signing up again.</p>
              </div>
              <div className="space-y-3">
                <Link to="/signup">
                  <Button variant="outline" className="w-full h-12">
                    Back to Sign Up
                  </Button>
                </Link>
                <Link to="/login">
                  <Button className="w-full h-12">
                    Already Verified? Sign In
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
