import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import {
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Clock,
  Target,
  BarChart3
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { OverageModal } from './OverageModal';
import { FeatureName } from '@/types/subscription';
import { format } from 'date-fns';
import DashboardSkeleton from "@/components/DashboardSkeleton";

interface UsageDashboardProps {
  showUpgradePrompts?: boolean;
}

export default function UsageDashboard({ showUpgradePrompts = true }: UsageDashboardProps) {
  const { usageOverview, usageLoading, usageError } = useSubscription();
  const [selectedOverageFeature, setSelectedOverageFeature] = useState<FeatureName | null>(null);

  if (usageLoading) {
    return <DashboardSkeleton />;
  }

  if (usageError || !usageOverview) {
    return (
      <Card className="border-red-200">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Failed to load usage information
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  void getProgressColor;

  const formatPeriod = (start: string, end: string) => {
    return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usage Dashboard</h2>
          <p className="text-muted-foreground">
            Track your feature usage across the{' '}
            <Badge variant="secondary" className="mx-1">
              {usageOverview.plan_display_name}
            </Badge>
            plan
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Billing Period
          </div>
          <div className="font-medium">
            {formatPeriod(usageOverview.billing_period_start, usageOverview.billing_period_end)}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Features Available</p>
                <p className="text-2xl font-bold">
                  {usageOverview.features.filter(f => f.can_use).length}/{usageOverview.features.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Near Limit</p>
                <p className="text-2xl font-bold">
                  {usageOverview.features.filter(f => f.usage_percentage >= 80 && f.limit_amount !== -1).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Usage</p>
                <p className="text-2xl font-bold">
                  {usageOverview.features.reduce((sum, f) => sum + f.current_usage, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Usage Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {usageOverview.features.map((feature) => (
          <Card key={feature.feature_name} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{feature.display_name}</CardTitle>
                {feature.limit_amount === -1 ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    <Zap className="w-3 h-3 mr-1" />
                    Unlimited
                  </Badge>
                ) : (
                  <Badge
                    variant={feature.usage_percentage >= 90 ? "destructive" : "secondary"}
                    className={
                      feature.usage_percentage >= 90
                        ? ""
                        : feature.usage_percentage >= 75
                        ? "bg-orange-100 text-orange-800"
                        : "bg-green-100 text-green-800"
                    }
                  >
                    {Math.round(feature.usage_percentage)}%
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {feature.limit_amount !== -1 ? (
                <>
                  {/* Usage Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {feature.current_usage} of {feature.limit_amount} used
                      </span>
                      <span className={getUsageColor(feature.usage_percentage)}>
                        {feature.remaining_amount} remaining
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, feature.usage_percentage)}
                      className="h-2"
                    />
                  </div>

                  {/* Overage Credits */}
                  {feature.overage_credits > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-600">
                        {feature.overage_credits} overage credits available
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!feature.can_use && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedOverageFeature(feature.feature_name)}
                        className="flex-1"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Buy More
                      </Button>
                    )}

                    {feature.usage_percentage >= 80 && feature.can_use && showUpgradePrompts && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOverageFeature(feature.feature_name)}
                        className="flex-1"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Prepare
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Unlimited usage</span>
                </div>
              )}

              {/* Feature Status Indicators */}
              {feature.usage_percentage >= 100 && feature.limit_amount !== -1 && (
                <div className="absolute top-0 right-0 w-2 h-full bg-red-500" />
              )}
              {feature.usage_percentage >= 90 && feature.usage_percentage < 100 && feature.limit_amount !== -1 && (
                <div className="absolute top-0 right-0 w-2 h-full bg-orange-500" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      {showUpgradePrompts && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Optimize Your Usage
            </CardTitle>
            <CardDescription>
              Get more value from Hunter AI with these recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Consider Upgrading If:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• You're using 80%+ of any feature regularly</li>
                  <li>• You need overage credits frequently</li>
                  <li>• You want unlimited access to all features</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Pro Tips:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Overage credits don't expire for 1 year</li>
                  <li>• Track usage to predict your needs</li>
                  <li>• Enterprise plans include unlimited usage</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overage Purchase Modal */}
      {selectedOverageFeature && (
        <OverageModal
          featureName={selectedOverageFeature}
          open={!!selectedOverageFeature}
          onClose={() => setSelectedOverageFeature(null)}
        />
      )}
    </div>
  );
}