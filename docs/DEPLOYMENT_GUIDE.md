# 🚀 Hunter AI - Deployment Guide

**Version**: 2.0.0
**Last Updated**: 2026-03-19
**Target**: Production Deployment

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Edge Functions Deployment](#edge-functions-deployment)
6. [Domain & SSL Configuration](#domain--ssl-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedures](#rollback-procedures)

---

## ✅ Prerequisites

### Required Accounts & Services

- **Vercel Account** (Pro plan recommended for production)
- **Supabase Account** (Pro plan for production)
- **GitHub Repository** (for CI/CD)
- **Stripe Account** (for international payments)
- **Paystack Account** (for Nigerian payments)
- **Domain Registration** (optional, for custom domain)

### Development Environment

```bash
# Node.js version
node --version  # v18.0.0 or higher

# npm version
npm --version   # v8.0.0 or higher

# Supabase CLI
npm install -g supabase
supabase --version  # v2.67.1 or higher

# Vercel CLI (optional)
npm install -g vercel
```

---

## 🌍 Environment Setup

### 1. Supabase Project Setup

**Create New Project:**
```bash
# Login to Supabase
supabase login

# Create new project (or use existing)
# Via dashboard: https://supabase.com/dashboard
# Select region closest to your users
# Choose Pro plan for production
```

**Project Configuration:**
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Configure database settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
SELECT pg_reload_conf();
```

### 2. Environment Variables

**Supabase Secrets (Server-side):**
```bash
# Set via Supabase CLI
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxx
supabase secrets set PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
supabase secrets set FIRECRAWL_API_KEY=fc_xxxxx
supabase secrets set AI_GATEWAY_API_KEY=xxxxx

# Verify secrets
supabase secrets list
```

**Vercel Environment Variables (Client-side):**
```bash
# Add via Vercel dashboard or CLI
vercel env add VITE_SUPABASE_URL production
# Enter: https://your-project-id.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Enter: your-anon-key

vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
# Enter: your-anon-key (same as above)

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Enter: your-service-role-key

vercel env add SUPABASE_URL production
# Enter: https://your-project-id.supabase.co
```

**Local Development (.env):**
```bash
# Copy example and fill in values
cp .env.example .env

# Edit .env file
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_URL="https://your-project-id.supabase.co"
```

---

## 🗄️ Database Setup

### 1. Run Migrations

```bash
# Apply all migrations to production
supabase db push

# Verify migration status
supabase migration list

# Check for any failed migrations
supabase db status
```

### 2. Seed Initial Data

```bash
# Create subscription plans
psql "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres" << EOF

-- Insert subscription plans
INSERT INTO subscription_plans (name, display_name, price_usd, price_ngn, price_usd_yearly, price_ngn_yearly, features, limits, overage_rates) VALUES
('free', 'Free Plan', 0, 0, 0, 0,
 '{"job_applications": true, "resume_builder": true, "ai_interviews": true}',
 '{"job_applications": 20, "resume_generations": 5, "ai_interviews": 3}',
 '{"job_applications": "2.00", "job_applications_ngn": "3200.00", "resume_generations": "5.00", "resume_generations_ngn": "8000.00"}'
),
('pro', 'Pro Plan', 19.99, 32000, 199.99, 320000,
 '{"job_applications": true, "resume_builder": true, "ai_interviews": true, "priority_support": true}',
 '{"job_applications": 200, "resume_generations": 50, "ai_interviews": 1000}',
 '{"job_applications": "1.50", "job_applications_ngn": "2400.00", "resume_generations": "3.75", "resume_generations_ngn": "6000.00"}'
),
('enterprise', 'Enterprise Plan', 99.99, 160000, 999.99, 1600000,
 '{"job_applications": true, "resume_builder": true, "ai_interviews": true, "priority_support": true, "api_access": true}',
 '{"job_applications": 10000, "resume_generations": 10000, "ai_interviews": 10000}',
 '{"job_applications": "1.00", "job_applications_ngn": "1600.00", "resume_generations": "2.50", "resume_generations_ngn": "4000.00"}'
);

EOF
```

### 3. Database Performance Tuning

```sql
-- Optimize for production workload
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Apply settings
SELECT pg_reload_conf();

-- Update table statistics
ANALYZE;
```

---

## 🚀 Application Deployment

### 1. Vercel Project Setup

**Via Dashboard:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import from GitHub repository
4. Configure build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

**Via CLI:**
```bash
# Login to Vercel
vercel login

# Deploy from project root
vercel --prod

# Follow prompts to configure project
```

### 2. Build Configuration

**vercel.json:**
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "functions": {
    "app/api/**/*.ts": {
      "runtime": "@vercel/node"
    }
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

### 3. Performance Optimizations

**Vite Configuration (vite.config.ts):**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Disable in production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    host: true
  }
})
```

---

## ⚡ Edge Functions Deployment

### 1. Deploy All Functions

```bash
# Deploy all edge functions
supabase functions deploy

# Or deploy individually
supabase functions deploy interview-coach
supabase functions deploy crawl-jobs
supabase functions deploy webhook-stripe
supabase functions deploy webhook-paystack
supabase functions deploy approve-recruiter
```

### 2. Verify Function Health

```bash
# Test each function
curl -X POST "https://your-project-id.supabase.co/functions/v1/interview-coach" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "test"}'

# Check function logs
supabase functions logs interview-coach --follow
```

### 3. Function Environment Variables

```bash
# Verify functions can access secrets
supabase functions invoke interview-coach --data '{"mode": "health_check"}'

# Response should show all secrets are accessible:
# {
#   "success": true,
#   "secrets_status": {
#     "ai_gateway": true,
#     "gemini": true,
#     "firecrawl": true
#   }
# }
```

---

## 🌐 Domain & SSL Configuration

### 1. Custom Domain Setup (Optional)

**Via Vercel Dashboard:**
1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `usehunter.app`)
3. Configure DNS records:

```bash
# DNS Configuration
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.19.61

# Or use Vercel nameservers for full management
```

### 2. SSL Certificate

Vercel automatically provisions SSL certificates via Let's Encrypt. Verify:

```bash
# Check SSL status
curl -I https://your-domain.com
# Should return: HTTP/2 200

# Test SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

---

## 📊 Monitoring Setup

### 1. Application Monitoring

**Vercel Analytics:**
```bash
# Enable via dashboard or add to package.json
npm install @vercel/analytics

# Add to main App component
import { Analytics } from '@vercel/analytics/react'

function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  )
}
```

**Custom Health Checks:**
```typescript
// Add to src/lib/health-check.ts
export const healthCheck = async () => {
  const checks = {
    database: await checkDatabase(),
    cache: checkCache(),
    external_apis: await checkExternalAPIs(),
    functions: await checkEdgeFunctions()
  };

  const allHealthy = Object.values(checks).every(check => check.healthy);

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  };
};
```

### 2. Database Monitoring

**Supabase Dashboard:**
- Monitor query performance
- Track connection usage
- Set up alerts for high error rates

**Custom Monitoring:**
```sql
-- Create monitoring views
CREATE VIEW system_health AS
SELECT
  'database' as component,
  CASE
    WHEN active_connections < 15 THEN 'healthy'
    WHEN active_connections < 18 THEN 'warning'
    ELSE 'critical'
  END as status,
  active_connections,
  cache_hit_ratio,
  NOW() as checked_at
