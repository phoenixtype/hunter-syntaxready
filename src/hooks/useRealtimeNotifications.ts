import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribes to Supabase Realtime channels for:
 * 1. New job_listings inserts → toast + invalidate jobs query
 * 2. application_history updates → toast + invalidate apps query
 */
export const useRealtimeNotifications = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_listings" },
        (payload) => {
          const job = payload.new as { title?: string; company?: string };
          toast.info("New job posted", {
            description: `${job.title || "New role"} at ${job.company || "a company"}`,
            duration: 5000,
          });
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
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const app = payload.new as { job_title?: string; status?: string };
          toast.info("Application updated", {
            description: `${app.job_title || "Application"} → ${app.status || "updated"}`,
            duration: 5000,
          });
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
