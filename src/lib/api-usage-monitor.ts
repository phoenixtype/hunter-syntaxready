/**
 * API Usage Monitor
 *
 * Tracks and analyzes jsearch API usage to provide insights and prevent
 * excessive credit consumption.
 */

import { supabase } from '@/integrations/supabase/client';

interface ApiUsageMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  cacheHits: number;
  cacheMisses: number;
  averageJobsPerCall: number;
  creditsUsed: number;
  estimatedCost: number;
  dailyUsage: { date: string; calls: number; credits: number }[];
  topQueries: { query: string; count: number; avgResults: number }[];
}

interface ApiCallResult {
  query: string;
  success: boolean;
  jobsFound: number;
  fromCache: boolean;
  executionTime: number;
  creditsConsumed: number;
  timestamp: Date;
  userId?: string;
  errorMessage?: string;
}

class ApiUsageMonitor {
  private metrics: ApiUsageMetrics = this.initializeMetrics();
  private recentCalls: ApiCallResult[] = [];
  private readonly MAX_RECENT_CALLS = 100;
  private readonly COST_PER_CREDIT = 0.01; // Estimated cost per credit

  private initializeMetrics(): ApiUsageMetrics {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageJobsPerCall: 0,
      creditsUsed: 0,
      estimatedCost: 0,
      dailyUsage: [],
      topQueries: []
    };
  }

  /**
   * Record an API call result
   */
  recordApiCall(result: ApiCallResult): void {
    // Update metrics
    this.metrics.totalCalls++;

    if (result.success) {
      this.metrics.successfulCalls++;
    } else {
      this.metrics.failedCalls++;
    }

    if (result.fromCache) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
      this.metrics.creditsUsed += result.creditsConsumed;
    }

    this.metrics.estimatedCost = this.metrics.creditsUsed * this.COST_PER_CREDIT;
    this.metrics.averageJobsPerCall = this.calculateAverageJobsPerCall();

    // Store recent call
    this.recentCalls.unshift(result);
    if (this.recentCalls.length > this.MAX_RECENT_CALLS) {
      this.recentCalls.pop();
    }

    // Update daily usage
    this.updateDailyUsage(result);

    // Update top queries
    this.updateTopQueries(result);

    // Log significant events
    if (!result.success) {
      console.warn('[API_MONITOR] Failed API call:', {
        query: result.query,
        error: result.errorMessage,
        time: result.timestamp
      });
    }

    if (result.creditsConsumed > 5) {
      console.info('[API_MONITOR] High credit usage:', {
        query: result.query,
        credits: result.creditsConsumed,
        jobs: result.jobsFound
      });
    }

    // Save to database for persistence (optional)
    this.saveMetricsToDB().catch(console.error);
  }

  /**
   * Get current metrics
   */
  getMetrics(): ApiUsageMetrics {
    return { ...this.metrics };
  }

  /**
   * Get efficiency analysis
   */
  getEfficiencyAnalysis(): {
    cacheEfficiency: number;
    successRate: number;
    averageCreditsPerJob: number;
    recommendedOptimizations: string[];
  } {
    const cacheEfficiency = this.metrics.totalCalls > 0
      ? (this.metrics.cacheHits / this.metrics.totalCalls) * 100
      : 0;

    const successRate = this.metrics.totalCalls > 0
      ? (this.metrics.successfulCalls / this.metrics.totalCalls) * 100
      : 0;

    const averageCreditsPerJob = this.metrics.successfulCalls > 0 && this.metrics.averageJobsPerCall > 0
      ? this.metrics.creditsUsed / (this.metrics.successfulCalls * this.metrics.averageJobsPerCall)
      : 0;

    const recommendations = this.generateOptimizationRecommendations();

    return {
      cacheEfficiency,
      successRate,
      averageCreditsPerJob,
      recommendedOptimizations: recommendations
    };
  }

  /**
   * Get usage report for a specific time period
   */
  getUsageReport(days: number = 7): {
    period: string;
    totalCalls: number;
    totalCredits: number;
    averageDailyCalls: number;
    averageDailyCredits: number;
    projectedMonthlyCost: number;
    topPerformingQueries: { query: string; efficiency: number }[];
  } {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const periodCalls = this.recentCalls.filter(call =>
      call.timestamp >= startDate && call.timestamp <= endDate
    );

    const totalCalls = periodCalls.length;
    const totalCredits = periodCalls.reduce((sum, call) => sum + call.creditsConsumed, 0);

    const averageDailyCalls = totalCalls / days;
    const averageDailyCredits = totalCredits / days;
    const projectedMonthlyCost = (averageDailyCredits * 30) * this.COST_PER_CREDIT;

    const queryPerformance = this.analyzeQueryPerformance(periodCalls);

    return {
      period: `${days} days`,
      totalCalls,
      totalCredits,
      averageDailyCalls,
      averageDailyCredits,
      projectedMonthlyCost,
      topPerformingQueries: queryPerformance
    };
  }

  /**
   * Check if usage is within budget limits
   */
  checkBudgetStatus(dailyBudget: number): {
    status: 'good' | 'warning' | 'over_budget';
    usagePercentage: number;
    projectedDailyCost: number;
    recommendation: string;
  } {
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = this.metrics.dailyUsage.find(day => day.date === today);
    const todayCredits = todayUsage?.credits || 0;
    const projectedDailyCost = todayCredits * this.COST_PER_CREDIT;
    const usagePercentage = (projectedDailyCost / dailyBudget) * 100;

    let status: 'good' | 'warning' | 'over_budget';
    let recommendation: string;

    if (usagePercentage > 100) {
      status = 'over_budget';
      recommendation = 'Daily budget exceeded. Consider increasing cache TTL or reducing search frequency.';
    } else if (usagePercentage > 80) {
      status = 'warning';
      recommendation = 'Approaching budget limit. Monitor usage closely and optimize queries.';
    } else {
      status = 'good';
      recommendation = 'Usage within budget. Continue current practices.';
    }

    return {
      status,
      usagePercentage,
      projectedDailyCost,
      recommendation
    };
  }

  /**
   * Reset metrics (for new day/period)
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.recentCalls = [];
    console.log('[API_MONITOR] Metrics reset');
  }

  private calculateAverageJobsPerCall(): number {
    const successfulCalls = this.recentCalls.filter(call => call.success);
    if (successfulCalls.length === 0) return 0;

    const totalJobs = successfulCalls.reduce((sum, call) => sum + call.jobsFound, 0);
    return totalJobs / successfulCalls.length;
  }

  private updateDailyUsage(result: ApiCallResult): void {
    const date = result.timestamp.toISOString().split('T')[0];
    let dayUsage = this.metrics.dailyUsage.find(day => day.date === date);

    if (!dayUsage) {
      dayUsage = { date, calls: 0, credits: 0 };
      this.metrics.dailyUsage.push(dayUsage);
    }

    dayUsage.calls++;
    dayUsage.credits += result.creditsConsumed;

    // Keep only last 30 days
    this.metrics.dailyUsage = this.metrics.dailyUsage
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }

  private updateTopQueries(result: ApiCallResult): void {
    let queryStats = this.metrics.topQueries.find(q => q.query === result.query);

    if (!queryStats) {
      queryStats = { query: result.query, count: 0, avgResults: 0 };
      this.metrics.topQueries.push(queryStats);
    }

    queryStats.count++;
    queryStats.avgResults = (queryStats.avgResults * (queryStats.count - 1) + result.jobsFound) / queryStats.count;

    // Keep only top 10 queries
    this.metrics.topQueries = this.metrics.topQueries
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    const analysis = this.getEfficiencyAnalysis();

    if (analysis.cacheEfficiency < 30) {
      recommendations.push('Increase cache TTL to improve cache hit rate');
    }

    if (analysis.successRate < 80) {
      recommendations.push('Review and optimize failing queries');
    }

    if (analysis.averageCreditsPerJob > 0.5) {
      recommendations.push('Focus on higher-quality queries with better job yields');
    }

    if (this.metrics.failedCalls > this.metrics.successfulCalls * 0.2) {
      recommendations.push('Investigate and fix recurring API errors');
    }

    const recentFailures = this.recentCalls
      .filter(call => !call.success)
      .slice(0, 5);

    if (recentFailures.length > 2) {
      recommendations.push('Address recent API failures to prevent wasted credits');
    }

    return recommendations;
  }

  private analyzeQueryPerformance(calls: ApiCallResult[]): { query: string; efficiency: number }[] {
    const queryGroups = calls.reduce((groups, call) => {
      if (!groups[call.query]) {
        groups[call.query] = [];
      }
      groups[call.query].push(call);
      return groups;
    }, {} as { [query: string]: ApiCallResult[] });

    return Object.entries(queryGroups)
      .map(([query, queryCalls]) => {
        const totalJobs = queryCalls.reduce((sum, call) => sum + call.jobsFound, 0);
        const totalCredits = queryCalls.reduce((sum, call) => sum + call.creditsConsumed, 0);
        const efficiency = totalCredits > 0 ? totalJobs / totalCredits : 0;

        return { query, efficiency };
      })
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 5);
  }

  private async saveMetricsToDB(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save to a metrics table (would need to be created)
      await supabase.from('api_usage_metrics').upsert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        total_calls: this.metrics.totalCalls,
        successful_calls: this.metrics.successfulCalls,
        cache_hits: this.metrics.cacheHits,
        credits_used: this.metrics.creditsUsed,
        estimated_cost: this.metrics.estimatedCost,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.debug('[API_MONITOR] Could not save metrics to DB:', error);
      // Non-critical error, continue without throwing
    }
  }
}

// Export singleton instance
export const apiUsageMonitor = new ApiUsageMonitor();
export { ApiUsageMetrics, ApiCallResult };