import { vi, expect, describe, it } from 'vitest';

// vi.hoisted runs before any imports, satisfying the Deno.env.get() call at module load time
vi.hoisted(() => {
  (globalThis as any).Deno = {
    env: {
      get: (key: string) => {
        if (key === 'SITE_URL') return 'https://usehunter.app';
        return '';
      }
    }
  };
});

import {
  buildPaymentConfirmationEmail,
  buildJobAlertEmail,
  buildUsageWarningEmail
} from '../../supabase/functions/_shared/email-templates';

describe('Email Templates', () => {
  describe('Payment Confirmation Email', () => {
    it('should build payment confirmation email with correct branding', () => {
      const result = buildPaymentConfirmationEmail({
        tier: 'pro',
        amount: 19.99,
        currency: 'usd',
        paymentProvider: 'stripe',
        userName: 'John Doe'
      });

      expect(result.subject).toContain('Welcome to Hunter Pro');
      expect(result.html).toContain('#0d9488'); // Brand color
      expect(result.html).toContain('$19.99'); // Price
      expect(result.html).toContain('100 job applications'); // Feature
    });

    it('should build Paystack payment email with NGN currency', () => {
      const result = buildPaymentConfirmationEmail({
        tier: 'pro',
        amount: 4999,
        currency: 'ngn',
        paymentProvider: 'paystack',
        userName: 'John Doe'
      });

      expect(result.html).toContain('₦4,999'); // NGN formatting
      expect(result.html).toContain('paystack'); // Provider mention
    });

    it('should include Hunter logo and branding', () => {
      const result = buildPaymentConfirmationEmail({
        tier: 'pro',
        amount: 19.99,
        currency: 'usd',
        paymentProvider: 'stripe',
        userName: 'John Doe'
      });

      expect(result.html).toContain('Hunter');
      expect(result.html).toContain('#0d9488'); // Primary color
      expect(result.html).toContain('#10b981'); // Accent color
    });
  });

  describe('Job Alert Email', () => {
    it('should build job alert email with job cards', () => {
      const result = buildJobAlertEmail({
        userName: 'Jane Smith',
        jobs: [
          {
            title: 'Senior Software Engineer',
            company: 'TechCorp',
            location: 'San Francisco, CA',
            salary: '$120,000 - $160,000',
            url: 'https://example.com/job1'
          },
          {
            title: 'Full Stack Developer',
            company: 'StartupXYZ',
            location: 'Remote',
            url: 'https://example.com/job2'
          }
        ],
        totalMatches: 5
      });

      expect(result.subject).toContain('2 new job matches');
      expect(result.html).toContain('Senior Software Engineer');
      expect(result.html).toContain('TechCorp');
      expect(result.html).toContain('$120,000 - $160,000');
      expect(result.html).toContain('3 more matches');
    });
  });

  describe('Usage Warning Email', () => {
    it('should build usage warning email with progress bar', () => {
      const result = buildUsageWarningEmail({
        userName: 'Bob Johnson',
        featureName: 'job applications',
        usagePercent: 85,
        remaining: 15,
        limit: 100,
        resetDate: 'March 1, 2024'
      });

      expect(result.subject).toContain('job applications usage at 85%');
      expect(result.html).toContain('85%');
      expect(result.html).toContain('15 remaining');
      expect(result.html).toContain('March 1, 2024');
      expect(result.html).toContain('width:85%'); // Progress bar
    });

    it('should show upgrade CTA for high usage', () => {
      const result = buildUsageWarningEmail({
        userName: 'Alice Wilson',
        featureName: 'resume generations',
        usagePercent: 95,
        remaining: 3,
        limit: 50,
        resetDate: 'March 1, 2024'
      });

      expect(result.html).toContain('Action needed');
      expect(result.html).toContain('Upgrade plan');
      expect(result.html).toContain('#dc2626'); // Red color for high usage
    });
  });
});