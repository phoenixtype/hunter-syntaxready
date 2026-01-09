# Project Overview

## Application Identity
**Name**: Hunter
**Purpose**: AI-augmented job search and application platform.
**Philosophy**: "Automate the hunt." Empower candidates with AI tools to match, tailor, and apply to jobs efficiently.

## Core Architecture
- **Frontend**: React (Vite) + TypeScript.
- **UI Framework**: Tailwind CSS + Shadcn UI + Lucide Icons.
- **Backend / Database**: Supabase (PostgreSQL + Auth + Storage).
- **Compute**: Supabase Edge Functions (Deno Runtime).
- **AI Integration**: Perplexity (Intel), OpenAI (Resume/Cover Letter), Firecrawl (Job Scraping).

## Key Workflows
1.  **Job Crawling**: `crawler_engine.ts` triggers Edge Functions to fetch jobs from external sources.
2.  **Resume Parsing**: `resume_engine.ts` uses PDF.js + AI to extract structured data from resumes.
3.  **Job Matching**: Vector similarity search (or keyword matching) to score jobs against user profiles.
4.  **Application Tracking**: Kanban/List view of application status in `Dashboard`.

## Directory Structure
- `src/lib/*`: Core business logic and "Engines" (Resume, Crawler, Application).
- `src/components/ui/*`: Shadcn UI primitives.
- `src/pages/*`: Main route views.
- `supabase/functions/*`: Serverless backend logic.
- `.agent/memory/*`: Project rules and guidelines.
