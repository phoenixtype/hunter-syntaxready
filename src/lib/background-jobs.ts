/**
 * Background Job Processing System
 *
 * Handles heavy operations asynchronously to prevent blocking the main application.
 * Uses p-queue for immediate implementation, with Redis-backed BullMQ architecture
 * ready for production scaling.
 *
 * For billion-user scale production deployment, migrate to BullMQ + Redis:
 * - npm install bullmq
 * - Set up Redis cluster
 * - Replace PQueue with BullMQ workers
 */

import PQueue from 'p-queue';
import { generateResumeInWorker } from './pdf_export';
import { queueEmailNotification as queueEmailViaEdge } from './function-queue';
import { recordCompliantAction } from './compliance_engine';
import type { CandidateProfile } from './resume_engine';

// Background job queues with different priorities and concurrency limits
const pdfQueue = new PQueue({
  concurrency: 2, // Limit PDF generation to prevent memory issues
  interval: 1000,
  intervalCap: 3 // Max 3 PDF generations per second
});

const emailQueue = new PQueue({
  concurrency: 5, // Email operations can handle higher concurrency
  interval: 1000,
  intervalCap: 10 // Max 10 emails per second
});

const complianceQueue = new PQueue({
  concurrency: 3, // Compliance updates need good throughput
  interval: 1000,
  intervalCap: 20 // Max 20 compliance operations per second
});

const analyticsQueue = new PQueue({
  concurrency: 1, // Analytics are lowest priority
  interval: 2000,
  intervalCap: 5 // Max 5 analytics operations per 2 seconds
});

// Job types for type safety
export type JobType = 'pdf_generation' | 'email_notification' | 'compliance_update' | 'analytics_event';

export interface JobOptions {
  priority?: number; // Higher number = higher priority
  delay?: number; // Delay in milliseconds before execution
  retries?: number; // Number of retry attempts
}

// ─── PDF Generation Jobs ──────────────────────────────────────────────────────

export interface PDFGenerationJob {
  type: 'pdf';
  userId: string;
  profile: CandidateProfile;
  filename?: string;
  options?: {
    onePage?: boolean;
    template?: string;
  };
}

export const queuePDFGeneration = async (
  job: PDFGenerationJob,
  options: JobOptions = {}
): Promise<string> => {
  const { priority = 5, delay = 0, retries = 2 } = options;

  return new Promise((resolve, reject) => {
    const jobId = `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const executeJob = async () => {
      let attempt = 0;
      while (attempt <= retries) {
        try {
          console.log(`[BackgroundJobs] Starting PDF generation for user ${job.userId}`);

          const result = await generateResumeInWorker(
            job.profile,
            job.filename,
            job.options
          );

          console.log(`[BackgroundJobs] PDF generated successfully: ${result.filename}`);

          // Log compliance action for rate limiting
          await recordCompliantAction('APPLY', job.userId);

          resolve(jobId);
          return;

        } catch (error) {
          attempt++;
          console.error(`[BackgroundJobs] PDF generation attempt ${attempt} failed:`, error);

          if (attempt > retries) {
            reject(new Error(`PDF generation failed after ${retries + 1} attempts: ${error}`));
            return;
          }

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (2 ** attempt), 10000)));
        }
      }
    };

    if (delay > 0) {
      setTimeout(() => {
        pdfQueue.add(executeJob, { priority });
      }, delay);
    } else {
      pdfQueue.add(executeJob, { priority });
    }
  });
};

// ─── Email Notification Jobs ──────────────────────────────────────────────────

export interface EmailNotificationJob {
  type: 'email';
  userId: string;
  template: string;
  recipient: string;
  data: Record<string, any>;
}

export const queueEmailNotification = async (
  job: EmailNotificationJob,
  options: JobOptions = {}
): Promise<string> => {
  const { priority = 5, delay = 0, retries: _retries = 3 } = options;

  return new Promise((resolve, reject) => {
    const jobId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const executeJob = async () => {
      let attempt = 0;
      while (attempt <= retries) {
        try {
          console.log(`[BackgroundJobs] Sending email to ${job.recipient}`);

          // Use the edge function queue for email sending
          await queueEmailNotification({
            template: job.template,
            recipient: job.recipient,
            data: job.data,
            userId: job.userId
          });

          console.log(`[BackgroundJobs] Email sent successfully to ${job.recipient}`);
          resolve(jobId);
          return;

        } catch (error) {
          attempt++;
          console.error(`[BackgroundJobs] Email attempt ${attempt} failed:`, error);

          if (attempt > retries) {
            reject(new Error(`Email failed after ${retries + 1} attempts: ${error}`));
            return;
          }

          await new Promise(resolve => setTimeout(resolve, Math.min(2000 * (2 ** attempt), 15000)));
        }
      }
    };

    if (delay > 0) {
      setTimeout(() => {
        emailQueue.add(executeJob, { priority });
      }, delay);
    } else {
      emailQueue.add(executeJob, { priority });
    }
  });
};

// ─── Compliance Update Jobs ────────────────────────────────────────────────────

export interface ComplianceUpdateJob {
  type: 'compliance';
  userId: string;
  action: 'APPLY' | 'SCRAPE';
  metadata?: Record<string, any>;
}

export const queueComplianceUpdate = async (
  job: ComplianceUpdateJob,
  options: JobOptions = {}
): Promise<string> => {
  const { priority = 8, delay = 0, retries = 1 } = options; // High priority, low retry

  return new Promise((resolve, reject) => {
    const jobId = `compliance_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const executeJob = async () => {
      try {
        console.log(`[BackgroundJobs] Recording compliance action ${job.action} for user ${job.userId}`);

        await recordCompliantAction(job.action, job.userId);

        console.log(`[BackgroundJobs] Compliance action recorded successfully`);
        resolve(jobId);

      } catch (error) {
        console.error(`[BackgroundJobs] Compliance update failed:`, error);
        // For compliance, we don't retry as it might indicate a rate limit issue
        reject(new Error(`Compliance update failed: ${error}`));
      }
    };

    if (delay > 0) {
      setTimeout(() => {
        complianceQueue.add(executeJob, { priority });
      }, delay);
    } else {
      complianceQueue.add(executeJob, { priority });
    }
  });
};

