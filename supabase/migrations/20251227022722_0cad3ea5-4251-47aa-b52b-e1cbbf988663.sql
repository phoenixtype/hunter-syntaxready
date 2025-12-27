-- Create job_listings table for storing crawled jobs
CREATE TABLE public.job_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary_range TEXT,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'Firecrawl',
  freshness_score NUMERIC(3,2) DEFAULT 1.0,
  credibility_score NUMERIC(3,2) DEFAULT 0.8,
  url TEXT NOT NULL,
  posted_at TEXT,
  tech_stack TEXT[],
  job_hash TEXT NOT NULL UNIQUE, -- For deduplication: hash of company+title
  raw_data JSONB, -- Store original scraped data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

-- Jobs are publicly readable (anyone can see job listings)
CREATE POLICY "Job listings are publicly readable"
ON public.job_listings
FOR SELECT
USING (true);

-- Only authenticated users can insert (for admin/crawler operations)
CREATE POLICY "Authenticated users can insert job listings"
ON public.job_listings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster searches
CREATE INDEX idx_job_listings_company ON public.job_listings(company);
CREATE INDEX idx_job_listings_title ON public.job_listings(title);
CREATE INDEX idx_job_listings_source ON public.job_listings(source);
CREATE INDEX idx_job_listings_freshness ON public.job_listings(freshness_score DESC);
CREATE INDEX idx_job_listings_hash ON public.job_listings(job_hash);

-- Full text search index
CREATE INDEX idx_job_listings_search ON public.job_listings 
USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(description, '')));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_listings_updated_at
BEFORE UPDATE ON public.job_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();