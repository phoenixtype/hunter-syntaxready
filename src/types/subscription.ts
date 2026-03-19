// Types for the subscription and usage system

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  price_monthly: number;
  price_yearly: number;
  feature_limits: Record<string, number>; // -1 means unlimited
  overage_rates: Record<string, number>; // price per unit overage
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  subscription_plans?: SubscriptionPlan;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  feature_name: FeatureName;
  usage_count: number;
  period_start: string;
  period_end: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OveragePurchase {
  id: string;
  user_id: string;
  feature_name: FeatureName;
  quantity: number;
  unit_price: number;
  total_amount: number;
  stripe_payment_intent_id?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  expires_at?: string;
  used_count: number;
  created_at: string;
  updated_at: string;
}

export interface UsageAlert {
  id: string;
  user_id: string;
  feature_name: FeatureName;
  alert_threshold: number;
  alert_type: 'warning' | 'limit_reached' | 'overage';
  sent_at: string;
  acknowledged: boolean;
  created_at: string;
}

export type FeatureName =
  | 'job_applications'
  | 'resume_generations'
  | 'ai_interviews'
  | 'cover_letters'
  | 'job_matches'
  | 'company_research'
  | 'skill_assessments';

export interface FeatureUsageCheck {
  can_use: boolean;
  current_usage: number;
  limit_amount: number;
  remaining_amount: number;
  overage_needed: number;
  overage_cost: number;
  subscription_plan: string;
}

export interface FeatureUsageRequest {
  user_id: string;
  feature_name: FeatureName;
  requested_count?: number;
}

export interface UsageOverview {
  plan_name: string;
  plan_display_name: string;
  features: {
    feature_name: FeatureName;
    display_name: string;
    current_usage: number;
    limit_amount: number;
    remaining_amount: number;
    usage_percentage: number;
    overage_credits: number;
    can_use: boolean;
  }[];
  billing_period_start: string;
  billing_period_end: string;
}

export interface OverageQuote {
  feature_name: FeatureName;
  quantity: number;
  unit_price: number;
  total_cost: number;
  expires_at: string;
}

export const FEATURE_DISPLAY_NAMES: Record<FeatureName, string> = {
  'job_applications': 'Job Applications',
  'resume_generations': 'Resume Generations',
  'ai_interviews': 'AI Interview Practice',
  'cover_letters': 'Cover Letters',
  'job_matches': 'Job Matches',
  'company_research': 'Company Research',
  'skill_assessments': 'Skill Assessments',
};

export const FEATURE_DESCRIPTIONS: Record<FeatureName, string> = {
  'job_applications': 'Apply to jobs with AI-optimized applications',
  'resume_generations': 'Generate tailored resumes for different positions',
  'ai_interviews': 'Practice interviews with our AI coach',
  'cover_letters': 'Create personalized cover letters',
  'job_matches': 'Get AI-powered job recommendations',
  'company_research': 'Research companies and their culture',
  'skill_assessments': 'Take skill tests to showcase abilities',
};

export const SUBSCRIPTION_INTERVALS = {
  monthly: 'month',
  yearly: 'year',
} as const;

export type SubscriptionInterval = keyof typeof SUBSCRIPTION_INTERVALS;