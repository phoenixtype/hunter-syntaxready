import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Crown,
  Zap,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  Check,
  AlertCircle,
  History,
  Settings
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UsageDashboard from './UsageDashboard';
import { format } from 'date-fns';
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { SubscriptionPlan } from '@/types/subscription';

interface SubscriptionSettingsProps {
  defaultTab?: 'usage' | 'plans' | 'billing' | 'history';
}

export default function SubscriptionSettings({ defaultTab = 'usage' }: SubscriptionSettingsProps) {
  const {
    plans,
    currentSubscription,
    plansLoading,
    subscriptionLoading
  } = useSubscription();

  const [_selectedPlan, _setSelectedPlan] = useState<any>(null);

  if (plansLoading || subscriptionLoading) {
    return <DashboardSkeleton />;
  }

  const currentPlan = (currentSubscription as any)?.subscription_plans || {
    name: currentSubscription?.tier || 'free',
    display_name: currentSubscription?.tier ? currentSubscription.tier.charAt(0).toUpperCase() + currentSubscription.tier.slice(1) : 'Free',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    id: '',
  };

  const handleUpgrade = (plan: SubscriptionPlan) => {
    _setSelectedPlan(plan);
    // In a real implementation, this would redirect to Stripe checkout
    console.log('Upgrading to plan:', plan.name);
  };

  const handleManageBilling = () => {
    // In a real implementation, this would redirect to Stripe customer portal
    console.log('Opening Stripe customer portal...');
  };

  const formatPrice = (monthly: number, yearly: number, interval: 'monthly' | 'yearly' = 'monthly') => {
    const price = interval === 'monthly' ? monthly : yearly;
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}/${interval === 'monthly' ? 'mo' : 'yr'}`;
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'free':
        return <Users className="w-5 h-5" />;
      case 'pro':
        return <Crown className="w-5 h-5" />;
      case 'enterprise':
        return <Building2 className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'pro':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subscription & Usage</h2>
          <p className="text-muted-foreground">
            Manage your subscription plan and track feature usage
          </p>
        </div>
        {currentSubscription && (
          <Button variant="outline" onClick={handleManageBilling}>
            <Settings className="w-4 h-4 mr-2" />
            Manage Billing
          </Button>
        )}
      </div>

      {/* Current Plan Status */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                {getPlanIcon(currentPlan?.name || 'free')}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {currentPlan?.display_name || 'Free Tier'}
                  <Badge className={getPlanColor(currentPlan?.name || 'free')}>
                    Current Plan
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {currentPlan?.description || 'Perfect for exploring Hunter AI'}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {formatPrice(currentPlan?.price_monthly || 0, currentPlan?.price_yearly || 0)}
              </p>
              {currentSubscription && (
                <p className="text-sm text-muted-foreground">
                  Renews {format(new Date(currentSubscription.current_period_end || new Date()), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-6">
          <UsageDashboard />
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans?.map((plan: any) => {
              const isCurrent = currentPlan?.id === plan.id;
              const isUpgrade = currentPlan && plan.price_monthly > currentPlan.price_monthly;

              return (
                <Card key={plan.id} className={`relative ${isCurrent ? 'ring-2 ring-purple-500' : ''}`}>
                  {isUpgrade && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Upgrade
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center">
                    <div className="mx-auto p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full w-fit">
                      {getPlanIcon(plan.name)}
                    </div>
                    <CardTitle>{plan.display_name}</CardTitle>
                    <CardDescription className="h-12">{plan.description}</CardDescription>
                    <div className="space-y-1">
                      <p className="text-3xl font-bold">
                        {formatPrice(plan.price_monthly, plan.price_yearly)}
                      </p>
                      {plan.price_yearly > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(plan.price_monthly, plan.price_yearly, 'yearly')} (save 17%)
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Feature limits */}
                    <div className="space-y-2">
                      {Object.entries(plan.feature_limits).map(([feature, limit]) => (
                        <div key={feature} className="flex items-center justify-between text-sm">
                          <span className="capitalize">
                            {feature.replace(/_/g, ' ')}
                          </span>
                          <span className="font-medium">
                            {limit === -1 ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <Zap className="w-3 h-3 mr-1" />
                                Unlimited
                              </Badge>
                            ) : (
                              `${limit}/month`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Action button */}
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent}
                      onClick={() => handleUpgrade(plan)}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Current Plan
                        </>
                      ) : isUpgrade ? (
                        <>
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Upgrade
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Select Plan
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Subscription */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentSubscription ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Plan:</span>
                        <span className="font-medium">{currentPlan?.display_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                          {currentSubscription.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Next billing:</span>
                        <span>{format(new Date(currentSubscription.current_period_end || new Date()), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount:</span>
                        <span className="font-medium">
                          {formatPrice(currentPlan?.price_monthly || 0, currentPlan?.price_yearly || 0)}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleManageBilling}>
                      Manage Billing
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>No active subscription</p>
                    <p className="text-sm">You're on the free plan</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentSubscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <CreditCard className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expires 12/25</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleManageBilling}>
                      Update Payment Method
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No payment method on file</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Billing History
              </CardTitle>
              <CardDescription>
                View your subscription and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2" />
                <p>No billing history available</p>
                <p className="text-sm">Payments and invoices will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}