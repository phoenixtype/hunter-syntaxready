import PQueue from 'p-queue';
import { supabaseWithLimits } from './supabase-with-limits';
import { getInvokeErrorMessage } from './invoke-error';

/**
 * Edge Function Queue System
 *
 * Manages Supabase Edge Function concurrency limits to prevent overwhelming the service.
 * Supabase Edge Functions have strict limits:
 * - Max 3 concurrent executions
 * - Rate limit of ~5 calls per second
 *
 * This queue system prevents cascade failures and provides reliable function execution.
 */

// Create specialized queues for different types of edge functions
const functionQueue = new PQueue({
  concurrency: 3, // Supabase Edge Function concurrency limit
  interval: 1000,
  intervalCap: 5   // Max 5 calls per second
});

// High priority queue for critical functions (auth, compliance)
const priorityQueue = new PQueue({
  concurrency: 2, // Reserve 2 slots for priority functions
  interval: 1000,
  intervalCap: 3
});

// Background processing queue for non-urgent functions
const backgroundQueue = new PQueue({
  concurrency: 1, // Single slot for background work
  interval: 1000,
  intervalCap: 2
});

export interface FunctionCallOptions {
  priority?: 'high' | 'normal' | 'low';
  timeout?: number;
  retries?: number;
}

/**
 * Queue a function call with automatic retry and error handling
 */
export const queuedFunctionCall = async <T = any>(
  functionName: string,
  payload: any,
  options: FunctionCallOptions = {}
): Promise<T> => {
  const { priority = 'normal', timeout = 30000, retries = 2 } = options;

  // Select appropriate queue based on priority
  const queue = priority === 'high' ? priorityQueue :
                priority === 'low' ? backgroundQueue :
                functionQueue;

  return queue.add(async () => {
    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const { data, error } = await supabaseWithLimits.functions.invoke(
          functionName,
          {
            body: payload,
            headers: {
              'x-request-priority': priority,
              'x-retry-attempt': attempt.toString()
            }
          }
        );

        if (error) {
          const msg = await getInvokeErrorMessage(error);
          throw new Error(msg || `Function ${functionName} failed: ${error.message}`);
        }

        return data as T;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(`[FunctionQueue] ${functionName} attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry on certain errors
        if (lastError.message.includes('401') ||
            lastError.message.includes('403') ||
            lastError.message.includes('400')) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (2 ** attempt), 5000)));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error(`Function ${functionName} failed after ${retries + 1} attempts`);
  }, { priority: priority === 'high' ? 10 : priority === 'low' ? 1 : 5 });
};

/**
 * Specialized function calls for common Hunter AI operations
 */

export const queueParseResume = async (payload: { resumeText: string; userId?: string }) => {
  return queuedFunctionCall('parse-resume', payload, { priority: 'high', timeout: 45000 });
};

export const queueJobCrawl = async (payload: any) => {
  return queuedFunctionCall('crawl-jobs', payload, { priority: 'normal', timeout: 60000 });
};

export const queueApplyToJob = async (payload: any) => {
  return queuedFunctionCall('apply-to-job', payload, { priority: 'high', timeout: 30000 });
};

export const queueGenerateResume = async (payload: any) => {
  return queuedFunctionCall('generate-resume', payload, { priority: 'normal', timeout: 30000 });
};

export const queueComplianceCheck = async (payload: any) => {
  return queuedFunctionCall('compliance-check', payload, { priority: 'high', timeout: 5000, retries: 1 });
};

export const queueEmailNotification = async (payload: any) => {
  return queuedFunctionCall('send-email', payload, { priority: 'low', timeout: 15000 });
};

/**
 * Queue monitoring and statistics
 */
export const getQueueStats = () => ({
  main: {
    size: functionQueue.size,
    pending: functionQueue.pending,
    isPaused: functionQueue.isPaused
  },
  priority: {
    size: priorityQueue.size,
    pending: priorityQueue.pending,
    isPaused: priorityQueue.isPaused
  },
  background: {
    size: backgroundQueue.size,
    pending: backgroundQueue.pending,
    isPaused: backgroundQueue.isPaused
  },
  total: {
    queued: functionQueue.size + priorityQueue.size + backgroundQueue.size,
    running: functionQueue.pending + priorityQueue.pending + backgroundQueue.pending
  }
});

/**
 * Emergency controls for queue management
 */
export const pauseAllQueues = () => {
  functionQueue.pause();
  priorityQueue.pause();
  backgroundQueue.pause();
};

export const resumeAllQueues = () => {
  functionQueue.start();
  priorityQueue.start();
  backgroundQueue.start();
};

export const clearAllQueues = () => {
  functionQueue.clear();
  priorityQueue.clear();
  backgroundQueue.clear();
};

/**
 * Wait for all queues to be empty (useful for testing)
 */
export const waitForAllQueues = async () => {
  await Promise.all([
    functionQueue.onIdle(),
    priorityQueue.onIdle(),
    backgroundQueue.onIdle()
  ]);
};

// Export the queues for direct access if needed
export { functionQueue, priorityQueue, backgroundQueue };