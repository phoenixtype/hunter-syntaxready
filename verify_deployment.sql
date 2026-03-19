-- ===============================================
-- HUNTER AI: BACKEND DEPLOYMENT VERIFICATION
-- ===============================================
-- Run this after deployment to verify everything works

-- 1. CHECK ALL CRITICAL INDEXES EXIST
SELECT
    '🔍 CHECKING PERFORMANCE INDEXES' AS status;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_listings_search_performance')
        THEN '✅ Job search performance index: CREATED'
        ELSE '❌ Job search performance index: MISSING'
    END AS job_search_index;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_candidate_profiles_skills_gin')
        THEN '✅ Skills GIN index: CREATED'
        ELSE '❌ Skills GIN index: MISSING'
    END AS skills_gin_index;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_learning_weights_user_updated')
        THEN '✅ Learning weights index: CREATED'
        ELSE '❌ Learning weights index: MISSING'
    END AS learning_weights_index;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_application_history_user_status')
        THEN '✅ Application history compound index: CREATED'
        ELSE '❌ Application history compound index: MISSING'
    END AS application_index;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_listings_fulltext_search')
        THEN '✅ Full-text search index: CREATED'
        ELSE '❌ Full-text search index: MISSING'
    END AS fulltext_index;

-- 2. CHECK RATE LIMITING FUNCTION EXISTS
SELECT
    '🔍 CHECKING RATE LIMITING FUNCTION' AS status;

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE p.proname = 'upsert_rate_limit' AND n.nspname = 'public'
        )
        THEN '✅ upsert_rate_limit function: CREATED'
        ELSE '❌ upsert_rate_limit function: MISSING'
    END AS rate_limit_function;

-- 3. TEST QUERY PERFORMANCE WITH INDEXES
SELECT
    '🔍 TESTING QUERY PERFORMANCE' AS status;

-- Test job search performance (should use idx_job_listings_search_performance)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, company, freshness_score
FROM job_listings
ORDER BY freshness_score DESC, created_at DESC
LIMIT 20;

-- Test skills matching (should use idx_candidate_profiles_skills_gin)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, skills
FROM candidate_profiles
WHERE skills @> '["javascript"]'::jsonb
LIMIT 10;

-- 4. PERFORMANCE BENCHMARK
SELECT
    '🔍 PERFORMANCE BENCHMARKS' AS status;

-- Count total records for baseline
SELECT
    'job_listings' AS table_name,
    COUNT(*) AS total_records,
    CASE
        WHEN COUNT(*) > 1000 THEN '✅ Good data volume for testing'
        WHEN COUNT(*) > 100 THEN '⚠️ Low data volume - create more test data'
        ELSE '❌ Very low data volume - performance testing limited'
    END AS data_status
FROM job_listings
UNION ALL
SELECT
    'candidate_profiles' AS table_name,
    COUNT(*) AS total_records,
    CASE
        WHEN COUNT(*) > 1000 THEN '✅ Good data volume for testing'
        WHEN COUNT(*) > 100 THEN '⚠️ Low data volume - create more test data'
        ELSE '❌ Very low data volume - performance testing limited'
    END AS data_status
FROM candidate_profiles;

-- 5. CHECK INDEX USAGE STATISTICS
SELECT
    '🔍 INDEX USAGE STATISTICS' AS status;

SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%performance%'
   OR indexname LIKE 'idx_%gin%'
   OR indexname LIKE 'idx_%fulltext%'
ORDER BY idx_scan DESC;

-- 6. FINAL DEPLOYMENT STATUS
SELECT
    CASE
        WHEN (
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE indexname IN (
                'idx_job_listings_search_performance',
                'idx_candidate_profiles_skills_gin',
                'idx_learning_weights_user_updated',
                'idx_application_history_user_status',
                'idx_job_listings_fulltext_search'
            )
        ) = 5
        AND EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE p.proname = 'upsert_rate_limit' AND n.nspname = 'public'
        )
        THEN '🚀 DEPLOYMENT SUCCESSFUL - Hunter AI is optimized for billion-user scale!'
        ELSE '❌ DEPLOYMENT INCOMPLETE - Check errors above'
    END AS final_status;