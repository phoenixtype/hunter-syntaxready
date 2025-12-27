
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

export const generateThankYouNote = async (interviewerName: string, company: string, role: string, keyTopics: string[]): Promise<string> => {
    // Simulate LLM generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    return `Dear ${interviewerName},

I wanted to sincerely thank you for taking the time to discuss the ${role} position at ${company} with me today.

I particularly enjoyed our conversation about ${keyTopics.join(' and ')}. It gave me a much clearer perspective on how the team approaches engineering challenges, and I'm even more excited about the possibility of contributing to ${company}'s mission.

I look forward to hearing about the next steps.

Best regards,
[My Name]`;
};

export const evaluateOffer = async (offer: OfferDetails): Promise<{ score: number; analysis: string [] }> => {
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 1500));

    return {
        score: 85,
        analysis: [
            "Base salary is in the 90th percentile for this role.",
            "Equity vesting schedule is standard (4-year, 1-year cliff).",
            "Sign-on bonus is slightly below market average for this level."
        ]
    };
};

export const generateNegotiationStrategy = async (offer: OfferDetails): Promise<NegotiationStrategy> => {
     // Simulate strategy generation
     await new Promise(resolve => setTimeout(resolve, 1500));

     return {
         leveragePoints: [
             "Strong market demand for System Design skills.",
             "Competing offer from TechFlow AI (hypothetical).",
             "Experience with the exact tech stack they are migrating to."
         ],
         recommendedCounter: `Base: $${(offer.baseSalary * 1.1).toLocaleString()}, Sign-on: $20k`,
         script: "I'm incredibly excited about the team and the mission. However, looking at the total compensation package and competing opportunities, I was hoping to see the base salary closer to..."
     };
};
