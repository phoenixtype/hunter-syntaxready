import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { loginFormSchema, validateWithSchema } from "@/lib/validation";

import WavyBackground from "@/components/WavyBackground";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loading, signIn } = useAuth();
  const navigate = useNavigate();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateWithSchema(loginFormSchema, { email, password });
    if (!validation.success) {
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        // Handle unconfirmed email specifically
        if (error.message.includes("Email not confirmed")) {
          // Store email for resend functionality
          sessionStorage.setItem('pendingVerificationEmail', email);
          toast.error("Please verify your email address before signing in.");
          navigate("/verify-email");
          return;
        }

        // SECURITY: Use generic error message to prevent email enumeration
        // Don't reveal whether the email exists or if password is wrong
        toast.error("Invalid credentials. Please check your email and password.");
        return;
      }

      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      // SECURITY: Generic error for unexpected failures
      toast.error("Unable to sign in. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background transition-colors duration-500 safe-area-inset-bottom relative overflow-hidden">
      {/* Dynamic Wavy Background */}
      <WavyBackground />

      <div className="w-full max-w-md animate-scale-in relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors touch-manipulation py-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Home
        </Link>

        <div className="glass-card glass-premium rounded-2xl p-6 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Enter your credentials to access your agent</p>
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
                className="bg-transparent border-muted h-12 input-glow transition-all duration-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                aria-describedby="email-description"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="bg-transparent border-muted h-12 pr-10 input-glow transition-all duration-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              variant="gradient"
              className="w-full h-12 sm:h-14 text-base font-medium touch-manipulation rounded-xl"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
              Sign up <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
