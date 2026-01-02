import { CandidateProfile } from "./resume_engine";

export interface VisibilityScore {
    totalScore: number;
    atsPassRate: number;
    recruiterAppeal: number;
    signalStrength: number;
    breakdown: {
        category: string;
        score: number;
        feedback: string;
    }[];
    recommendations: string[];
}

export const calculateVisibilityScore = async (profile?: CandidateProfile | null): Promise<VisibilityScore> => {
    // If no profile, return base scores
    if (!profile) {
        return {
            totalScore: 0,
            atsPassRate: 0,
            recruiterAppeal: 0,
            signalStrength: 0,
            breakdown: [
                { category: "Profile Status", score: 0, feedback: "No resume detected. Upload a resume to activate scoring." }
            ],
            recommendations: ["Upload your resume for AI visibility analysis."]
        };
    }

    // Heuristic-based dynamic scoring
    const skillCount = profile.skills?.length || 0;
    const expCount = profile.experience_atoms?.length || 0;
    const hasLinks = profile.identity?.links?.length > 0;
    const hasEmail = profile.identity?.email ? true : false;

    const atsScore = Math.min(100, (skillCount * 10) + (expCount * 5));
    const appealScore = Math.min(100, 50 + (hasLinks ? 20 : 0) + (expCount * 10));
    const signalScore = Math.min(100, 40 + (skillCount * 5) + (hasEmail ? 10 : 0));

    const avgScore = Math.round((atsScore + appealScore + signalScore) / 3);

    const breakdown = [
        {
            category: "Keyword Density",
            score: atsScore,
            feedback: skillCount > 5 
                ? "Excellent keyword coverage across target domains." 
                : "Low keyword count. Add more specific tech stack or hard skills."
        },
        {
            category: "Role Depth",
            score: appealScore,
            feedback: expCount >= 3 
                ? "Experience timeline shows strong progression." 
                : "Brief experience history. Highlight projects or certifications to compensate."
        }
    ];

    const recommendations = [];
    if (skillCount < 5) recommendations.push("Add at least 5-8 specific skills to improve ATS indexing.");
    if (expCount < 2) recommendations.push("Flesh out project experience to show depth.");
    if (!profile.identity?.email) recommendations.push("Ensure contact details are clear for recruiters.");

    return {
        totalScore: avgScore,
        atsPassRate: atsScore,
        recruiterAppeal: appealScore,
        signalStrength: signalScore,
        breakdown,
        recommendations: recommendations.length > 0 ? recommendations : ["Your profile is highly optimized for the current market."]
    };
};
