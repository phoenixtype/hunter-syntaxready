# 🚀 Hunter AI - API Documentation

**Version**: 2.0.0
**Base URL**: `https://usehunter.app/api`
**Last Updated**: 2026-03-19

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Handling](#error-handling)
4. [Core APIs](#core-apis)
5. [Edge Functions](#edge-functions)
6. [Webhook APIs](#webhook-apis)
7. [Real-time APIs](#real-time-apis)
8. [Mobile APIs](#mobile-apis)
9. [Admin APIs](#admin-apis)
10. [SDK Usage](#sdk-usage)

---

## 🔐 Authentication

### Authentication Methods

**JWT Bearer Tokens:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Use in headers
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

**API Key Authentication (Public endpoints):**
```javascript
const headers = {
  'apikey': process.env.SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
};
```

### User Types & Permissions

| User Type | Permissions | Access Level |
|-----------|-------------|--------------|
| **Candidate** | Profile, Jobs, Applications | Read/Write own data |
| **Recruiter** | Jobs, Candidates, Analytics | Company-scoped data |
| **Admin** | All resources | Full system access |
| **Public** | Job listings (read-only) | Limited public data |

---

## ⚡ Rate Limiting

### Rate Limit Headers

All API responses include rate limiting headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 3600
```

### Rate Limits by Plan

| Plan | API Calls/Hour | Special Endpoints |
|------|----------------|-------------------|
| **Free** | 100 | Interview Coach: 20/hour |
| **Pro** | 500 | Interview Coach: 60/hour |
| **Enterprise** | 2000 | Custom limits available |

### Rate Limit Exceeded

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "code": 429,
  "retryAfter": 60
}
```

---

## 🛠️ Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "timestamp": "2026-03-19T18:30:00Z",
  "requestId": "req_abc123"
}
```

### HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| `200` | OK | Successful GET, PUT, PATCH |
| `201` | Created | Successful POST |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Invalid request data |
| `401` | Unauthorized | Missing/invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource already exists |
| `422` | Unprocessable Entity | Validation errors |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

### Error Codes

```typescript
enum ErrorCode {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Business Logic
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',

  // System
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

---

## 📦 Core APIs

### Jobs API

#### Search Jobs

```http
GET /api/jobs
```

**Query Parameters:**
```typescript
interface JobSearchParams {
  q?: string;           // Search query
  location?: string;    // Location filter
  company?: string;     // Company filter
  salary_min?: number;  // Minimum salary
  salary_max?: number;  // Maximum salary
  job_type?: 'full-time' | 'part-time' | 'contract' | 'internship';
  experience_level?: 'entry' | 'mid' | 'senior' | 'executive';
  remote?: boolean;     // Remote jobs only
  page?: number;        // Page number (default: 1)
  limit?: number;       // Results per page (default: 20, max: 100)
  sort?: 'relevance' | 'date' | 'salary';
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "job_abc123",
        "title": "Senior React Developer",
        "company": "TechCorp Inc.",
        "location": "San Francisco, CA",
        "salary_min": 120000,
        "salary_max": 180000,
        "job_type": "full-time",
        "experience_level": "senior",
        "remote": true,
        "description": "We're looking for...",
        "tech_stack": ["React", "TypeScript", "Node.js"],
        "posted_date": "2026-03-19T10:00:00Z",
        "freshness_score": 0.95,
        "match_score": 0.87
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    },
    "filters": {
      "applied": ["remote"],
      "available": ["location", "company", "salary", "experience"]
    }
  },
  "cached": true,
  "cache_ttl": 1800
}
```

#### Get Job Details

```http
GET /api/jobs/{job_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job_abc123",
    "title": "Senior React Developer",
    "company": "TechCorp Inc.",
    "company_info": {
      "id": "company_xyz",
      "name": "TechCorp Inc.",
      "logo": "https://...",
      "size": "201-500",
      "industry": "Technology"
    },
    "description": "Full job description...",
    "requirements": ["5+ years React", "TypeScript", "Leadership"],
    "benefits": ["Health insurance", "401k", "Remote work"],
    "application_process": {
      "method": "external",
      "apply_url": "https://techcorp.com/jobs/123",
      "contact_email": "hiring@techcorp.com"
    },
    "salary": {
      "min": 120000,
      "max": 180000,
      "currency": "USD",
      "equity": true
    },
    "location": {
      "city": "San Francisco",
      "state": "CA",
      "country": "US",
      "remote": true,
      "hybrid": false
    },
    "posted_date": "2026-03-19T10:00:00Z",
    "updated_date": "2026-03-19T15:30:00Z",
    "expires_date": "2026-04-19T10:00:00Z",
    "application_count": 47,
    "view_count": 1250
  }
}
```

### Users API

#### Get User Profile

```http
GET /api/users/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "john@example.com",
    "user_type": "candidate",
    "profile": {
      "name": "John Doe",
      "title": "Senior React Developer",
      "location": "San Francisco, CA",
      "bio": "Passionate full-stack developer...",
      "avatar_url": "https://...",
      "skills": [
        { "name": "React", "level": "expert", "years": 5 },
        { "name": "TypeScript", "level": "advanced", "years": 3 }
      ],
      "experience": [
        {
          "company": "Previous Corp",
          "role": "React Developer",
          "duration": "2022-2025",
          "description": "Built scalable web applications..."
        }
      ],
      "education": [
        {
          "institution": "University of Technology",
          "degree": "BS Computer Science",
          "year": "2020"
        }
      ],
      "preferences": {
        "target_roles": ["React Developer", "Frontend Engineer"],
        "locations": ["San Francisco", "Remote"],
        "salary_min": 100000,
        "remote_policy": "remote_only"
      }
    },
    "created_at": "2025-01-15T10:00:00Z",
    "last_active": "2026-03-19T18:25:00Z"
  }
}
```

#### Update User Profile

```http
PUT /api/users/profile
```

**Request Body:**
```json
{
  "profile": {
    "name": "John Doe",
    "title": "Senior React Developer",
    "bio": "Updated bio...",
    "skills": [
      { "name": "React", "level": "expert", "years": 5 }
    ],
    "preferences": {
      "target_roles": ["React Developer"],
      "locations": ["Remote"],
      "salary_min": 120000
    }
  }
}
```

### Applications API

#### Submit Application

```http
POST /api/applications
```

**Request Body:**
```json
{
  "job_id": "job_abc123",
  "cover_letter": "I am excited to apply...",
  "resume_url": "https://storage.supabase.co/...",
  "custom_fields": {
    "portfolio_url": "https://johndoe.dev",
    "availability": "2 weeks"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "application_id": "app_xyz789",
    "job_id": "job_abc123",
    "status": "submitted",
    "submitted_at": "2026-03-19T18:30:00Z",
    "tracking_url": "https://usehunter.app/applications/app_xyz789"
  }
}
```

#### Get Application History

```http
GET /api/applications/history
```

**Query Parameters:**
- `status`: Filter by status (`submitted`, `reviewed`, `interview`, `offered`, `rejected`)
- `page`: Page number
- `limit`: Results per page

### Subscriptions API

#### Get Subscription Status

```http
GET /api/users/subscription
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "tier": "pro",
      "status": "active",
      "current_period_start": "2026-03-01T00:00:00Z",
      "current_period_end": "2026-04-01T00:00:00Z",
      "payment_provider": "stripe",
      "cancel_at_period_end": false
    },
    "usage": {
      "job_applications": { "used": 15, "limit": 200 },
      "resume_generations": { "used": 8, "limit": 50 },
      "ai_interviews": { "used": 12, "limit": 1000 }
    },
    "overage_available": true,
    "next_billing_date": "2026-04-01T00:00:00Z"
  }
}
```

#### Purchase Overage

```http
POST /api/users/overage
```

**Request Body:**
```json
{
  "feature": "job_applications",
  "quantity": 10,
  "payment_method": "pm_abc123"
}
```

---

## 🔗 Edge Functions

### Interview Coach

```http
POST /functions/v1/interview-coach
```

**Request Body:**
```json
{
  "mode": "behavioral", // "behavioral" | "technical" | "negotiation"
  "messages": [
    {
      "role": "user",
      "content": "Tell me about a time you led a team through a difficult project."
    }
  ],
  "job": {
    "title": "Senior React Developer",
    "company": "TechCorp",
    "description": "...",
    "communityQuestions": [
      "How do you handle state management in large React apps?"
    ]
  },
  "profile": {
    "name": "John Doe",
    "experience_atoms": [
      {
        "role": "React Developer",
        "company": "Previous Corp"
      }
    ],
    "skills": [
      { "name": "React", "level": "expert" }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Great question! Let me ask you about a specific leadership challenge...",
  "mode": "behavioral",
  "feedback": "[Good structure - now add specific metrics to make this answer stronger]"
}
```

### Job Crawler

```http
POST /functions/v1/crawl-jobs
```

**Request Body:**
```json
{
  "company": "TechCorp",
  "keywords": ["React", "TypeScript"],
  "locations": ["San Francisco", "Remote"],
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "crawled": 25,
  "inserted": 18,
  "updated": 5,
  "skipped": 2,
  "jobs": [
    {
      "title": "React Developer",
      "company": "TechCorp",
      "source_url": "https://techcorp.com/careers/123"
    }
  ],
  "next_crawl_time": "2026-03-20T10:00:00Z"
}
```

### Company Research

```http
POST /functions/v1/interview-coach
Content-Type: application/json

{
  "mode": "research_questions",
  "job": {
    "title": "Product Manager",
    "company": "Stripe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "questions": [
    "Walk me through how you would prioritize features for a payments API",
    "How would you handle a situation where a major integration partner is unhappy?"
  ],
  "patterns": [
    "Stripe emphasizes systems thinking and customer obsession",
    "They often ask about handling ambiguity and cross-functional collaboration"
  ],
  "insights": "Stripe interviews focus heavily on product sense and technical depth. Candidates report rigorous case studies and system design questions.",
  "sources": [
    "https://reddit.com/r/ProductManagement/stripe_interview_experience",
    "https://glassdoor.com/stripe-product-manager-interview"
  ]
}
```

---

## 🪝 Webhook APIs

### Stripe Webhooks

```http
POST /functions/v1/webhook-stripe
```

**Supported Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Webhook Payload:**
```json
{
  "id": "evt_abc123",
  "object": "event",
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_abc123",
      "customer": "cus_xyz789",
      "status": "active",
      "current_period_start": 1640995200,
      "current_period_end": 1643673600
    }
  }
}
```

### Paystack Webhooks

```http
POST /functions/v1/webhook-paystack
```

**Supported Events:**
- `subscription.create`
- `subscription.disable`
- `invoice.create`
- `invoice.payment_success`
- `invoice.payment_failed`

---

## 📡 Real-time APIs

### WebSocket Subscriptions

**Job Matches Channel:**
```javascript
const subscription = supabase
  .channel(`user:${userId}:job_matches`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'job_matches',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('New job match!', payload.new);
  })
  .subscribe();
```

**Application Updates:**
```javascript
const subscription = supabase
  .channel(`application:${applicationId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'job_applications',
    filter: `id=eq.${applicationId}`
  }, (payload) => {
    console.log('Application status changed:', payload.new.status);
  })
  .subscribe();
```

**Subscription Events:**
```javascript
const subscription = supabase
  .channel(`subscription:${userId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'subscriptions',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('Subscription updated:', payload.new);
  })
  .subscribe();
```

---

## 📱 Mobile APIs

### Upload Resume (Mobile)

```http
POST /api/users/resume/upload
Content-Type: multipart/form-data
```

**Request:**
```javascript
const formData = new FormData();
formData.append('resume', fileBlob, 'resume.pdf');
formData.append('filename', 'john_doe_resume.pdf');

fetch('/api/users/resume/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "file_abc123",
    "filename": "john_doe_resume.pdf",
    "url": "https://storage.supabase.co/object/resumes/john_doe_resume.pdf",
    "size": 245760,
    "mime_type": "application/pdf",
    "uploaded_at": "2026-03-19T18:30:00Z"
  }
}
```

### Push Notifications

```http
POST /api/notifications/register
```

**Request Body:**
```json
{
  "device_token": "fcm_token_abc123",
  "platform": "ios", // "ios" | "android"
  "preferences": {
    "job_matches": true,
    "application_updates": true,
    "interview_reminders": true,
    "weekly_digest": false
  }
}
```

---

## 👑 Admin APIs

### User Management

```http
GET /api/admin/users
```

**Query Parameters:**
- `user_type`: Filter by type (`candidate`, `recruiter`)
- `subscription_tier`: Filter by subscription
- `status`: Filter by account status
- `search`: Search by name or email

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123",
        "email": "john@example.com",
        "user_type": "candidate",
        "subscription_tier": "pro",
        "status": "active",
        "created_at": "2025-01-15T10:00:00Z",
        "last_active": "2026-03-19T18:25:00Z",
        "total_applications": 45,
        "total_spent": 599.88
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10247
    }
  }
}
```

### Analytics

```http
GET /api/admin/analytics/overview
```

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "total_users": 10247,
      "active_users_24h": 1250,
      "total_jobs": 45892,
      "total_applications": 125680,
      "conversion_rate": 0.034
    },
    "revenue": {
      "mrr": 45670.50,
      "arr": 548046.00,
      "churn_rate": 0.028
    },
    "growth": {
      "user_growth_30d": 0.15,
      "revenue_growth_30d": 0.22
    }
  }
}
```

---

## 📚 SDK Usage

### JavaScript/TypeScript SDK

```bash
npm install @hunter-ai/sdk
```

```typescript
import { HunterAPI } from '@hunter-ai/sdk';

const hunter = new HunterAPI({
  apiKey: process.env.HUNTER_API_KEY,
  baseURL: 'https://usehunter.app/api'
});

// Search jobs
const jobs = await hunter.jobs.search({
  q: 'React developer',
  location: 'San Francisco',
  remote: true
});

// Get user profile
const profile = await hunter.users.getProfile();

// Submit application
const application = await hunter.applications.create({
  jobId: 'job_abc123',
  coverLetter: 'I am excited...'
});
```

### Python SDK

```bash
pip install hunter-ai-sdk
```

```python
from hunter_ai import HunterAPI

hunter = HunterAPI(api_key=os.environ['HUNTER_API_KEY'])

# Search jobs
jobs = hunter.jobs.search(
    q='Python developer',
    location='Remote',
    salary_min=100000
)

# Get subscription status
subscription = hunter.users.get_subscription()
```

### React Hooks

```typescript
import { useJobs, useProfile, useSubscription } from '@hunter-ai/react';

function JobSearch() {
  const { jobs, loading, error } = useJobs({
    query: 'React developer',
    location: 'Remote'
  });

  const { profile } = useProfile();
  const { subscription, usage } = useSubscription();

  if (loading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <div>
      {jobs.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
```

---

## 🔧 Development Tools

### API Testing

**Postman Collection:** [Download](./postman_collection.json)

**cURL Examples:**
```bash
# Search jobs
curl -X GET "https://usehunter.app/api/jobs?q=react&remote=true" \
  -H "Authorization: Bearer your_token_here"

# Submit application
curl -X POST "https://usehunter.app/api/applications" \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123", "cover_letter": "..."}'
```

### Rate Limit Testing

```javascript
// Test rate limits
async function testRateLimit() {
  const promises = [];
  for (let i = 0; i < 70; i++) {
    promises.push(
      fetch('/api/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    );
  }

  const responses = await Promise.all(promises);
  const rateLimited = responses.filter(r => r.status === 429);
  console.log(`${rateLimited.length} requests were rate limited`);
}
```

---

## 📞 Support

**API Support:**
- **Documentation**: [https://usehunter.app/docs](https://usehunter.app/docs)
- **Status Page**: [https://status.usehunter.app](https://status.usehunter.app)
- **Discord**: [Hunter AI Developer Community](https://discord.gg/hunter-ai)

**Contact:**
- **Technical Issues**: [api-support@usehunter.app](mailto:api-support@usehunter.app)
- **Business Inquiries**: [partnerships@usehunter.app](mailto:partnerships@usehunter.app)

---

*This API documentation is automatically updated with each release. Last generated: 2026-03-19*