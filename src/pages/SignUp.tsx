import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { signUpFormSchema, validateWithSchema, getPasswordStrength } from "@/lib/validation";

const SignUp = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loading, signUp } = useAuth();
  const navigate = useNavigate();
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateWithSchema(signUpFormSchema, { fullName, email, password });
    if (!validation.success) {
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validData = (validation as { success: true; data: { fullName: string; email: string; password: string } }).data;
    const { fullName: validatedName, email: validatedEmail, password: validatedPassword } = validData;

    setIsLoading(true);
    try {
      console.log('[SIGNUP] Attempting signup for:', validatedEmail);
      const { data, error } = await signUp(validatedEmail, validatedPassword, validatedName);

      console.log('[SIGNUP] Response:', { hasData: !!data, hasError: !!error, errorMessage: error?.message });

      if (error) {
        console.error('[SIGNUP] Error details:', error);

        if (error.message.includes("Password")) {
          toast.error("Password must be at least 6 characters");
        } else if (error.message.includes("User already registered")) {
          sessionStorage.setItem('pendingVerificationEmail', validatedEmail);
          toast.success("Check your email to confirm your account.");
          navigate("/verify-email");
          return;
        } else if (error.message.includes("Email")) {
          toast.error("Please enter a valid email address");
        } else {
          console.error('[SIGNUP] Full error:', error);
          toast.error("Unable to create account. Please try again.");
        }
        return;
      }

      if (data?.session) {
        console.log('[SIGNUP] Session created, redirecting to onboarding');
        toast.success("Account created! Logging you in...");
        navigate("/onboarding", { replace: true });
      } else {
        console.log('[SIGNUP] No session, email verification required');
        sessionStorage.setItem('pendingVerificationEmail', validatedEmail);
        toast.success("Account created! Check your email to confirm.");
        navigate("/verify-email");
      }
    } catch (error) {
      console.error('[SIGNUP] Unexpected error:', error);
      toast.error(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="w-full max-w-md animate-fade-in-up">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-all hover:-translate-x-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-card/50 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-8 md:p-12 space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-muted-foreground text-sm">Start your autonomous job search today</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className="h-12"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  className="h-12 pr-10"
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
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1 h-1">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`flex-1 rounded-full transition-colors ${index <= passwordStrength.score
                          ? passwordStrength.color
                          : 'bg-muted'
                          }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${passwordStrength.score >= 3 ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                    Password strength: {passwordStrength.label}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                8+ characters with uppercase, lowercase, numbers, and symbols
              </p>
            </div>
            <Button
              type="submit"
              className="w-full h-12 sm:h-14 text-base font-medium rounded-xl shadow-glow hover:shadow-glow-lg transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground font-medium hover:underline inline-flex items-center gap-1">
              Sign in <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
