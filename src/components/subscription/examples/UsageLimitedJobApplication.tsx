import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Send,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { UsageGuard } from '../UsageGuard';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface JobApplicationProps {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    posted_date: string;
  };
  onApplicationSubmit: (jobId: string) => Promise<void>;
}

/**
 * Example component showing how to integrate usage limits into job applications
 */
export function UsageLimitedJobApplication({ job, onApplicationSubmit }: JobApplicationProps) {
  const [isApplying, setIsApplying] = useState(false);
  const { usageOverview } = useSubscription();

  // Get current job application usage
  const applicationUsage = usageOverview?.features.find(f => f.feature_name === 'job_applications');

  const handleApplication = async () => {
    setIsApplying(true);
    try {
      await onApplicationSubmit(job.id);
      toast.success('Application submitted successfully!', {
        description: 'Your application has been sent to the employer.'
      });
    } catch (error: any) {
      toast.error('Failed to submit application', {
        description: error.message
      });
    } finally {
      setIsApplying(false);
    }
  };

  const getUsageStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  const getUsageStatusIcon = (percentage: number) => {
    if (percentage >= 90) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    if (percentage >= 75) return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">{job.title}</CardTitle>
            <CardDescription className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{job.location}</span>
                </div>
                {job.salary && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    <span>{job.salary}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{job.posted_date}</span>
                </div>
              </div>
            </CardDescription>
          </div>
          <Badge variant="secondary">Featured</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Usage Status Display */}
        {applicationUsage && applicationUsage.limit_amount !== -1 && (
          <div className="bg-gray-50 dark:bg-gray-900/50 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getUsageStatusIcon(applicationUsage.usage_percentage)}
                <span className="font-medium text-sm">Application Usage</span>
              </div>
              <div className="text-right">
                <div className={`font-medium text-sm ${getUsageStatusColor(applicationUsage.usage_percentage)}`}>
                  {applicationUsage.current_usage} / {applicationUsage.limit_amount}
                </div>
                <div className="text-xs text-muted-foreground">
                  {applicationUsage.remaining_amount} remaining
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <Progress
                value={Math.min(100, applicationUsage.usage_percentage)}
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Monthly limit</span>
                <span>{Math.round(applicationUsage.usage_percentage)}% used</span>
              </div>
            </div>

            {/* Usage Warnings */}
            {applicationUsage.usage_percentage >= 80 && applicationUsage.can_use && (
              <div className="flex items-center gap-2 text-orange-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  You're close to your monthly limit. Consider{' '}
                  <button className="underline hover:no-underline">
                    purchasing additional credits
                  </button>
                  .
                </span>
              </div>
            )}

            {!applicationUsage.can_use && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  Monthly limit reached. Purchase credits or upgrade your plan to continue applying.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Job Description Preview */}
        <div className="space-y-3">
          <h4 className="font-medium">About this role</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We're looking for a talented professional to join our growing team.
            This role offers excellent opportunities for growth and the chance to work
            on exciting projects with cutting-edge technology.
          </p>
        </div>

        {/* Application Action - Wrapped with Usage Guard */}
        <UsageGuard
          featureName="job_applications"
          requiredCount={1}
          showInlineWarnings={false} // We're showing custom warnings above
          onUsageBlocked={() => {
            toast.error('Application limit reached', {
              description: 'Purchase additional credits or upgrade your plan to continue applying.'
            });
          }}
        >
          <div className="space-y-4">
            {/* Application Button */}
            <Button
              onClick={handleApplication}
              disabled={isApplying}
              className="w-full"
              size="lg"
            >
              {isApplying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting Application...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Apply Now with AI
                </>
              )}
            </Button>

            {/* Feature Benefits */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>AI-optimized resume</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Tailored cover letter</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Application tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Status updates</span>
              </div>
            </div>
          </div>
        </UsageGuard>

        {/* Upgrade Prompt for Free Users */}
        {usageOverview?.plan_name === 'free' && applicationUsage && applicationUsage.usage_percentage >= 60 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-purple-900 dark:text-purple-100">
                  Running low on applications?
                </h4>
                <p className="text-sm text-purple-700 dark:text-purple-200 mt-1">
                  Upgrade to Pro for unlimited applications and premium features
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-purple-300 text-purple-700">
                <CreditCard className="w-4 h-4 mr-2" />
                Upgrade
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UsageLimitedJobApplication;