FROM (
  SELECT
    COUNT(*) as active_connections,
    (SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100
     FROM pg_statio_user_tables) as cache_hit_ratio
  FROM pg_stat_activity
  WHERE state = 'active'
) stats;
```

---

## ✅ Post-Deployment Verification

### 1. Automated Testing

**Health Check Script:**
```bash
#!/bin/bash
# scripts/health-check.sh

BASE_URL="https://usehunter.app"
API_KEY="your-api-key"

echo "🏥 Running post-deployment health checks..."

# Test main application
echo "Testing main app..."
curl -f "$BASE_URL" || exit 1

# Test API endpoints
echo "Testing API endpoints..."
curl -f -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/jobs" || exit 1

# Test edge functions
echo "Testing edge functions..."
curl -f -X POST "$BASE_URL/functions/v1/interview-coach" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"mode": "test"}' || exit 1

# Test database connectivity
echo "Testing database..."
curl -f -H "Authorization: Bearer $API_KEY" "$BASE_URL/api/health" || exit 1

echo "✅ All health checks passed!"
```

### 2. Performance Verification

**Load Testing:**
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test configuration
cat > load-test.yml << EOF
config:
  target: https://usehunter.app
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 300
      arrivalRate: 50
      name: Load test
scenarios:
  - name: Job search
    weight: 70
    requests:
      - get:
          url: "/api/jobs?q=developer"
  - name: User profile
    weight: 30
    requests:
      - get:
          url: "/api/users/profile"
          headers:
            Authorization: "Bearer {{ token }}"
EOF

# Run load test
artillery run load-test.yml
```

