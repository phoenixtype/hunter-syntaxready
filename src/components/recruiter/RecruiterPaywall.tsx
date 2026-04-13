import React from 'react';
import { useRecruiterSubscription } from '@/hooks/useRecruiterSubscription';
import { useRole } from '@/hooks/useRole';
import RecruiterPricing from '@/pages/recruiter/RecruiterPricing';
import { Loader2, Lock } from 'lucide-react';

interface RecruiterPaywallProps {
  children: React.ReactNode;
}

export const RecruiterPaywall: React.FC<RecruiterPaywallProps> = ({ children }) => {
  const { isSubscribed, loading: subLoading } = useRecruiterSubscription();
  const { user } = useAuth();
  const { isRecruiter, loading: roleLoading } = useRole(user?.id);

  const loading = subLoading || roleLoading;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Verifying subscription…</p>
      </div>
    );
  }

  if (!isSubscribed && !isAdmin) {
    return (
      <div className="relative">
        <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[2px] pointer-events-none" />
        
        <div className="relative z-20 flex flex-col items-center pt-12 pb-8 px-4 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Upgrade to Unlock Hunter.ai Recruiter</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
            You're one step away from reaching top talent. Choose a plan to post jobs, search candidates, and start hiring today.
          </p>
          
          <div className="w-full max-w-6xl pointer-events-auto">
            <RecruiterPricing />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
