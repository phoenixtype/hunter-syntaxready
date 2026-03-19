// Paystack integration for Nigerian payments
// Handles NGN transactions and subscription management

interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

interface PaystackCustomer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

interface PaystackPlan {
  name: string;
  amount: number; // In kobo (smallest NGN unit)
  interval: 'monthly' | 'annually';
  description?: string;
}

interface PaystackSubscription {
  customer: string;
  plan: string;
  authorization?: string;
}

interface PaystackInitializePayment {
  email: string;
  amount: number; // In kobo
  currency?: string;
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  plan?: string;
}

class PaystackClient {
  private config: PaystackConfig;

  constructor() {
    this.config = {
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      baseUrl: 'https://api.paystack.co'
    };
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${this.config.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Paystack API error: ${result.message || response.statusText}`);
    }

    return result;
  }

  // Customer management
  async createCustomer(customer: PaystackCustomer) {
    return this.makeRequest('/customer', 'POST', customer);
  }

  async getCustomer(customerCode: string) {
    return this.makeRequest(`/customer/${customerCode}`);
  }

  // Plan management
  async createPlan(plan: PaystackPlan) {
    return this.makeRequest('/plan', 'POST', plan);
  }

  async getPlan(planCode: string) {
    return this.makeRequest(`/plan/${planCode}`);
  }

  // Subscription management
  async createSubscription(subscription: PaystackSubscription) {
    return this.makeRequest('/subscription', 'POST', subscription);
  }

  async getSubscription(subscriptionCode: string) {
    return this.makeRequest(`/subscription/${subscriptionCode}`);
  }

  async disableSubscription(subscriptionCode: string, token: string) {
    return this.makeRequest('/subscription/disable', 'POST', {
      code: subscriptionCode,
      token
    });
  }

  // Payment initialization
  async initializePayment(payment: PaystackInitializePayment) {
    return this.makeRequest('/transaction/initialize', 'POST', payment);
  }

  async verifyPayment(reference: string) {
    return this.makeRequest(`/transaction/verify/${reference}`);
  }

  // Utility functions
  convertNairaToKobo(naira: number): number {
    return Math.round(naira * 100);
  }

  convertKoboToNaira(kobo: number): number {
    return kobo / 100;
  }

  generateReference(): string {
    return `hunter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Plan creation helpers
  async ensureSubscriptionPlans() {
    const plans = [
      {
        name: 'Hunter AI Pro Monthly (NGN)',
        amount: this.convertNairaToKobo(32000), // ₦32,000/month
        interval: 'monthly' as const,
        description: 'Monthly Pro subscription for serious job seekers in Nigeria'
      },
      {
        name: 'Hunter AI Pro Yearly (NGN)',
        amount: this.convertNairaToKobo(320000), // ₦320,000/year
        interval: 'annually' as const,
        description: 'Yearly Pro subscription for serious job seekers in Nigeria (2 months free)'
      },
      {
        name: 'Hunter AI Enterprise Monthly (NGN)',
        amount: this.convertNairaToKobo(160000), // ₦160,000/month
        interval: 'monthly' as const,
        description: 'Monthly Enterprise subscription for teams and organizations in Nigeria'
      },
      {
        name: 'Hunter AI Enterprise Yearly (NGN)',
        amount: this.convertNairaToKobo(1600000), // ₦1,600,000/year
        interval: 'annually' as const,
        description: 'Yearly Enterprise subscription for teams and organizations in Nigeria'
      }
    ];

    const results = [];
    for (const plan of plans) {
      try {
        const result = await this.createPlan(plan);
        results.push(result);
        console.log(`Created Paystack plan: ${plan.name} (${result.data.plan_code})`);
      } catch (error: any) {
        if (error.message.includes('Plan name already exists')) {
          console.log(`Plan already exists: ${plan.name}`);
        } else {
          console.error(`Failed to create plan ${plan.name}:`, error.message);
        }
      }
    }

    return results;
  }
}

// Export singleton instance
export const paystackClient = new PaystackClient();

// Payment provider detection
export function detectPaymentProvider(userLocation?: string, userCountry?: string): 'stripe' | 'paystack' {
  // Check for Nigerian users
  if (userCountry === 'NG' || userCountry === 'Nigeria') {
    return 'paystack';
  }

  if (userLocation?.toLowerCase().includes('nigeria') || userLocation?.toLowerCase().includes('lagos')) {
    return 'paystack';
  }

  // Default to Stripe for international users
  return 'stripe';
}

// Currency detection
export function detectCurrency(provider: 'stripe' | 'paystack'): 'usd' | 'ngn' {
  return provider === 'paystack' ? 'ngn' : 'usd';
}

// Price conversion utilities
export function formatPrice(amount: number, currency: 'usd' | 'ngn'): string {
  if (currency === 'ngn') {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toFixed(2)}`;
}

export function convertUsdToNgn(usdAmount: number, exchangeRate: number = 1600): number {
  return Math.round(usdAmount * exchangeRate);
}

export function convertNgnToUsd(ngnAmount: number, exchangeRate: number = 1600): number {
  return Number((ngnAmount / exchangeRate).toFixed(2));
}

// Feature-specific overage pricing
export const OVERAGE_RATES = {
  usd: {
    job_applications: 2.00,
    resume_generations: 5.00,
    ai_interviews: 10.00,
    cover_letters: 1.50,
    job_matches: 0.50,
    company_research: 1.00,
    skill_assessments: 15.00
  },
  ngn: {
    job_applications: 3200,      // $2.00 * 1600
    resume_generations: 8000,     // $5.00 * 1600
    ai_interviews: 16000,         // $10.00 * 1600
    cover_letters: 2400,          // $1.50 * 1600
    job_matches: 800,             // $0.50 * 1600
    company_research: 1600,       // $1.00 * 1600
    skill_assessments: 24000      // $15.00 * 1600
  }
};

export default PaystackClient;