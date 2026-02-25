import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CandidateProfile, getCandidateProfile } from '@/lib/resume_engine';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useResume = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<CandidateProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);

            // Self-healing: Ensure user base record exists
            await import('@/lib/auth_helpers').then(m => m.ensureUserProfile(user));

            const data = await getCandidateProfile(user.id);
            setProfile(data);
        } catch (err) {
            console.error('Error fetching resume:', err);
            toast.error('Failed to load resume profile');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [user, fetchProfile]);

    return {
        profile,
        loading,
        refreshProfile: fetchProfile,
        setProfile
    };
};
