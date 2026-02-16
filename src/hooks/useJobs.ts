import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchJobs, triggerJobCrawl, getJobCount, JobOpportunity, CrawlParams } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { calculateMatch, MatchResult } from "@/lib/matching_engine";
import { getOptimizedWeights } from "@/lib/learning_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";

export interface EnrichedJob extends JobOpportunity {
    match?: MatchResult;
}

export const useJobs = (profile: CandidateProfile | null, preferences?: UserPreferences | null) => {
    const queryClient = useQueryClient();

    // 1. Fetch Job Count
    const { data: jobCount = 0 } = useQuery({
        queryKey: ['jobCount'],
        queryFn: getJobCount
    });

    // 2. Fetch and Sort/Match Jobs
    const { data: jobs = [], isLoading: jobsLoading, refetch: refreshJobs } = useQuery<EnrichedJob[]>({
        queryKey: ['jobs', profile], // Refetch if profile changes to re-rank
        queryFn: async (): Promise<EnrichedJob[]> => {
            const rawJobs = await searchJobs();

            if (!profile) {
                return rawJobs.map(job => ({ ...job, match: undefined }));
            }

            const weights = getOptimizedWeights();
            const matches = await Promise.all(
                rawJobs.map(async (job) => {
                    const match = await calculateMatch(profile, job, weights);
                    return { ...job, match } as EnrichedJob;
                })
            );

            return matches
                .filter(j => j.match && j.match.overall_score > 0)
                .sort((a, b) => (b.match?.overall_score ?? 0) - (a.match?.overall_score ?? 0));
        },
        staleTime: 1000 * 60 * 5
    });

    // 3. Crawl Mutation — uses profile + preferences for smart search
    const { mutate: crawl, isPending: isCrawling } = useMutation({
        mutationFn: async (extraKeywords?: string[]) => {
            const params: CrawlParams = {};

            // Build keywords from profile skills
            if (profile) {
                const topSkills = profile.skills.slice(0, 5).map(s => s.name);
                const latestRole = profile.experience_atoms?.[0]?.role;
                params.keywords = [];
                if (latestRole) params.keywords.push(latestRole);
                if (topSkills.length > 0) params.keywords.push(...topSkills);
            }

            // Add any extra keywords (e.g., from search bar)
            if (extraKeywords && extraKeywords.length > 0) {
                params.keywords = [...(params.keywords || []), ...extraKeywords];
            }

            // Wire in user preferences
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
        jobs,
        jobCount,
        loading: jobsLoading,
        crawling: isCrawling,
        refreshJobs,
        crawl
    };
};
