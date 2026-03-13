import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    getApplicationCount,
    getApplicationMetrics,
    getApplicationHistory,
    ApplicationMetrics,
} from "@/lib/application_engine";
import { getJobCount } from "@/lib/crawler_engine";
import { getPreferences, UserPreferences } from "@/lib/user_preferences";
import { calculateVisibilityScore, VisibilityScore } from "@/lib/visibility_engine";
import { fetchLogsFromDatabase } from "@/lib/activity_logger";
import { initializeLearningEngine } from "@/lib/learning_engine";
import { useAuth } from "./useAuth";
import { useResume } from "./useResume";
import { getSkillDevelopmentAdvice, SkillRecommendation } from "@/lib/skill_coach_engine";

const EMPTY_METRICS: ApplicationMetrics = { interviews: 0, offers: 0 };

export const useDashboardData = () => {
    const { user } = useAuth();
    const { profile } = useResume();

    const userId = user?.id;
    // Use stable scalar keys — never put object references in queryKey.
    // Putting the whole profile object caused identity-based cache churn on every render.
    // CandidateProfile has no id field; profile is 1:1 with user so userId suffices.
    // For the enabled guard we check !!profile (not !!profileId) to ensure the async
    // fetch has completed before queries that depend on profile data fire.

    // 1. User Preferences
    const {
        data: preferences,
        isLoading: prefsLoading,
        error: prefsError,
    } = useQuery<UserPreferences | null>({
        queryKey: ["preferences", userId],
        queryFn: () => (userId ? getPreferences(userId) : Promise.resolve(null)),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 min — not Infinity; user may update in another tab/device
        refetchOnWindowFocus: true,
    });

    // 2. Application Count
    const {
        data: appCount,
        isLoading: countLoading,
        error: countError,
    } = useQuery<number>({
        queryKey: ["applicationCount", userId],
        queryFn: () => (userId ? getApplicationCount(userId) : Promise.resolve(0)),
        enabled: !!userId,
    });

    // 2a. Application Metrics
    const {
        data: metrics,
        isLoading: metricsLoading,
        error: metricsError,
    } = useQuery<ApplicationMetrics>({
        queryKey: ["applicationMetrics", userId],
        queryFn: () =>
            userId ? getApplicationMetrics(userId) : Promise.resolve(EMPTY_METRICS),
        enabled: !!userId,
    });

    // 2b. Job Count — scoped to userId to prevent cross-user cache pollution.
    // Without userId in the key, User B on the same browser gets User A's cached count.
    const {
        data: jobCount,
        isLoading: jobCountLoading,
        error: jobCountError,
    } = useQuery<number>({
        queryKey: ["jobCount", userId],
        queryFn: () => getJobCount(),
        enabled: !!userId,
        staleTime: 1000 * 60 * 2,
    });

    // 3. Visibility Score — keyed on profileId (stable scalar), not the profile object.
    // Also guarded with !!profileId so an empty object {} doesn't trigger the query.
    const {
        data: visibility,
        isLoading: visibilityLoading,
        error: visibilityError,
    } = useQuery<VisibilityScore | null>({
        queryKey: ["visibilityScore", userId],
        queryFn: () =>
            profile ? calculateVisibilityScore(profile) : Promise.resolve(null),
        enabled: !!profile && !!userId,
        staleTime: 1000 * 60 * 2,
    });

    // 3b. Skill Recommendations
    // - Uses getApplicationHistory() (correct table: application_history, not applications)
    // - Bridges the shape mismatch: ApplicationRecord stores tech_stack under `metadata`,
    //   but skill_coach_engine reads from `job_metadata`. Without this mapping the engine
    //   never received real skill data and always fell back to the generic recommendation.
    // - Errors from getApplicationHistory surface as query errors, not silent empty arrays.
    const {
        data: skillRecommendations,
        isLoading: skillLoading,
        error: skillError,
    } = useQuery<SkillRecommendation[]>({
        queryKey: ["skillRecommendations", userId],
        queryFn: async () => {
            if (!profile || !userId) return [];
            const apps = await getApplicationHistory(userId);
            // Map ApplicationRecord → shape expected by getSkillDevelopmentAdvice
            const mapped = apps.map((app) => ({
                ...app,
                job_metadata: {
                    tech_stack:
                        (app.metadata as { tech_stack?: string[] } | undefined)
                            ?.tech_stack ?? [],
                },
            }));
            return getSkillDevelopmentAdvice(profile, mapped);
        },
        enabled: !!profile && !!userId,
        staleTime: 1000 * 60 * 5,
    });

    // 4. Background initialization — side effects belong in useEffect, not useQuery.
    //
    // useQuery retries on failure (3x by default). If these had lived in useQuery and
    // fetchLogsFromDatabase threw, initializeLearningEngine would be called up to 3
    // more times against partially-initialized state.
    //
    // `cancelled` prevents initializeLearningEngine from running if the component
    // unmounts or userId changes while fetchLogsFromDatabase is still in flight.
    //
    // initRunRef prevents the init from firing more than once per userId, which guards
    // against React StrictMode's double-invoke in development.
    const initRunRef = useRef<string | null>(null);
    useEffect(() => {
        if (!userId) return;
        if (initRunRef.current === userId) return;
        initRunRef.current = userId;

        let cancelled = false;

        (async () => {
            try {
                await fetchLogsFromDatabase(userId);
                if (cancelled) return;
                await initializeLearningEngine(userId);
            } catch (err) {
                console.error("[useDashboardData] Background init failed:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const isLoading =
        prefsLoading ||
        countLoading ||
        metricsLoading ||
        visibilityLoading ||
        jobCountLoading ||
        skillLoading;

    const errors = {
        preferences: prefsError ?? null,
        appCount: countError ?? null,
        metrics: metricsError ?? null,
        jobCount: jobCountError ?? null,
        visibility: visibilityError ?? null,
        skillRecommendations: skillError ?? null,
    };

    return {
        preferences,
        appCount: appCount ?? 0,
        jobCount: jobCount ?? 0,
        visibility,
        skillRecommendations: skillRecommendations ?? [],
        metrics: metrics ?? EMPTY_METRICS,
        isLoading,
        errors,
        hasError: Object.values(errors).some(Boolean),
    };
};
