import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { searchJobs, triggerJobCrawl, getJobCount, JobOpportunity, CrawlParams } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { calculateMatch, MatchResult } from "@/lib/matching_engine";
import { getOptimizedWeights } from "@/lib/learning_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export interface EnrichedJob extends JobOpportunity {
    match?: MatchResult;
}

const PAGE_SIZE = 20;

export const useJobs = (profile: CandidateProfile | null, preferences?: UserPreferences | null, searchQuery?: string, locationQuery?: string) => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);

    // 1. Fetch Job Count
    const { data: jobCount = 0 } = useQuery({
        queryKey: ['jobCount'],
        queryFn: getJobCount
    });

    // 2. Fetch, match, and sort jobs — return everything from the query so
    //    React Query's cache can restore it instantly on remount.
    const { data, isLoading: jobsLoading, refetch: refreshJobs } = useQuery({
        queryKey: ['jobs', profile, preferences, page, searchQuery, locationQuery],
        queryFn: async () => {
            const { jobs: rawJobs, totalCount } = await searchJobs(
                searchQuery,
                locationQuery,
                page - 1,
                PAGE_SIZE,
                // Pass preference locations/roles so the DB query filters by them
                // when the user hasn't typed a manual search or location.
                preferences?.locations,
                preferences?.target_roles,
                preferences?.remote_policy,
            );
            const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

            if (!profile) {
                const enriched = rawJobs.map(job => ({ ...job, match: undefined }));
                return { jobs: enriched, totalPages };
            }

            const weights = getOptimizedWeights();
            const matchPromises = rawJobs.map(job => calculateMatch(profile, job, weights, preferences));
            const matchResults = await Promise.all(matchPromises);
            const matches = rawJobs.map((job, i) => ({ ...job, match: matchResults[i] } as EnrichedJob));

            // Sort by match score, then filter out very low relevance jobs (< 20%)
            const sorted = matches
                .sort((a, b) => (b.match?.overall_score ?? 0) - (a.match?.overall_score ?? 0))
                .filter(job => (job.match?.overall_score ?? 0) >= 20);

            return { jobs: sorted, totalPages };
        },
        staleTime: 1000 * 60 * 5,
        // Keep showing previous page's data while next page loads — no flash of empty
        placeholderData: keepPreviousData,
    });

    const currentPageJobs: EnrichedJob[] = data?.jobs ?? [];
    const totalPages: number = data?.totalPages ?? 1;

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
            }

            if (extraKeywords && extraKeywords.length > 0) {
                params.keywords = [...(params.keywords || []), ...extraKeywords];
            }

            if (preferences) {
                params.targetRoles = preferences.target_roles;
                params.location = preferences.locations?.join(', ');
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
        loading: jobsLoading || isCrawling,
        crawling: isCrawling,
        refreshJobs,
        crawl: (extra?: string[]) => crawl(extra),
        page,
        setPage,
        totalPages
    };
};
