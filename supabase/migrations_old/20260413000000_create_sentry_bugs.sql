-- 1. Create a table to store bugs caught by Sentry via the webhook
CREATE TABLE IF NOT EXISTS public.sentry_bugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sentry_id TEXT NOT NULL UNIQUE,
    project_slug TEXT,
    issue_title TEXT NOT NULL,
    culprit TEXT,
    level TEXT,
    status TEXT,
    event_count INTEGER DEFAULT 1,
    url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Configure RLS
ALTER TABLE public.sentry_bugs ENABLE ROW LEVEL SECURITY;

-- 3. Only platform admins can view sentry bugs
CREATE POLICY "platform_admins_view_sentry_bugs" ON public.sentry_bugs
    FOR SELECT
    USING (public.is_platform_admin());

-- 4. Supabase edge function and anonymous backend agents can write
CREATE POLICY "anon_insert_sentry_bugs" ON public.sentry_bugs
    FOR ALL
    USING (true)
    WITH CHECK (true);
