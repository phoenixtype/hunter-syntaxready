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
                description: `Interviewer: ${interviewerName}. Key topics discussed: ${keyTopics.join(', ')}`,
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
): Promise<{ score: number; analysis: string[] }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
            profile,
            type: 'offer_evaluation',
            job: { 
                company: offer.company, 
                title: 'Selected Role',
                description: `Offer details — Base salary: $${offer.baseSalary.toLocaleString()}, Equity: ${offer.equity}, Bonus: ${offer.bonus}, Benefits: ${offer.benefits.join(', ') || 'Not specified'}`,
                offer_data: offer 
            }
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
    });

    if (error) throw error;
    
    const content = data?.content || "";
    const lines = content.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().startsWith('•'));
    const analysis = lines.length > 0 
        ? lines.map((l: string) => l.replace(/^[-•]\s*/, '').trim())
        : ["Review the AI-generated evaluation above."];
    
    // Extract a score heuristic from the response
    const scoreMatch = content.match(/(\d{1,3})[\s]*(?:\/\s*100|%|out of 100)/i);
    const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1])) : 75;

    return { score, analysis };
};

export const generateNegotiationStrategy = async (
    offer: OfferDetails,
    profile: CandidateProfile
): Promise<NegotiationStrategy> => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
            profile,
            type: 'offer_evaluation',
            job: { 
                company: offer.company, 
                title: 'Negotiation Strategy',
                description: `Generate a negotiation strategy for this offer — Base salary: $${offer.baseSalary.toLocaleString()}, Equity: ${offer.equity}, Bonus: ${offer.bonus}. Provide: 1) Leverage points as bullet items, 2) A recommended counter-offer, 3) An opening negotiation script.`,
                offer_data: offer 
            }
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
    });

    if (error) throw error;

    const content = data?.content || "";
    
    // Parse structured response from AI
    const leverageLines = content.split('\n')
        .filter((l: string) => (l.trim().startsWith('-') || l.trim().startsWith('•')) && l.length > 10)
        .slice(0, 5)
        .map((l: string) => l.replace(/^[-•]\s*/, '').trim());

    // Extract counter recommendation
    const counterMatch = content.match(/counter[^:]*:\s*\$?([\d,]+)/i) || 
                          content.match(/recommend[^:]*:\s*\$?([\d,]+)/i);
    const counterAmount = counterMatch 
        ? `$${counterMatch[1]}` 
        : `$${Math.round(offer.baseSalary * 1.1).toLocaleString()} - $${Math.round(offer.baseSalary * 1.2).toLocaleString()}`;

    // Extract or use the full content as the script
    const scriptStart = content.indexOf('"');
    const scriptEnd = content.lastIndexOf('"');
    const script = (scriptStart >= 0 && scriptEnd > scriptStart) 
        ? content.substring(scriptStart + 1, scriptEnd)
        : content.split('\n').filter((l: string) => l.length > 50).slice(-1)[0] || 
          `I'm very excited about this opportunity at ${offer.company}. Based on my research and the value I bring, I'd like to discuss the compensation package. I believe a base salary of ${counterAmount} would better reflect the market rate and my experience.`;

    return {
        leveragePoints: leverageLines.length > 0 
            ? leverageLines 
            : ["Your unique skill set", "Market rate research", "Competing opportunities"],
        recommendedCounter: `Recommended counter: ${counterAmount} base salary`,
        script
    };
};
