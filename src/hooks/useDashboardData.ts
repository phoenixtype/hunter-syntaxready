import { useQuery } from "@tanstack/react-query";
import { getApplicationCount, getApplicationMetrics, ApplicationMetrics } from "@/lib/application_engine";
import { getJobCount } from "@/lib/crawler_engine";
import { getPreferences, UserPreferences } from "@/lib/user_preferences";
import { calculateVisibilityScore, VisibilityScore } from "@/lib/visibility_engine";
import { fetchLogsFromDatabase } from "@/lib/activity_logger";
import { initializeLearningEngine } from "@/lib/learning_engine";
import { useAuth } from "./useAuth";
import { useResume } from "./useResume";

export const useDashboardData = () => {
    const { user } = useAuth();
    const { profile } = useResume();

    const userId = user?.id;

    // 1. User Preferences
    const { data: preferences, isLoading: prefsLoading } = useQuery<UserPreferences | null>({
        queryKey: ['preferences', userId],
        queryFn: () => userId ? getPreferences(userId) : Promise.resolve(null),
        enabled: !!userId,
        staleTime: Infinity // Preferences rarely change
    });

    // 2. Application Count
    const { data: appCount, isLoading: countLoading } = useQuery<number>({
        queryKey: ['applicationCount', userId],
        queryFn: () => userId ? getApplicationCount(userId) : Promise.resolve(0),
        enabled: !!userId
    });

    // 2a. Magic Metrics
    const { data: metrics, isLoading: metricsLoading } = useQuery<ApplicationMetrics>({
        queryKey: ['applicationMetrics', userId],
        queryFn: () => userId ? getApplicationMetrics(userId) : Promise.resolve({ interviews: 0, offers: 0 }),
        enabled: !!userId
    });

    // 2b. Job Count
    const { data: jobCount, isLoading: jobCountLoading } = useQuery<number>({
        queryKey: ['jobCount'],
        queryFn: () => getJobCount(),
        staleTime: 1000 * 60 * 2
    });

    // 3. Visibility Score (Dependent on Profile)
    const { data: visibility, isLoading: visibilityLoading } = useQuery<VisibilityScore | null>({
        queryKey: ['visibilityScore', profile], // Recalculate if profile changes
        queryFn: () => profile ? calculateVisibilityScore(profile) : Promise.resolve(null),
        enabled: !!profile,
        staleTime: 1000 * 60 * 2 // Cache for 2 mins
    });

    // 4. Side Effects (Fire and Forget or Background Sync)
    // We use useQuery here just to trigger the async initialization logic efficiently once
    useQuery({
        queryKey: ['init-logger', userId],
        queryFn: async () => {
            if (userId) {
                await fetchLogsFromDatabase(userId);
                await initializeLearningEngine(userId);
            }
            return true;
        },
        enabled: !!userId,
        staleTime: Infinity,
        gcTime: Infinity // Keep this result forever so it doesn't re-run unreasonably
    });

    const isLoading = prefsLoading || countLoading || metricsLoading || visibilityLoading || jobCountLoading;

    return {
        preferences,
        appCount: appCount || 0,
        jobCount: jobCount || 0,
        visibility,
        metrics: metrics || { interviews: 0, offers: 0 },
        isLoading
    };
};
