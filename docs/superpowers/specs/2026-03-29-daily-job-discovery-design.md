# Daily Job Discovery System - Design Specification

**Date:** March 29, 2026
**Objective:** Deliver fresh job opportunities to users 4-6 hours faster than competitors through automated daily discovery
**Scale:** Enterprise-ready for 10,000+ users
**Business Goal:** Competitive advantage through speed and freshness

## Overview

The Daily Job Discovery System implements a **Distributed Crawl Orchestrator** that automatically discovers fresh job opportunities across multiple sources in strategic waves, prioritizing Pro subscribers and delivering results via daily digest emails.

## Business Requirements

### Primary Objective
- **Competitive speed advantage:** Surface jobs 4-6 hours faster than competing job boards
- **Pro subscriber value:** Premium users get first access to fresh opportunities
- **User experience:** Daily digest format prevents notification fatigue
- **Enterprise scale:** Support 10,000+ active users with robust infrastructure

### Success Metrics
- **Time to discovery:** Jobs appear in user feeds 4-6 hours before competitor sites
- **Pro user satisfaction:** Premium subscribers see opportunities 12+ hours before free users
- **Job freshness:** 80%+ of jobs in digests are less than 24 hours old
- **System reliability:** 95%+ wave completion rate, 99.9% digest delivery rate

## Architecture

### Core Components

1. **Master Scheduler** (`daily-job-orchestrator` edge function)
   - Orchestrates 4 daily crawl waves (6am, 12pm, 6pm, 12am UTC)
   - Manages Pro-first user queuing and load balancing
   - Tracks progress, handles failures, triggers retries

2. **Enhanced Crawling System** (extends existing `crawl-jobs`)
   - **Hybrid smart source targeting:** Career pages → major boards → niche sites
   - **Parallel processing:** Up to 5 concurrent crawl workers per wave
   - **Rate limit optimization:** Pro users get 75% of capacity in first 2 hours

3. **Deduplication Engine**
   - **Job fingerprinting:** Hash-based duplicate detection (title + company + location)
   - **Temporal filtering:** Only process jobs posted within 24 hours
   - **Cross-wave deduplication:** Prevent sending same job multiple times

4. **Match Processor**
   - **Real-time scoring:** Match jobs against user profiles during crawl
   - **Quality gates:** Only queue jobs with >70% match score
   - **Profile optimization:** Use user preferences and target roles for relevance

5. **Digest Builder** (extends existing notification system)
   - **Daily aggregation:** Collect fresh matches throughout day
   - **Personalized formatting:** Customize email content per user preferences
   - **Delivery scheduling:** Send at optimal time per user timezone

### Data Flow

```
Master Scheduler (6am/12pm/6pm/12am UTC)
    ↓
User Priority Queue (Pro users first)
    ↓
Source Router (Career pages → Job boards → Niche sites)
    ↓
Parallel Crawl Workers (5 concurrent, rate-limited)
    ↓
Job Deduplication (Hash fingerprinting)
    ↓
Profile Matching (>70% score threshold)
    ↓
Daily Digest Queue (Aggregate until 8am UTC)
    ↓
Email Delivery (Personalized digests)
```

## Technical Implementation

### Master Scheduler
- **New edge function:** `daily-job-orchestrator`
- **Cron triggers:** Supabase scheduled functions (4x daily)
- **User batching:** Process Pro users in first 2 hours of each wave
- **Parallel coordination:** Spawn multiple crawl workers within rate limits
- **Progress tracking:** Monitor completion, handle failures

### Enhanced Crawl System
- **Source hierarchy priority:**
  1. Company career pages (24-48 hour advantage)
  2. Major job boards (Indeed, LinkedIn, Glassdoor)
  3. Niche industry sites (gap filling)
- **Smart rate limiting:** 30 requests/minute for Pro tier, dynamic throttling
- **Failure isolation:** Skip problematic sources, continue with available ones

### Deduplication Strategy
- **Fingerprint algorithm:** SHA-256 hash of normalized (title + company + location)
- **Temporal windows:** 7-day duplicate prevention window
- **Cross-source matching:** Detect same job from multiple sources
- **Database optimization:** Indexed duplicate detection for performance

