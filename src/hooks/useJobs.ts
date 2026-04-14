import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { triggerJobCrawl, getJobCount, JobOpportunity, CrawlParams } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { MatchResult, getMatchedJobsServerSide } from "@/lib/matching_engine";
import { getOptimizedWeights } from "@/lib/learning_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { searchJobsCached, getJobMatchesCached, cachedJobEngine } from "@/lib/cached-job-engine";
import { checkFeatureLimit, recordUsage } from "@/lib/redis-rate-limiter";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { backgroundJobService } from "@/lib/background-job-service";
import { realtimeJobStream } from "@/lib/realtime-job-stream";
import { shouldUseReducedMode } from "@/lib/mobile-safety";

export interface EnrichedJob extends JobOpportunity {
    match?: MatchResult;
}

// Reduce page size on mobile for better memory usage
const PAGE_SIZE = shouldUseReducedMode() ? 10 : 20;

export const useJobs = (profile: CandidateProfile | null, preferences?: UserPreferences | null, searchQuery?: string, locationQuery?: string) => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const { user } = useAuth();
    const { currentSubscription: subscription } = useSubscription();

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
                    // Fetch extra matches in case active preferences filter out stale cached ones
                    const cachedMatches = await getJobMatchesCached(user.id, PAGE_SIZE * 3);

                    if (cachedMatches.length > 0) {
                        // Strictly enforce user preferences client-side in case background cache is loose/outdated
                        const filteredMatches = cachedMatches.filter(match => {
                            const job = match.job_listings;
                            if (!job) return false;
                            
                            const jobText = `${job.title} ${job.description}`.toLowerCase();
                            
                            // Enforce remote policy
                            const isRemote = (job.location || '').toLowerCase().includes('remote');
                            if (preferences?.remote_policy === 'remote' && !isRemote) return false;
                            if (preferences?.remote_policy === 'onsite' && isRemote) return false;
                            
                            // Enforce target roles strictly
                            if (preferences?.target_roles && preferences.target_roles.length > 0) {
                                const hasRole = preferences.target_roles.some(role => jobText.includes(role.toLowerCase()));
                                if (!hasRole) return false;
                            }
                            
                            return true;
                        }).slice(0, PAGE_SIZE);

                        if (filteredMatches.length > 0) {
                            const enrichedMatches = filteredMatches.map(match => ({
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
                    }
                } catch (error) {
                    console.warn('[JOBS] Cached matches failed, falling back to fresh search:', error);
                }
            }

            // Fallback to server-side matching for complex queries
            const weights = getOptimizedWeights();
            const serverSideMatches = await getMatchedJobsServerSide(profile, weights, preferences, PAGE_SIZE, searchQuery, locationQuery);

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

            // If role-filtered matching returned nothing but there ARE jobs in the DB,
            // fall back to the unfiltered cached results so the user sees something.
            if (matches.length === 0 && cachedResult.jobs.length > 0) {
                return {
                    jobs: cachedResult.jobs.map(job => ({ ...job, match: undefined })) as EnrichedJob[],
                    totalPages,
                    filteredJobCount: cachedResult.totalCount,
                    fromCache: true
                };
            }

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

    const currentPageJobs: EnrichedJob[] = (data?.jobs ?? []) as EnrichedJob[];
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
            // Complete nuke of all caches so the refetch hits the DB fresh
            cachedJobEngine.clearAllCaches();
            
            // Allow auto-crawling again if needed
            sessionStorage.removeItem('hunter_crawled_this_session');
            
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCount'] });
            
            // Explicitly refetch jobs to ensure UI updates immediately
            refreshJobs();
        },
        onError: (error) => {
            // Show friendlier message for rate limit errors
            if (error.message.includes('Too many requests') || error.message.includes('rate limit')) {
                toast.error("Slow down!", {
                    description: "Please wait a minute before searching again."
                });
            } else {
                toast.error("Crawl failed", { description: error.message });
            }
        }
    });

    // Initialize background job service when profile and preferences are available
    useEffect(() => {
        if (!user?.id || !profile || !preferences?.target_roles?.length) {
            backgroundJobService.stop();
            realtimeJobStream.stop();
            return;
        }

        // Start background service with user profile and preferences
        backgroundJobService.start(profile, preferences);

        // Start real-time job streaming
        const userFilters = {
            target_roles: preferences.target_roles || [],
            locations: preferences.locations || [],
            remote_policy: preferences.remote_policy || 'hybrid',
            skills: profile.skills?.slice(0, 10)?.map((s: any) => s.name) || [],
            excluded_companies: preferences.excluded_companies || []
        };
        realtimeJobStream.start(userFilters);

        return () => {
            backgroundJobService.stop();
            realtimeJobStream.stop();
        };
    }, [user?.id, profile, preferences?.target_roles?.join(','), preferences?.locations?.join(','), preferences?.remote_policy]);

    // Listen for job events (background refresh and real-time matches)
    useEffect(() => {
        const handleJobsRefreshed = (event: CustomEvent) => {
            console.log('[JOBS] Background refresh completed:', event.detail);

            // Invalidate and refetch jobs to show fresh data
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCount'] });
            refreshJobs();

            // Show notification for manual refreshes
            if (event.detail.isManual && event.detail.inserted > 0) {
                toast.success(`Found ${event.detail.inserted} new jobs!`);
            }
        };

        const handleNewJobMatch = (event: CustomEvent) => {
            console.log('[JOBS] New real-time job match:', event.detail);

            // Invalidate job queries to include the new job
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['jobCount'] });
        };

        const handleViewJobMatch = (event: CustomEvent) => {
            console.log('[JOBS] User wants to view job match:', event.detail);
            // This could navigate to job details or open a modal
            // Implementation depends on your routing/modal system
        };

        window.addEventListener('jobs:refreshed', handleJobsRefreshed as EventListener);
        window.addEventListener('jobs:new-match', handleNewJobMatch as EventListener);
        window.addEventListener('jobs:view-match', handleViewJobMatch as EventListener);

        return () => {
            window.removeEventListener('jobs:refreshed', handleJobsRefreshed as EventListener);
            window.removeEventListener('jobs:new-match', handleNewJobMatch as EventListener);
            window.removeEventListener('jobs:view-match', handleViewJobMatch as EventListener);
        };
    }, [queryClient, refreshJobs]);

    // Auto-crawl once per browser session when the user has a profile +
    // preferences but no fresh jobs yet.  Using sessionStorage (rather than a
    // plain ref) means the flag resets on each page load / tab open, so the
    // user always sees up-to-date jobs after navigating away and back.
    const autoCrawledRef = useRef(false);
    useEffect(() => {
        if (!user?.id) return;
        // Initialise from sessionStorage on first mount
        const sessionKey = `hunter_auto_crawled:${user.id}`;
        if (!autoCrawledRef.current) {
            autoCrawledRef.current = sessionStorage.getItem(sessionKey) === 'true';
        }

        if (autoCrawledRef.current || isCrawling || jobsLoading) return;
        if (!profile || !preferences?.target_roles?.length) return;
        if (data === undefined || (data.jobs?.length ?? 0) > 0) return;

        autoCrawledRef.current = true;
        sessionStorage.setItem(sessionKey, 'true');
        crawl(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.jobs?.length, jobsLoading, isCrawling, user?.id, !!profile, preferences?.target_roles?.join(',')]);

    return {
        jobs: currentPageJobs,
        jobCount,
        filteredJobCount,
        loading: jobsLoading || isCrawling,
        crawling: isCrawling,
        refreshJobs,
        crawl: (extra?: string[]) => crawl(extra),
        manualRefresh: () => backgroundJobService.manualRefresh(profile, preferences),
        backgroundStatus: backgroundJobService.getStatus(),
        realtimeStatus: realtimeJobStream.getStatus(),
        page,
        setPage,
        totalPages
    };
};
