import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="bg-card/50 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 md:p-12 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
              <p className="text-muted-foreground text-sm">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
            </div>
            <Link to="/login">
              <Button variant="outline" className="w-full h-12 rounded-xl border-white/20 hover:bg-white/5 transition-all mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="w-full max-w-md animate-fade-in-up">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-all hover:-translate-x-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="bg-card/50 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 md:p-12 space-y-8">
          <div className="space-y-2 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mb-4 shadow-glow">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium rounded-xl shadow-glow hover:shadow-glow-lg transition-all mt-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
