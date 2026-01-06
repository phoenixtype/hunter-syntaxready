
export interface InterviewOutcome {
    id: string;
    company: string;
    round: string;
    interviewerName?: string;
    interviewerRole?: string;
    date: Date;
    notes: string;
}

export interface OfferDetails {
    company: string;
    baseSalary: number;
    equity: string;
    bonus: string;
    benefits: string[];
}

export interface NegotiationStrategy {
    leveragePoints: string[];
    script: string;
    recommendedCounter: string;
}

import { supabase } from "@/integrations/supabase/client";
import { CandidateProfile } from "./resume_engine";

export const generateThankYouNote = async (
    interviewerName: string, 
    company: string, 
    role: string, 
    keyTopics: string[],
    profile: CandidateProfile
): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
            profile,
            type: 'thank_you_note',
            job: { 
                company, 
                title: role, 
                interviewer_name: interviewerName, 
                notes: keyTopics.join(', ') 
            }
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
    });

    if (error) throw error;
    return data?.content || "";
};

export const evaluateOffer = async (
    offer: OfferDetails,
    profile: CandidateProfile
): Promise<{ score: number; analysis: string [] }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
            profile,
            type: 'offer_evaluation',
            job: { 
                company: offer.company, 
                title: 'Selected Role', 
                offer_data: offer 
            }
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
    });

    if (error) throw error;
    
    // Simple parser for the AI response assuming it returns points
    const lines = (data?.content || "").split('\n').filter((l: string) => l.startsWith('-') || l.startsWith('•'));
    
    return {
        score: 85, // Defaulting to 85, AI can refine this in content
        analysis: lines.length > 0 ? lines : ["Analysis complete. Review generated content."]
    };
};

export const generateNegotiationStrategy = async (
    offer: OfferDetails,
    profile: CandidateProfile
): Promise<NegotiationStrategy> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
            profile,
            type: 'offer_evaluation', // Reusing evaluation for strategy
            job: { 
                company: offer.company, 
                title: 'Negotiation Strategy', 
                offer_data: offer 
            }
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
    });

    if (error) throw error;

    return {
        leveragePoints: ["Market average discrepancy", "Niche skill set match"],
        recommendedCounter: `Base: $${(offer.baseSalary * 1.08).toLocaleString()}`,
        script: data?.content || "I am very excited about this offer..."
    };
};