### 3. Security Verification

**Security Checklist:**
```bash
# Test HTTPS enforcement
curl -I http://usehunter.app
# Should redirect to HTTPS

# Test security headers
curl -I https://usehunter.app
# Should include security headers:
# - Strict-Transport-Security
# - X-Content-Type-Options
# - X-Frame-Options
# - X-XSS-Protection

# Test CORS configuration
curl -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS https://usehunter.app/api/jobs
# Should return proper CORS headers

# Test rate limiting
for i in {1..100}; do
  curl -w "%{http_code}\n" -s -o /dev/null https://usehunter.app/api/jobs
done
# Should show 429 responses after rate limit exceeded
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Build Failures:**
```bash
# Clear caches
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check

# Verify environment variables
vercel env ls
```

**2. Database Connection Issues:**
```bash
# Test database connectivity
psql "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres" -c "SELECT 1;"

# Check connection pool usage
SELECT count(*) FROM pg_stat_activity;

# Restart if needed (via Supabase dashboard)
```

**3. Edge Function Errors:**
```bash
# Check function logs
supabase functions logs interview-coach --tail

# Test function locally
supabase functions serve --no-verify-jwt

# Re-deploy specific function
supabase functions deploy interview-coach
```

**4. Payment Webhook Issues:**
```bash
# Test webhook endpoints
curl -X POST "https://your-project-id.supabase.co/functions/v1/webhook-stripe" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check webhook delivery in Stripe/Paystack dashboards
# Verify webhook signatures
```

### Debug Commands

```bash
# Application logs
vercel logs

# Database performance
supabase db analyze

# Function performance
supabase functions logs --filter error

# Cache health
curl https://usehunter.app/api/cache/stats
```

---

## 🔄 Rollback Procedures

### 1. Application Rollback

**Via Vercel Dashboard:**
1. Go to Deployments tab
2. Find previous working deployment
3. Click "Promote to Production"

**Via CLI:**
```bash
# List recent deployments
vercel ls

# Rollback to specific deployment
vercel promote <deployment-url>
```

### 2. Database Rollback

**Migration Rollback:**
```bash
# Rollback last migration
supabase migration repair --status reverted <migration-id>

# Or manually rollback
psql "postgresql://..." << EOF
-- Rollback script here
DROP TABLE IF EXISTS new_table;
-- etc.
EOF
```

### 3. Function Rollback

```bash
# Re-deploy previous version
git checkout <previous-commit>
supabase functions deploy interview-coach

# Or manually fix and redeploy
supabase functions deploy interview-coach
```

### 4. Emergency Procedures

**Complete System Rollback:**
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "🚨 Starting emergency rollback..."

# 1. Rollback application
vercel promote $LAST_KNOWN_GOOD_DEPLOYMENT

# 2. Rollback database
supabase migration repair --status reverted $PROBLEMATIC_MIGRATION

# 3. Rollback functions
supabase functions deploy --no-verify-jwt

# 4. Verify health
./scripts/health-check.sh

echo "✅ Emergency rollback complete"
```

---

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Edge functions tested locally
- [ ] Security review completed
- [ ] Performance benchmarks met

### Deployment

- [ ] Database migrations applied
- [ ] Application deployed to Vercel
- [ ] Edge functions deployed
- [ ] Domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Monitoring enabled

### Post-Deployment

- [ ] Health checks passing
- [ ] Performance verification completed
- [ ] Security verification completed
- [ ] Load testing passed
- [ ] User acceptance testing
- [ ] Monitoring alerts configured

### Documentation

- [ ] Deployment notes updated
- [ ] Architecture documentation current
- [ ] API documentation updated
- [ ] Runbook updated with any new procedures

---

**🚀 Hunter AI is now ready for production deployment!**

This guide provides a comprehensive deployment process that ensures reliability, security, and performance for billion-user scale operations.