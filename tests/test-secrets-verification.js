// Verify that payment secrets are properly accessible
// This should be run on the server-side only

console.log('🔐 Payment Secrets Verification');
console.log('===============================\n');

// Check Paystack secrets
console.log('📊 Paystack Configuration:');
console.log(`Secret Key: ${process.env.PAYSTACK_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`Public Key: ${process.env.PAYSTACK_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);

if (process.env.PAYSTACK_SECRET_KEY) {
  const secretPreview = process.env.PAYSTACK_SECRET_KEY.substring(0, 7) + '...';
  console.log(`Secret Preview: ${secretPreview}`);
}

if (process.env.PAYSTACK_PUBLIC_KEY) {
  const publicPreview = process.env.PAYSTACK_PUBLIC_KEY.substring(0, 7) + '...';
  console.log(`Public Preview: ${publicPreview}`);
}

console.log('\n💳 Stripe Configuration:');
console.log(`Secret Key: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`Webhook Secret: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing'}`);

console.log('\n🌍 Environment Check:');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Supabase URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);

console.log('\n🚀 Ready for Production:');
const paystackReady = process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_PUBLIC_KEY;
const stripeReady = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET;

console.log(`Paystack: ${paystackReady ? '✅ Ready' : '❌ Not Ready'}`);
console.log(`Stripe: ${stripeReady ? '✅ Ready' : '❌ Not Ready'}`);
console.log(`Overall: ${paystackReady && stripeReady ? '✅ All payment systems ready!' : '❌ Missing configurations'}`);

console.log('\n===============================');