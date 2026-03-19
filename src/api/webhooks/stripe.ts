// Next.js API Route for handling Stripe webhooks
// This would typically be placed in pages/api/webhooks/stripe.ts or app/api/webhooks/stripe/route.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { handleStripeWebhook, verifyStripeWebhook } from '@/webhooks/stripe-webhooks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the raw body
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // Get raw body (this assumes you have middleware to get raw body)
    const rawBody = req.body;

    // Verify the webhook signature
    const event = verifyStripeWebhook(rawBody, signature);

    console.log(`📨 Received webhook: ${event.type} (${event.id})`);

    // Process the webhook
    await handleStripeWebhook(event);

    console.log(`✅ Processed webhook: ${event.type} (${event.id})`);

    // Return success response
    res.status(200).json({ received: true, processed: true });

  } catch (error: any) {
    console.error('❌ Webhook processing failed:', error);

    // Return error but don't expose details
    if (error.message?.includes('signature')) {
      res.status(400).json({ error: 'Invalid signature' });
    } else {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}

// Disable body parsing for webhooks
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

/**
 * Test webhook endpoint that accepts any webhook for testing
 * This should ONLY be used in development/testing
 */
export async function testWebhookEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoint not available in production' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;

    console.log(`🧪 Test webhook received: ${event.type} (${event.id || 'no-id'})`);

    // Process the webhook without signature verification
    await handleStripeWebhook(event);

    console.log(`✅ Test webhook processed: ${event.type}`);

    res.status(200).json({
      received: true,
      processed: true,
      test: true
    });

  } catch (error: any) {
    console.error('❌ Test webhook processing failed:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
}