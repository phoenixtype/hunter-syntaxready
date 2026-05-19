-- Clear all test/dummy job listings so the feed starts fresh
-- Real jobs will be crawled via Firecrawl based on user preferences
-- Also clear any application_history referencing these dummy jobs
DELETE FROM application_history WHERE job_id IN (SELECT id FROM job_listings);
DELETE FROM job_listings;
