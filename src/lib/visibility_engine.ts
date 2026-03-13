import { CandidateProfile } from "./resume_engine";
import { supabase } from "@/integrations/supabase/client";

export interface VisibilityScore {
    totalScore: number;
    atsPassRate: number;
    recruiterAppeal: number;
    signalStrength: number;
    completeness: number;
    radarData: {
        subject: string;
        A: number;
        fullMark: number;
    }[];
    breakdown: {
        category: string;
        score: number;
        feedback: string;
    }[];
    recommendations: string[];
}

export interface CoachAdvice {
    type: 'quick_win' | 'strategic' | 'network';
    title: string;
    description: string;
    actionLabel: string;
    actionRoute?: string;
}

export const calculateVisibilityScore = async (profile?: CandidateProfile | null): Promise<VisibilityScore> => {
    if (!profile) {
        return {
            totalScore: 0,
            atsPassRate: 0,
            recruiterAppeal: 0,
            signalStrength: 0,
            completeness: 0,
            breakdown: [
                { category: "Profile Status", score: 0, feedback: "No profile detected. Build your profile to activate scoring." }
            ],
            recommendations: ["Complete your profile using the Resume Builder for AI visibility analysis."]
        };
    }

    const identity = profile.identity;
    const skills = profile.skills || [];
    const atoms = profile.experience_atoms || [];
    const education = profile.education || [];

    // 1. Completeness Score (Base infrastructure)
    const completenessPoints = [
        !!identity.name,
        !!identity.email,
        !!identity.location,
        identity.links.length > 0,
        skills.length >= 5,
        atoms.length >= 2,
        education.length >= 1,
        !!profile.summary
    ];
    const completeness = Math.round((completenessPoints.filter(Boolean).length / completenessPoints.length) * 100);

    // 2. ATS Pass Rate (Keyword density + structure)
    // High weight on skills and atomic experience details
    const skillDensity = Math.min(100, skills.length * 8);
    const detailDensity = Math.min(100, atoms.reduce((acc, curr) => acc + (curr.content?.length || 0), 0) / 10);
    const atsScore = Math.round((skillDensity * 0.6) + (detailDensity * 0.4));

    // 3. Recruiter Appeal (Career progression + signals)
    const hasGitHub = identity.links.some(l => l.toLowerCase().includes('github.com'));
    const hasLinkedIn = identity.links.some(l => l.toLowerCase().includes('linkedin.com'));
    const hasPortfolio = identity.links.some(l => !l.includes('linkedin') && !l.includes('github'));
    
    let appealScore = 40;
    if (atoms.length >= 3) appealScore += 20;
    if (hasLinkedIn) appealScore += 15;
    if (hasGitHub || hasPortfolio) appealScore += 15;
    if (profile.summary && profile.summary.length > 100) appealScore += 10;
    appealScore = Math.min(100, appealScore);

    // 4. Signal Strength (Niche authority + modern stack)
    const highValueSkills = ['ai', 'llm', 'react', 'typescript', 'python', 'aws', 'rust', 'go', 'senior', 'lead', 'architect', 'machine learning', 'devops', 'kubernetes'];
    const signalMatches = skills.filter(s => highValueSkills.some(h => s.name.toLowerCase().includes(h))).length;
    const signalScore = Math.min(100, 30 + (signalMatches * 12) + (completeness * 0.15));

    // 5. Market Fit (Alignment with target roles)
    // This would ideally come from user preferences, simulating for now
    const marketFit = Math.min(100, (atsScore * 0.4) + (signalScore * 0.6));

    const totalScore = Math.round((atsScore * 0.3) + (appealScore * 0.3) + (signalScore * 0.2) + (completeness * 0.1) + (marketFit * 0.1));

    const radarData = [
        { subject: 'ATS Indexing', A: atsScore, fullMark: 100 },
        { subject: 'Recruiter Appeal', A: appealScore, fullMark: 100 },
        { subject: 'Signal Strength', A: signalScore, fullMark: 100 },
        { subject: 'Completeness', A: completeness, fullMark: 100 },
        { subject: 'Market Fit', A: marketFit, fullMark: 100 },
    ];

    const breakdown = [
        {
            category: "Completeness",
            score: completeness,
            feedback: completeness > 80 ? "Your profile is comprehensive and professional." : "Missing key sections. Recruiters prefer fully populated profiles."
        },
        {
            category: "ATS Indexing",
            score: atsScore,
            feedback: atsScore > 75 ? "Excellent keyword density for search engines." : "Add more specific technical skills to improve discovery."
        },
        {
            category: "Recruiter Appeal",
            score: appealScore,
            feedback: appealScore > 70 ? "Strong social proof and career narrative detected." : "Strengthen your summary and add professional links."
        }
    ];

    const recommendations = [];
    if (completeness < 100) recommendations.push("Fill out all profile sections to reach 100% completeness.");
    if (skills.length < 12) recommendations.push("Add more niche technical skills to rank higher in specialized searches.");
    if (!hasLinkedIn) recommendations.push("Add your LinkedIn profile to increase credibility by 70%.");
    if (atoms.some(a => a.content.length < 60)) recommendations.push("Deepen your impact narrative in your work history.");
    if (signalScore < 60) recommendations.push("Add high-velocity skills like AI, Cloud, or Architecture to boost signal strength.");

    return {
        totalScore,
        atsPassRate: atsScore,
        recruiterAppeal: appealScore,
        signalStrength: signalScore,
        completeness,
        radarData,
        breakdown,
        recommendations: recommendations.length > 0 ? recommendations : ["Your profile is performing at peak visibility levels."]
    };
};

export const getCoachAdvice = async (profile: CandidateProfile, score: VisibilityScore): Promise<CoachAdvice[]> => {
    const advice: CoachAdvice[] = [];
    const identity = profile.identity;

    // Quick Wins
    if (score.completeness < 90) {
        advice.push({
            type: 'quick_win',
            title: 'Close the Completeness Gap',
            description: 'You\'re missing a few key details that prevent you from appearing in "complete-only" recruiter filters.',
            actionLabel: 'Finish Profile',
            actionRoute: '/resume-builder'
        });
    }

    if (!identity.links.some(l => l.includes('linkedin.com'))) {
        advice.push({
            type: 'quick_win',
            title: 'Verify Your Identity',
            description: 'Recruiters are 71% more likely to reach out if they can see a verified LinkedIn presence.',
            actionLabel: 'Add LinkedIn',
            actionRoute: '/dashboard' // Link to settings/profile
        });
    }

    // Strategic
    if (score.atsPassRate < 70) {
        advice.push({
            type: 'strategic',
            title: 'Optimize for ATS Search',
            description: 'Your keyword density is slightly low. Use the LinkedIn Optimizer to identify high-impact keywords for your target roles.',
            actionLabel: 'Optimize Keywords'
        });
    }

    if (profile.experience_atoms.length < 3) {
        advice.push({
            type: 'strategic',
            title: 'Build Narrative Depth',
            description: 'A thin experience list can be a red flag. Add smaller projects or freelance work to show continuous activity.',
            actionLabel: 'Add Experience',
            actionRoute: '/resume-builder'
        });
    }

    // Network
    if (!identity.links.some(l => l.includes('github.com') || l.includes('portfolio'))) {
        advice.push({
            type: 'network',
            title: 'Signal Technical Authority',
            description: 'Show, don\'t just tell. Adding a portfolio or GitHub link significantly boosts trust for technical roles.',
            actionLabel: 'Link Portfolio'
        });
    }

    return advice.slice(0, 3); // Return top 3 most relevant items
};
