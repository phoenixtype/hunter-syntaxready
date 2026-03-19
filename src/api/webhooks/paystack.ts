// Next.js API Route for handling Paystack webhooks
// This handles NGN payments and subscriptions for Nigerian users

import { NextApiRequest, NextApiResponse } from 'next';
import { handlePaystackWebhook, verifyPaystackWebhook } from '@/webhooks/paystack-webhooks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the Paystack signature
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing Paystack signature' });
    }

    // Get raw body (this assumes you have middleware to get raw body)
    const rawBody = JSON.stringify(req.body);

    // Verify the webhook signature
    const event = verifyPaystackWebhook(rawBody, signature);

    console.log(`📨 Received Paystack webhook: ${event.event} (${event.data.id})`);

    // Process the webhook
    await handlePaystackWebhook(event);

    console.log(`✅ Processed Paystack webhook: ${event.event} (${event.data.id})`);

    // Return success response
    res.status(200).json({ received: true, processed: true });

  } catch (error: any) {
    console.error('❌ Paystack webhook processing failed:', error);

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
 * Test webhook endpoint for Paystack (development only)
 * This should ONLY be used in development/testing
 */
export async function testPaystackWebhookEndpoint(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoint not available in production' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;

    console.log(`🧪 Test Paystack webhook received: ${event.event} (${event.data?.id || 'no-id'})`);

    // Process the webhook without signature verification
    await handlePaystackWebhook(event);

    console.log(`✅ Test Paystack webhook processed: ${event.event}`);

    res.status(200).json({
      received: true,
      processed: true,
      test: true
    });

  } catch (error: any) {
    console.error('❌ Test Paystack webhook processing failed:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      details: error.message
    });
  }
}