import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchJobs, triggerJobCrawl, getJobCount, JobOpportunity, CrawlParams } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { calculateMatch, MatchResult } from "@/lib/matching_engine";
import { getOptimizedWeights } from "@/lib/learning_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";
import { useState, useCallback } from "react";

export interface EnrichedJob extends JobOpportunity {
    match?: MatchResult;
}

const PAGE_SIZE = 20;

export const useJobs = (profile: CandidateProfile | null, preferences?: UserPreferences | null, searchQuery?: string, locationQuery?: string) => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [currentPageJobs, setCurrentPageJobs] = useState<EnrichedJob[]>([]);
    const [totalPages, setTotalPages] = useState(1);

    // 1. Fetch Job Count
    const { data: jobCount = 0 } = useQuery({
        queryKey: ['jobCount'],
        queryFn: getJobCount
    });

    // 2. Fetch and Sort/Match Jobs for current page
    const { isLoading: jobsLoading, refetch: refreshJobs } = useQuery({
        queryKey: ['jobs', profile, page, searchQuery, locationQuery],
        queryFn: async () => {
            const { jobs: rawJobs, totalCount } = await searchJobs(searchQuery, locationQuery, page - 1, PAGE_SIZE);
            setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));

            if (!profile) {
                const enriched = rawJobs.map(job => ({ ...job, match: undefined }));
                setCurrentPageJobs(enriched);
                return enriched;
            }

            const weights = getOptimizedWeights();
            const matches = await Promise.all(
                rawJobs.map(async (job) => {
                    const match = await calculateMatch(profile, job, weights);
                    return { ...job, match } as EnrichedJob;
                })
            );

            const sorted = matches
                .sort((a, b) => (b.match?.overall_score ?? 0) - (a.match?.overall_score ?? 0));

            setCurrentPageJobs(sorted);
            return sorted;
        },
        staleTime: 1000 * 60 * 5
    });

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
