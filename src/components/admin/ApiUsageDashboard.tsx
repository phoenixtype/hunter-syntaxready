/**
 * API Usage Dashboard
 *
 * Provides insights into jsearch API usage and optimization recommendations.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Settings
} from 'lucide-react';

interface ApiUsageData {
  totalCalls: number;
  successfulCalls: number;
  cacheHits: number;
  creditsUsed: number;
  estimatedCost: number;
  cacheEfficiency: number;
  successRate: number;
  dailyUsage: { date: string; calls: number; credits: number }[];
  topQueries: { query: string; count: number; avgResults: number }[];
  budget: {
    dailyLimit: number;
    usagePercentage: number;
    status: 'good' | 'warning' | 'over_budget';
    recommendation: string;
  };
  optimizations: string[];
}

interface ApiUsageDashboardProps {
  className?: string;
}

export const ApiUsageDashboard: React.FC<ApiUsageDashboardProps> = ({ className }) => {
  const [usageData, setUsageData] = useState<ApiUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    loadUsageData();

    // Refresh data every minute
    const interval = setInterval(loadUsageData, 60000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const loadUsageData = async () => {
    try {
      setIsLoading(true);

      // In a real implementation, this would fetch from your API
      // For now, we'll simulate the data structure
      const mockData: ApiUsageData = {
        totalCalls: 45,
        successfulCalls: 42,
        cacheHits: 28,
        creditsUsed: 17,
        estimatedCost: 0.17,
        cacheEfficiency: 62.2,
        successRate: 93.3,
        dailyUsage: [
          { date: '2024-01-20', calls: 15, credits: 5 },
          { date: '2024-01-21', calls: 22, credits: 8 },
          { date: '2024-01-22', calls: 8, credits: 4 },
        ],
        topQueries: [
          { query: 'software engineer remote', count: 12, avgResults: 24 },
          { query: 'frontend developer React', count: 8, avgResults: 18 },
          { query: 'python developer', count: 6, avgResults: 22 },
        ],
        budget: {
          dailyLimit: 1.00,
          usagePercentage: 17,
          status: 'good',
          recommendation: 'Usage within budget. Continue current practices.'
        },
        optimizations: [
          'Cache efficiency is good at 62%',
          'Consider expanding successful query patterns',
          'Monitor weekend usage patterns'
        ]
      };

      setUsageData(mockData);
    } catch (error) {
      console.error('Failed to load usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBudgetStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'over_budget': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getBudgetStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'over_budget': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default: return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-pulse">Loading API usage data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usageData) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load API usage data. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">API Usage Dashboard</h2>
          <p className="text-gray-600">Monitor jsearch API consumption and optimization</p>
        </div>
        <Button onClick={loadUsageData} variant="outline" size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Budget Status Alert */}
      <Alert className={usageData.budget.status !== 'good' ? 'border-yellow-200 bg-yellow-50' : ''}>
        <div className="flex items-center gap-2">
          {getBudgetStatusIcon(usageData.budget.status)}
          <AlertDescription className={getBudgetStatusColor(usageData.budget.status)}>
            <strong>Budget Status:</strong> {usageData.budget.recommendation}
          </AlertDescription>
        </div>
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total API Calls</p>
                <p className="text-2xl font-bold">{usageData.totalCalls}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2">
              <Badge variant={usageData.successRate > 90 ? "default" : "secondary"}>
                {usageData.successRate.toFixed(1)}% success rate
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cache Efficiency</p>
                <p className="text-2xl font-bold">{usageData.cacheEfficiency.toFixed(1)}%</p>
              </div>
              <Zap className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              <Progress value={usageData.cacheEfficiency} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Credits Used</p>
                <p className="text-2xl font-bold">{usageData.creditsUsed}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-2">
              <Badge variant="outline">
                {usageData.cacheHits} cache hits saved credits
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Estimated Cost</p>
                <p className="text-2xl font-bold">${usageData.estimatedCost.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Progress value={usageData.budget.usagePercentage} className="h-2 flex-1" />
                <span className="text-xs text-gray-600">
                  {usageData.budget.usagePercentage.toFixed(0)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="queries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queries">Top Queries</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
          <TabsTrigger value="optimization">Optimization Tips</TabsTrigger>
        </TabsList>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Performing Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usageData.topQueries.map((query, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{query.query}</p>
                      <p className="text-sm text-gray-600">{query.count} calls</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{query.avgResults.toFixed(1)}</p>
                      <p className="text-sm text-gray-600">avg jobs</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Usage Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usageData.dailyUsage.slice(-7).map((day, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{day.date}</p>
                      <p className="text-sm text-gray-600">{day.calls} API calls</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{day.credits} credits</p>
                      <p className="text-sm text-gray-600">${(day.credits * 0.01).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Optimization Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {usageData.optimizations.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800">{tip}</p>
                  </div>
                ))}
              </div>

              {usageData.budget.status !== 'good' && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Action Needed:</strong> {usageData.budget.recommendation}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApiUsageDashboard;