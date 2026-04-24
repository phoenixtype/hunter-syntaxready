/**
 * Premium Job Search Button
 *
 * Subscription-gated job search button that shows quota status and handles upgrades.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Crown,
  Zap,
  Lock,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';

interface PremiumJobSearchButtonProps {
  onSearch: () => void;
  isSearching: boolean;
  disabled?: boolean;
  className?: string;
}

interface QuotaStatus {
  manual: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export const PremiumJobSearchButton: React.FC<PremiumJobSearchButtonProps> = ({
  onSearch,
  isSearching,
  disabled = false,
  className
}) => {
  const { user } = useAuth();
  const { currentSubscription } = useSubscription();
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);

  const userTier = currentSubscription?.tier || 'free';
  const isPremium = userTier === 'pro' || userTier === 'enterprise';

  // Mock quota status - in real app, this would come from API
  useEffect(() => {
    const mockQuotaStatus: QuotaStatus = {
      manual: {
        used: userTier === 'free' ? 0 : Math.floor(Math.random() * (userTier === 'pro' ? 3 : 10)),
        limit: userTier === 'free' ? 0 : (userTier === 'pro' ? 3 : 10),
        remaining: userTier === 'free' ? 0 : (userTier === 'pro' ? 3 : 10) - Math.floor(Math.random() * (userTier === 'pro' ? 3 : 10))
      }
    };
    setQuotaStatus(mockQuotaStatus);
  }, [userTier]);

  const handleSearchClick = () => {
    if (!isPremium) {
      // Redirect to upgrade
      window.location.href = '/pricing?feature=manual_search';
      return;
    }

    if (quotaStatus?.manual.remaining === 0) {
      return; // Don't search if no quota remaining
    }

    onSearch();
  };

  const getQuotaColor = (remaining: number, limit: number) => {
    const percentage = (remaining / limit) * 100;
    if (percentage > 60) return 'bg-green-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pro': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Free user view
  if (!isPremium) {
    return (
      <Card className={`border-2 border-dashed border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50 ${className}`}>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="h-6 w-6 text-yellow-600" />
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                Premium Feature
              </Badge>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">
                Unlock Targeted Job Searches
              </h3>
              <p className="text-sm text-gray-600">
                Get personalized, high-quality job matches with manual search.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <Button
                onClick={handleSearchClick}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-lg"
                size="lg"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>

              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Sparkles className="h-3 w-3" />
                <span>3 targeted searches per day</span>
              </div>
            </div>

            <Alert className="text-left">
              <Lock className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>What you'll get:</strong> AI-powered job matching, targeted search queries,
                priority support, and up to 3 manual searches daily.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Premium user view
  return (
    <Card className={`border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with tier badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Premium Job Search</h3>
            </div>
            <Badge className={`${getTierBadgeColor(userTier)} font-medium`}>
              {userTier.toUpperCase()}
              {userTier === 'enterprise' && <Crown className="h-3 w-3 ml-1" />}
            </Badge>
          </div>

          {/* Quota status */}
          {quotaStatus && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Daily Quota</span>
                <span className="text-sm text-gray-600">
                  {quotaStatus.manual.remaining} of {quotaStatus.manual.limit} remaining
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getQuotaColor(quotaStatus.manual.remaining, quotaStatus.manual.limit)}`}
                  style={{ width: `${(quotaStatus.manual.remaining / quotaStatus.manual.limit) * 100}%` }}
                />
              </div>
              {quotaStatus.manual.remaining === 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                  <Clock className="h-3 w-3" />
                  Quota resets at midnight
                </div>
              )}
            </div>
          )}

          {/* Search button */}
          <Button
            onClick={handleSearchClick}
            disabled={disabled || isSearching || quotaStatus?.manual.remaining === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            size="lg"
          >
            {isSearching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Searching for jobs...
              </>
            ) : quotaStatus?.manual.remaining === 0 ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Daily quota used
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Targeted Jobs
              </>
            )}
          </Button>

          {/* Benefits reminder */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                AI-powered
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                High relevance
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Fresh results
              </div>
            </div>
          </div>

          {/* Quota warning */}
          {quotaStatus && quotaStatus.manual.remaining <= 1 && quotaStatus.manual.remaining > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Only {quotaStatus.manual.remaining} search{quotaStatus.manual.remaining !== 1 ? 'es' : ''} remaining today.
                Use wisely for best results!
              </AlertDescription>
            </Alert>
          )}

          {userTier === 'pro' && (
            <div className="text-center">
              <Button variant="link" size="sm" className="text-xs text-purple-600 hover:text-purple-700">
                Upgrade to Enterprise for 10 daily searches →
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PremiumJobSearchButton;