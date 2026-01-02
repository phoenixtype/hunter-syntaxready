import { supabase } from "@/integrations/supabase/client";
import { JobOpportunity } from "./crawler_engine";
import { CandidateProfile } from "./resume_engine";

export interface InterviewerProfile {
    role: string;
    name_archetype: string;
    focus_area: string;
    tip: string;
}

export interface EvaluationCriterion {
    dimension: string;
    weight: "High" | "Medium" | "Low";
    description: string;
}

export interface CompanyProfile {
    mission: string;
    industry: string;
    stage: string;
    recent_news: string[];
}

export interface InterviewPrepMaterial {
    company_profile: CompanyProfile;
    company_values: string[];
    technical_questions: string[];
    behavioral_questions: string[];
    red_flags_to_watch: string[];
    interviewer_insights: InterviewerProfile[];
    evaluation_criteria: EvaluationCriterion[];
}

export interface InterviewMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface InterviewSession {
    messages: InterviewMessage[];
    mode: 'technical' | 'behavioral' | 'negotiation';
    job?: JobOpportunity;
    profile?: CandidateProfile;
}

// Start an interview coaching session
export const startInterviewSession = async (
    mode: 'technical' | 'behavioral' | 'negotiation',
    profile?: CandidateProfile,
    job?: JobOpportunity
): Promise<{ message: string; mode: string }> => {
    const { data, error } = await supabase.functions.invoke('interview-coach', {
        body: { mode, profile, job, messages: [] }
    });

    if (error) {
        console.error('Interview session error:', error);
        throw new Error(error.message || 'Failed to start interview session');
    }

    return {
        message: data?.message || 'Hello! Let\'s start your interview practice.',
        mode: data?.mode || mode
    };
};

// Continue interview conversation
export const sendInterviewMessage = async (
    userMessage: string,
    session: InterviewSession
): Promise<string> => {
    const messages = [
        ...session.messages,
        { role: 'user' as const, content: userMessage }
    ];

    const { data, error } = await supabase.functions.invoke('interview-coach', {
        body: {
            messages,
            mode: session.mode,
            profile: session.profile,
            job: session.job
        }
    });

    if (error) {
        console.error('Interview message error:', error);
        throw new Error(error.message || 'Failed to get interview response');
    }

    return data?.message || 'I understand. Can you tell me more about that?';
};

// Generate interview prep materials using AI
export const generateInterviewPrep = async (job: JobOpportunity): Promise<InterviewPrepMaterial> => {
    // Call the Edge Function to generate real, context-aware prep material
    const { data, error } = await supabase.functions.invoke('interview-coach', {
        body: { 
            mode: 'generate_briefing',
            job: {
                title: job.title,
                company: job.company,
                description: job.description
            }
        }
    });

    if (error) {
        console.error('Interview prep generation error:', error);
        throw new Error(error.message || 'Failed to generate prep material');
    }

    // Return the AI generated data, or fall back to a generic template ONLY if AI fails completely
    return data || {
        company_profile: {
            mission: `Analyze ${job.company}'s mission statement online.`,
            industry: "Technology",
            stage: "Research Required",
            recent_news: ["Check TechCrunch", "Check Company Blog"]
        },
        company_values: ["Customer Obsession", "Innovation", "Integrity"],
        technical_questions: ["Review the job description requirements."],
        behavioral_questions: ["Tell me about a challenging project."],
        red_flags_to_watch: ["Check Glassdoor reviews."],
        interviewer_insights: [],
        evaluation_criteria: []
    };
};
