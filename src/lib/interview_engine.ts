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

// Generate interview prep materials (legacy function for compatibility)
export const generateInterviewPrep = async (job: JobOpportunity): Promise<InterviewPrepMaterial> => {
    // For backwards compatibility, return structured prep material
    const isStartup = job.company.includes("Startup") || job.title.includes("Founding");
    
    return {
        company_profile: {
            mission: isStartup 
                ? "To disrupt the legacy status quo with AI-native workflows."
                : "Building the global economic infrastructure for the internet.",
            industry: isStartup ? "Generative AI / SaaS" : "FinTech / Enterprise Software",
            stage: isStartup ? "Seed Stage" : "Late Stage / Public",
            recent_news: [
                isStartup ? "Raised $5M Seed round led by Tier 1 VC." : "Reported 40% YoY growth in Q3 earnings.",
                "Released new API v2 for developer ergonomics.",
                "Featured in TechCrunch for innovative UI patterns."
            ]
        },
        company_values: [
            "Customer Obsession",
            "Bias for Action",
            "Ownership",
            "Deep Dive"
        ],
        technical_questions: [
            "Explain the difference between a process and a thread.",
            "Design a URL shortener system like Bit.ly.",
            "How would you optimize a slow SQL query?",
            "Implement a debouncer function from scratch."
        ],
        behavioral_questions: [
            "Tell me about a time you disagreed with a manager.",
            "Describe a complex project you delivered under a tight deadline.",
            "What is your greatest weakness?",
            "Tell me about a time you mentored a junior engineer."
        ],
        red_flags_to_watch: [
            "High turnover in the engineering department.",
            "Vague answers about 'work-life balance'.",
            "Legacy codebase with no migration plan.",
            "Interviewers seem stressed or distracted."
        ],
        interviewer_insights: [
            {
                role: "Hiring Manager",
                name_archetype: "The Pragmatist",
                focus_area: "Delivery & Team Fit",
                tip: "Focus on impact and how you unblock others. Show you can ship."
            },
            {
                role: "Senior Engineer",
                name_archetype: "The Craftsman",
                focus_area: "Code Quality & System Design",
                tip: "Be ready to defend your trade-offs. Don't hand-wave complexity."
            }
        ],
        evaluation_criteria: [
            {
                dimension: "Technical Proficiency",
                weight: "High",
                description: "Ability to write clean, performant, and maintainable code."
            },
            {
                dimension: "System Design",
                weight: "High",
                description: "Ability to architect scalable systems and understand trade-offs."
            },
            {
                dimension: "Communication",
                weight: "Medium",
                description: "Ability to explain complex concepts clearly."
            }
        ]
    };
};