### User Matching
- **Profile scoring:** Weight skills, experience, location, remote preferences
- **Match thresholds:**
  - >90% - Priority delivery
  - 70-90% - Standard inclusion
  - <70% - Filtered out
- **Preference enforcement:** Respect user's target roles, locations, salary ranges

### Digest System
- **Collection period:** 24-hour window from previous digest
- **Email templates:** Extend existing job_alert template with fresh job emphasis
- **Personalization:** User name, match explanations, quick apply links
- **Delivery timing:** 8am UTC (optimal engagement time per analytics)

## Operations & Reliability

### Error Handling
- **Wave isolation:** Failed crawl wave doesn't block subsequent waves
- **Graceful degradation:** Continue with available sources if some fail
- **Retry mechanisms:** Up to 3 attempts with exponential backoff
- **Circuit breakers:** Auto-disable failing sources for 1 hour

### Monitoring & Alerting
- **Real-time dashboards:** Jobs discovered, users processed, digests sent
- **Quality metrics:** Duplicate rates, match scores, user engagement
- **Performance tracking:** Wave completion times, rate limit utilization
- **Alert thresholds:**
  - Wave failure rate >5%
  - Job discovery rate <100 jobs/hour
  - Digest delivery rate <99%

### Scalability Considerations
- **Database optimization:** Indexed job lookups, efficient duplicate checking
- **Queue management:** Separate Pro and free user processing queues
- **Load balancing:** Distribute crawl operations across multiple edge functions
- **Resource limits:** Respect Supabase function timeout and memory constraints

## Data Models

### New Tables
```sql
-- Daily crawl orchestration
daily_crawl_waves (
  id, wave_time, status, users_processed, jobs_discovered,
  completed_at, errors
)

-- Job deduplication tracking
job_fingerprints (
  fingerprint_hash, first_seen_at, last_seen_at, source_count
)

-- Fresh job queue for digest
daily_job_queue (
  user_id, job_id, match_score, queued_at, wave_id, sent_at
)
```

### Modified Tables
```sql
-- Enhance existing notifications
ALTER TABLE user_preferences
ADD COLUMN fresh_job_digest_time TIME DEFAULT '08:00';

-- Track crawl scheduling
ALTER TABLE profiles
ADD COLUMN last_crawl_wave TIMESTAMP,
ADD COLUMN crawl_priority INTEGER DEFAULT 1;
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Build Master Scheduler edge function
- Enhance crawl-jobs with source prioritization
- Implement job deduplication system
- Create user priority queue logic

### Phase 2: Matching & Digest (Week 2)
- Build real-time profile matching
- Extend notification system for daily digests
- Create personalized email templates
- Implement delivery scheduling

### Phase 3: Monitoring & Optimization (Week 3)
- Add comprehensive monitoring dashboard
- Implement error handling and circuit breakers
- Optimize database queries and indexing
- Load test with simulated user base

### Phase 4: Rollout & Scaling (Week 4)
- Gradual rollout to Pro users (100 → 1000 → all)
- Monitor performance and adjust parameters
- Fine-tune source prioritization based on results
- Full enterprise scaling validation

## Success Validation

### Competitive Advantage Metrics
- **Discovery speed:** Jobs appear in Hunter 4-6 hours before competitors
- **Unique opportunities:** 20%+ of digest jobs not found on major job boards
- **Pro user retention:** Increased engagement and subscription renewals

### Technical Performance
- **System reliability:** 99.9% digest delivery rate
- **Job quality:** 80%+ fresh jobs (<24h old) in each digest
- **User satisfaction:** Click-through rates on digest jobs
- **Scale validation:** Smooth performance at 10,000+ users

## Risk Mitigation

### Technical Risks
- **Rate limiting:** Implement dynamic throttling and spillover queues
- **Source reliability:** Circuit breakers and graceful degradation
- **Scale bottlenecks:** Load testing and performance optimization

### Business Risks
- **User fatigue:** Quality gates and personalization to ensure relevance
- **Competitive response:** Focus on source diversity and speed advantage
- **Resource costs:** Efficient crawling and smart batching to manage expenses

This design provides Hunter AI with a sustainable competitive advantage through faster job discovery while maintaining excellent user experience and enterprise-scale reliability.