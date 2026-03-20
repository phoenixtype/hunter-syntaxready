import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CreditCard,
  TrendingUp,
  Zap,
  Lock,
  ArrowRight,
  
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { OverageModal } from './OverageModal';
import { FeatureName, FEATURE_DISPLAY_NAMES } from '@/types/subscription';
import { useAuth } from '@/hooks/useAuth';

interface UsageGuardProps {
  featureName: FeatureName;
  requiredCount?: number;
  children: React.ReactNode;
  onUsageBlocked?: () => void;
  showInlineWarnings?: boolean;
}

type UsageStatus = 'loading' | 'available' | 'warning' | 'blocked' | 'error';

export function UsageGuard({
  featureName,
  requiredCount = 1,
  children,
  onUsageBlocked,
  showInlineWarnings = true
}: UsageGuardProps) {
  const { user } = useAuth();
  const { canAccess: _canAccess, getRemainingUsage: _getRemainingUsage, recordUsage: _recordUsage, usageOverview } = useSubscription() as any;
  const [usageStatus, setUsageStatus] = useState<UsageStatus>('loading');
  const [usageCheck, setUsageCheck] = useState<any>(null);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Get current feature info from overview
  const featureInfo = usageOverview?.features.find((f: any) => f.feature_name === featureName);

  useEffect(() => {
    if (user?.id) {
      checkUsage();
    }
  }, [user?.id, featureName, requiredCount, usageOverview]);

  const checkUsage = async () => {
    if (!user?.id) {
      setUsageStatus('error');
      return;
    }

    try {
      const check = await (_canAccess as any)({
        user_id: user.id,
        feature_name: featureName,
        requested_count: requiredCount
      });

      setUsageCheck(check);

      if (check.can_use) {
        // Check if we're getting close to limit for warning
        const usagePercentage = check.limit_amount === -1
          ? 0
          : (check.current_usage / check.limit_amount) * 100;

        if (usagePercentage >= 80 && check.limit_amount !== -1) {
          setUsageStatus('warning');
        } else {
          setUsageStatus('available');
        }
      } else {
        setUsageStatus('blocked');
      }
    } catch (error) {
      console.error('Error checking usage:', error);
      setUsageStatus('error');
    }
  };

  const handleActionAttempt = async () => {
    if (usageStatus === 'blocked') {
      setShowBlockedModal(true);
      onUsageBlocked?.();
      return;
    }

    if (usageStatus === 'available' || usageStatus === 'warning') {
      setIsExecuting(true);
      try {
        const result = await (_recordUsage as any)(featureName, requiredCount) as any;
        if (result.success) {
          // Action was successful, feature usage recorded
          await checkUsage(); // Refresh usage status
        } else if (result.needsOverage) {
          // User needs to purchase overage
          setUsageCheck(result.needsOverage);
          setShowOverageModal(true);
        }
      } catch (error) {
        console.error('Error using feature:', error);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const handleUpgrade = () => {
    // Navigate to subscription upgrade page
    window.location.href = '/settings?tab=subscription';
  };

  // Render loading state
  if (usageStatus === 'loading') {
    return (
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    );
  }

  // Render error state
  if (usageStatus === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to check usage limits. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* Inline warning for high usage */}
      {showInlineWarnings && usageStatus === 'warning' && featureInfo && (
        <Alert className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            You're using {Math.round(featureInfo.usage_percentage)}% of your{' '}
            <Badge variant="outline" className="mx-1">
              {FEATURE_DISPLAY_NAMES[featureName]}
            </Badge>
            limit. Consider{' '}
            <Button variant="link" className="h-auto p-0 text-orange-800 underline" onClick={handleUpgrade}>
              upgrading your plan
            </Button>
            {' '}or{' '}
            <Button variant="link" className="h-auto p-0 text-orange-800 underline" onClick={() => setShowOverageModal(true)}>
              purchasing additional credits
            </Button>
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Blocked state */}
      {usageStatus === 'blocked' ? (
        <div className="relative">
          <div className="opacity-50 pointer-events-none">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center">
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <Lock className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div>
                <p className="font-medium text-sm">
                  {FEATURE_DISPLAY_NAMES[featureName]} Limit Reached
                </p>
                <p className="text-xs text-muted-foreground">
                  {usageCheck?.current_usage} / {usageCheck?.limit_amount} used this month
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowOverageModal(true)}
                  className="text-xs"
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  Buy Credits
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpgrade}
                  className="text-xs"
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Upgrade
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Available or warning state - wrap children with click handler
        <div onClick={handleActionAttempt} className={isExecuting ? 'pointer-events-none opacity-70' : ''}>
          {children}
        </div>
      )}

      {/* Blocked Action Modal */}
      <Dialog open={showBlockedModal} onOpenChange={setShowBlockedModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              Feature Limit Reached
            </DialogTitle>
            <DialogDescription>
              You've reached your monthly limit for {FEATURE_DISPLAY_NAMES[featureName]}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {usageCheck && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Current Usage:</span>
                    <Badge variant="destructive">
                      {usageCheck.current_usage} / {usageCheck.limit_amount}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Reset:</span>
                    <span className="text-muted-foreground">
                      {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-medium">Choose how to proceed:</h4>

              <div className="grid grid-cols-1 gap-3">
                {/* Purchase Overage */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">Purchase Credits</p>
                      <p className="text-xs text-muted-foreground">
                        {usageCheck?.overage_cost && `Starting at $${usageCheck.overage_cost.toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Upgrade Plan */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-sm">Upgrade Plan</p>
                      <p className="text-xs text-muted-foreground">
                        Get unlimited access to all features
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockedModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowBlockedModal(false);
              setShowOverageModal(true);
            }}>
              <CreditCard className="w-4 h-4 mr-2" />
              Buy Credits
            </Button>
            <Button variant="secondary" onClick={() => {
              setShowBlockedModal(false);
              handleUpgrade();
            }}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overage Purchase Modal */}
      {showOverageModal && (
        <OverageModal
          featureName={featureName}
          open={showOverageModal}
          onClose={() => {
            setShowOverageModal(false);
            checkUsage(); // Refresh after purchase
          }}
        />
      )}
    </>
  );
}