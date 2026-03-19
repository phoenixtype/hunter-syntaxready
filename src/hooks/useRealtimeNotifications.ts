import { useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "./useSubscription";

/**
 * Simple hash function for consistent user → pool mapping
 */
const hashCode = (str: string): number => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
};

/**
 * Billion-user scalable real-time notifications with subscription pooling.
 *
 * Strategy:
 * - Premium users get dedicated channels for real-time experience
 * - Free users share pooled channels to stay within Supabase's 10k limit
 * - Filters messages client-side for shared channels
 */
export const useRealtimeNotifications = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { isPro } = useSubscription();

  // Determine channel strategy based on subscription
  const channelName = useMemo(() => {
    if (!userId) return null;

    // Premium users get dedicated channels for best performance
    if (isPro) {
      return `premium:${userId}`;
    }

    // Free users share pooled channels (100 pools = max 10k users per pool)
    // This keeps us well within Supabase's 10k concurrent subscription limit
    const poolId = Math.abs(hashCode(userId)) % 100;
    return `pool:${poolId}`;
  }, [userId, isPro]);

  useEffect(() => {
    if (!userId || !channelName) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_listings" },
        (payload) => {
          const job = payload.new as {
            title?: string;
            company?: string;
            salary_range?: string;
            tech_stack?: string[];
          };

          // Check if it could be a high-match job based on tech stack overlap
          // (full match calculation requires profile context, so we do a lightweight signal here)
          const hasHighSignal = (job.tech_stack?.length ?? 0) >= 3;

          if (hasHighSignal) {
            toast.success("🎯 High-Match Job Alert!", {
              description: `${job.title || "New role"} at ${job.company || "a company"}${job.salary_range ? ` · ${job.salary_range}` : ""}`,
              duration: 8000,
              action: {
                label: "View",
                onClick: () => {
                  // Scroll to jobs view
                  window.dispatchEvent(new CustomEvent("hunter:navigate", { detail: "jobs" }));
                },
              },
            });
          } else {
            toast.info("New job posted", {
              description: `${job.title || "New role"} at ${job.company || "a company"}`,
              duration: 5000,
            });
          }

          queryClient.invalidateQueries({ queryKey: ["jobs"] });
          queryClient.invalidateQueries({ queryKey: ["jobCount"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "application_history",
          // For premium users, filter at database level. For pooled users, filter client-side.
          filter: isPro ? `user_id=eq.${userId}` : undefined,
        },
        (payload) => {
          const app = payload.new as {
            job_title?: string;
            status?: string;
            user_id?: string;
          };

          // For pooled channels, only show notifications for this specific user
          if (!isPro && app.user_id !== userId) {
            return;
          }

          const status = app.status?.toLowerCase() || "";

          // Special treatment for offers
          if (status.includes("offer")) {
            toast.success("🎉 You received an offer!", {
              description: `${app.job_title || "Application"} → Offer`,
              duration: 10000,
            });
          } else {
            toast.info("Application updated", {
              description: `${app.job_title || "Application"} → ${app.status || "updated"}`,
              duration: 5000,
            });
          }

          queryClient.invalidateQueries({ queryKey: ["applicationCount"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, queryClient]);
};
