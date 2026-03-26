import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';

/**
 * Landing page for approved recruiters arriving via magic link.
 * They set their password and are redirected to the recruiter dashboard.
 */
const RecruiterSetup = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Magic link sets the session automatically on load via Supabase auth
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSessionReady(true);
    });
    return () => authSub.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    const { data: { user }, error } = await supabase.auth.updateUser({ password });
    if (error) {
      const msg = error.message?.includes('same_password') || error.message?.includes('should be different')
        ? 'Please choose a different password from any previously used password.'
        : (error.message || 'Failed to set password');
      toast.error(msg);
      setLoading(false);
      return;
    }

    // Ensure profile has role=recruiter regardless of trigger state
    if (user) {
      await supabase
        .from('profiles')
        .upsert({ id: user.id, role: 'recruiter', email: user.email }, { onConflict: 'id' });
    }

    toast.success('Account set up! Redirecting to your dashboard…');
    setTimeout(() => navigate('/recruiter'), 1200);
  };

  return (
    <>
      <SEOHead title="Set Up Your Recruiter Account" path="/recruiter-setup" />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-card">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-2">You're approved!</h1>
            <p className="text-sm text-muted-foreground">Set a password to complete your hunter.ai recruiter account.</p>
          </div>

          {!sessionReady ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying your link…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Setting up…</> : 'Complete setup'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default RecruiterSetup;