// ─── Analytics Event Jobs ──────────────────────────────────────────────────────

export interface AnalyticsEventJob {
  type: 'analytics';
  userId: string;
  event: string;
  properties: Record<string, any>;
  timestamp?: number;
}

export const queueAnalyticsEvent = async (
  job: AnalyticsEventJob,
  options: JobOptions = {}
): Promise<string> => {
  const { priority = 1, delay = 0, retries = 0 } = options; // Lowest priority, no retries

  return new Promise((resolve) => {
    const jobId = `analytics_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const executeJob = async () => {
      try {
        console.log(`[BackgroundJobs] Recording analytics event ${job.event} for user ${job.userId}`);

        // In a real implementation, this would send to your analytics service
        // For now, we'll just log it
        const eventData = {
          user_id: job.userId,
          event: job.event,
          properties: job.properties,
          timestamp: job.timestamp || Date.now()
        };

        // Store analytics events (could be sent to Mixpanel, Amplitude, etc.)
        localStorage.setItem(
          `analytics_${jobId}`,
          JSON.stringify(eventData)
        );

        console.log(`[BackgroundJobs] Analytics event recorded: ${job.event}`);
        resolve(jobId);

      } catch (error) {
        console.error(`[BackgroundJobs] Analytics event failed (non-critical):`, error);
        // Analytics failures are non-critical, always resolve
        resolve(jobId);
      }
    };

    if (delay > 0) {
      setTimeout(() => {
        analyticsQueue.add(executeJob, { priority });
      }, delay);
    } else {
      analyticsQueue.add(executeJob, { priority });
    }
  });
};

// ─── Queue Management & Monitoring ─────────────────────────────────────────────

export const getQueueStats = () => ({
  pdf: {
    size: pdfQueue.size,
    pending: pdfQueue.pending,
    isPaused: pdfQueue.isPaused
  },
  email: {
    size: emailQueue.size,
    pending: emailQueue.pending,
    isPaused: emailQueue.isPaused
  },
  compliance: {
    size: complianceQueue.size,
    pending: complianceQueue.pending,
    isPaused: complianceQueue.isPaused
  },
  analytics: {
    size: analyticsQueue.size,
    pending: analyticsQueue.pending,
    isPaused: analyticsQueue.isPaused
  },
  total: {
    queued: pdfQueue.size + emailQueue.size + complianceQueue.size + analyticsQueue.size,
    running: pdfQueue.pending + emailQueue.pending + complianceQueue.pending + analyticsQueue.pending
  }
});

export const pauseAllBackgroundJobs = () => {
  pdfQueue.pause();
  emailQueue.pause();
  complianceQueue.pause();
  analyticsQueue.pause();
  console.log('[BackgroundJobs] All queues paused');
};

export const resumeAllBackgroundJobs = () => {
  pdfQueue.start();
  emailQueue.start();
  complianceQueue.start();
  analyticsQueue.start();
  console.log('[BackgroundJobs] All queues resumed');
};

export const clearAllBackgroundJobs = () => {
  pdfQueue.clear();
  emailQueue.clear();
  complianceQueue.clear();
  analyticsQueue.clear();
  console.log('[BackgroundJobs] All queues cleared');
};

export const waitForAllBackgroundJobs = async () => {
  await Promise.all([
    pdfQueue.onIdle(),
    emailQueue.onIdle(),
    complianceQueue.onIdle(),
    analyticsQueue.onIdle()
  ]);
  console.log('[BackgroundJobs] All queues idle');
};

// ─── Production Migration Notes ────────────────────────────────────────────────

/**
 * PRODUCTION SCALING NOTES:
 *
 * For billion-user scale, migrate to BullMQ + Redis:
 *
 * 1. Install BullMQ:
 *    npm install bullmq ioredis
 *
 * 2. Set up Redis cluster for job persistence and distribution
 *
 * 3. Replace PQueue with BullMQ workers:
 *    import { Queue, Worker } from 'bullmq';
 *
 * 4. Benefits of BullMQ:
 *    - Job persistence (survives server restarts)
 *    - Distributed processing across multiple servers
 *    - Advanced scheduling (cron jobs, delayed jobs)
 *    - Job progress tracking and monitoring
 *    - Automatic retry with exponential backoff
 *    - Rate limiting per queue
 *    - Job prioritization
 *    - Dead letter queues for failed jobs
 *
 * 5. Example BullMQ setup:
 *    const pdfQueue = new Queue('pdf-generation', { connection: redisConnection });
 *    const pdfWorker = new Worker('pdf-generation', async (job) => {
 *      return await generateResumeInWorker(job.data.profile);
 *    }, { connection: redisConnection });
 *
 * This current implementation provides the foundation and can be easily
 * migrated to BullMQ when ready for production scale.
 */