import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { searchJobs, triggerJobCrawl, getJobCount, JobOpportunity, CrawlParams } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { calculateMatch, MatchResult, getMatchedJobsServerSide } from "@/lib/matching_engine";
import { getOptimizedWeights } from "@/lib/learning_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { searchJobsCached, getTrendingJobsCached, getJobMatchesCached } from "@/lib/cached-job-engine";
import { checkFeatureLimit, recordUsage } from "@/lib/redis-rate-limiter";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

export interface EnrichedJob extends JobOpportunity {
    match?: MatchResult;
}

const PAGE_SIZE = 20;

export const useJobs = (profile: CandidateProfile | null, preferences?: UserPreferences | null, searchQuery?: string, locationQuery?: string) => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const { user } = useAuth();
    const { subscription } = useSubscription();

    // 1. Fetch Job Count with caching
    const { data: jobCount = 0 } = useQuery({
        queryKey: ['jobCount'],
        queryFn: getJobCount,
        staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    });

    // 2. Fetch, match, and sort jobs using cached engine with rate limiting
    const { data, isLoading: jobsLoading, refetch: refreshJobs } = useQuery({
        queryKey: ['jobs', profile, preferences, page, searchQuery, locationQuery],
        queryFn: async () => {
            // Rate limiting check for job searches
            if (user?.id) {
                const userTier = subscription?.tier || 'free';
                const rateCheck = await checkFeatureLimit(user.id, 'job_matches', userTier);

                if (!rateCheck.allowed) {
                    throw new Error(`Rate limit exceeded. You can search again in ${rateCheck.retryAfter || 60} seconds.`);
                }
            }

            // Use cached search engine for better performance
            const searchFilters = {
                location: locationQuery,
                experienceLevel: preferences?.experience_level,
            };

            const cachedResult = await searchJobsCached(
                searchQuery || '',
                searchFilters,
                page,
                PAGE_SIZE
            );

            // Record usage for rate limiting
            if (user?.id) {
                const userTier = subscription?.tier || 'free';
                await recordUsage(user.id, 'job_matches', userTier);
            }

            const totalPages = Math.max(1, Math.ceil(cachedResult.totalCount / PAGE_SIZE));

            if (!profile) {
                const enriched = cachedResult.jobs.map(job => ({ ...job, match: undefined }));
                return {
                    jobs: enriched,
                    totalPages,
                    filteredJobCount: cachedResult.totalCount,
                    fromCache: true
                };
            }

            // For logged-in users, use cached job matches when available
            if (user?.id && (!searchQuery?.trim() && !locationQuery?.trim())) {
                try {
                    const cachedMatches = await getJobMatchesCached(user.id, PAGE_SIZE);

                    if (cachedMatches.length > 0) {
                        const enrichedMatches = cachedMatches.map(match => ({
                            ...match.job_listings,
                            match: {
                                overall_score: match.match_score,
                                skill_match: match.skill_match || 0.8,
                                culture_fit: match.culture_fit || 0.7,
                                location_match: match.location_match || 0.9,
                                reasoning: match.reasoning || "Pre-computed match"
                            } as MatchResult
                        } as EnrichedJob));

                        return {
                            jobs: enrichedMatches,
                            totalPages: 1,
                            filteredJobCount: enrichedMatches.length,
                            fromCache: true
                        };
                    }
                } catch (error) {
                    console.warn('[JOBS] Cached matches failed, falling back to fresh search:', error);
                }
            }

            // Fallback to server-side matching for complex queries
            const weights = getOptimizedWeights();
            const serverSideMatches = await getMatchedJobsServerSide(profile, weights, preferences, PAGE_SIZE);

            // Convert server-side results to enriched job format for backwards compatibility
            const matches = serverSideMatches.map(job => ({
                ...job,
                match: {
                    overall_score: job.match_score,
                    skill_match: job.skill_match,
                    culture_fit: job.culture_fit,
                    location_match: job.location_match,
                    reasoning: job.reasoning
                } as MatchResult
            } as EnrichedJob));

            return {
                jobs: matches,
                totalPages,
                filteredJobCount: cachedResult.totalCount,
                fromCache: false
            };
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
        placeholderData: keepPreviousData,
        retry: (failureCount, error) => {
            // Don't retry rate limit errors
            if (error.message.includes('Rate limit exceeded')) {
                return false;
            }
            return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });

    const currentPageJobs: EnrichedJob[] = data?.jobs ?? [];
    const totalPages: number = data?.totalPages ?? 1;
    const filteredJobCount: number = data?.filteredJobCount ?? 0;

    // Reset to page 1 when search query or profile changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, locationQuery, profile]);

    // 4. Crawl Mutation
    const { mutate: crawl, isPending: isCrawling } = useMutation({
        mutationFn: async (extraKeywords?: string[]) => {
            const params: CrawlParams = {};

            if (profile) {
                const topSkills = profile.skills.slice(0, 5).map(s => s.name);
                const latestRole = profile.experience_atoms?.[0]?.role;
                params.keywords = [];
                if (latestRole) params.keywords.push(latestRole);
                if (topSkills.length > 0) params.keywords.push(...topSkills);
                
                // Add student/internship keywords if relevant
                const isStudent = profile.education.some(edu => {
                    const yearMatch = edu.year.match(/\d{4}/);
                    return yearMatch && parseInt(yearMatch[0]) >= new Date().getFullYear();
                }) || profile.summary?.toLowerCase().includes('student') || profile.summary?.toLowerCase().includes('university');

                if (isStudent) {
                    params.keywords.push("internship", "intern", "graduate");
                }
            }

            if (extraKeywords && extraKeywords.length > 0) {
                params.keywords = [...(params.keywords || []), ...extraKeywords];
            }

            if (preferences) {
                params.targetRoles = preferences.target_roles;
                params.locations = preferences.locations?.slice(0, 3);
                params.remotePolicy = preferences.remote_policy;
            }

            const result = await triggerJobCrawl(params);
            if (!result.success) throw new Error(result.error);
            return result;
        },
        onSuccess: (data) => {
            toast.success(`Crawl complete! Found ${data.inserted || 0} new jobs`);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCount'] });
        },
        onError: (error) => {
            toast.error("Crawl failed", { description: error.message });
        }
    });

    return {
        jobs: currentPageJobs,
        jobCount,
        filteredJobCount,
        loading: jobsLoading || isCrawling,
        crawling: isCrawling,
        refreshJobs,
        crawl: (extra?: string[]) => crawl(extra),
        page,
        setPage,
        totalPages
    };
};
