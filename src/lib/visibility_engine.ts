import { CandidateProfile } from "./resume_engine";
import { UserPreferences } from "./user_preferences";

export interface VisibilityScore {
    totalScore: number;
    atsPassRate: number;
    recruiterAppeal: number;
    signalStrength: number;
    completeness: number;
    roleFitLikelihood: number;
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
    // Role fit detail for UI display
    roleFitDetail: {
        targetRoles: string[];
        alignedKeywords: string[];
        missingKeywords: string[];
        levelMatch: boolean;
        summaryMentionsRole: boolean;
    };
}

export interface CoachAdvice {
    type: 'quick_win' | 'strategic' | 'network';
    title: string;
    description: string;
    actionLabel: string;
    actionRoute?: string;
}

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'at', 'to', 'or', 'a', 'an']);

function extractRoleKeywords(roles: string[]): string[] {
    return [...new Set(
        roles.flatMap(role =>
            role.toLowerCase().split(/[\s\-\/,]+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
        )
    )];
}

export const calculateVisibilityScore = async (
    profile?: CandidateProfile | null,
    preferences?: UserPreferences | null
): Promise<VisibilityScore> => {
    const emptyRoleFitDetail = { targetRoles: [], alignedKeywords: [], missingKeywords: [], levelMatch: false, summaryMentionsRole: false };

    if (!profile) {
        return {
            totalScore: 0,
            atsPassRate: 0,
            recruiterAppeal: 0,
            signalStrength: 0,
            completeness: 0,
            roleFitLikelihood: 0,
            breakdown: [
                { category: "Profile Status", score: 0, feedback: "No profile detected. Build your profile to activate scoring." }
            ],
            recommendations: ["Complete your profile using the Resume Builder for AI visibility analysis."],
            roleFitDetail: emptyRoleFitDetail,
        };
    }

    const identity = profile.identity;
    const skills = profile.skills || [];
    const atoms = profile.experience_atoms || [];
    const education = profile.education || [];

    // 1. Completeness Score
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

    // 2. ATS Pass Rate
    const skillDensity = Math.min(100, skills.length * 8);
    const detailDensity = Math.min(100, atoms.reduce((acc, curr) => acc + (curr.content?.length || 0), 0) / 10);
    const atsScore = Math.round((skillDensity * 0.6) + (detailDensity * 0.4));

    // 3. Recruiter Appeal
    const hasGitHub = identity.links.some(l => l.toLowerCase().includes('github.com'));
    const hasLinkedIn = identity.links.some(l => l.toLowerCase().includes('linkedin.com'));
    const hasPortfolio = identity.links.some(l => !l.includes('linkedin') && !l.includes('github'));

    let appealScore = 40;
    if (atoms.length >= 3) appealScore += 20;
    if (hasLinkedIn) appealScore += 15;
    if (hasGitHub || hasPortfolio) appealScore += 15;
    if (profile.summary && profile.summary.length > 100) appealScore += 10;
    appealScore = Math.min(100, appealScore);

    // 4. Signal Strength
    const highValueSkills = ['ai', 'llm', 'react', 'typescript', 'python', 'aws', 'rust', 'go', 'senior', 'lead', 'architect', 'machine learning', 'devops', 'kubernetes'];
    const signalMatches = skills.filter(s => highValueSkills.some(h => s.name.toLowerCase().includes(h))).length;
    const signalScore = Math.min(100, 30 + (signalMatches * 12) + (completeness * 0.15));

    // 5. Market Fit (legacy dimension — blend of ATS + signal)
    const marketFit = Math.min(100, (atsScore * 0.4) + (signalScore * 0.6));

    // 6. Role Fit Likelihood — probability of being found AND selected for target roles
    const targetRoles = preferences?.target_roles || [];
    const targetLevel = preferences?.experience_level || "mid";
    const remotePolicy = preferences?.remote_policy || "any";

    let roleFitScore = 0;
    let alignedKeywords: string[] = [];
    let missingKeywords: string[] = [];
    let summaryMentionsRole = false;
    let levelMatch = false;

    if (targetRoles.length === 0) {
        // No target roles defined — cannot measure fit
        roleFitScore = 20;
    } else {
        const roleKeywords = extractRoleKeywords(targetRoles);
        const skillNames = skills.map(s => s.name.toLowerCase());
        const expContent = atoms.map(a => `${a.role} ${a.content}`).join(' ').toLowerCase();
        const summaryLower = (profile.summary || '').toLowerCase();
        const fullText = `${skillNames.join(' ')} ${expContent} ${summaryLower}`;

        // 1. Skill/experience keyword alignment with role titles (max 35 pts)
        alignedKeywords = roleKeywords.filter(kw => fullText.includes(kw));
        missingKeywords = roleKeywords.filter(kw => !fullText.includes(kw));
        const alignmentRate = roleKeywords.length > 0 ? alignedKeywords.length / roleKeywords.length : 0;
        roleFitScore += Math.round(alignmentRate * 35);

        // 2. Experience level alignment (max 25 pts)
        const expLevelMap: Record<string, number> = { intern: 0, entry: 1, mid: 2, senior: 3, lead: 4 };
        const targetLevelNum = expLevelMap[targetLevel] ?? 2;
        const hasSeniorKeyword = atoms.some(a => /senior|lead|principal|staff|director|vp|head/i.test(a.role));
        const actualLevelNum = hasSeniorKeyword ? 3 : atoms.length >= 5 ? 3 : atoms.length >= 3 ? 2 : atoms.length >= 1 ? 1 : 0;
        const levelDiff = Math.abs(targetLevelNum - actualLevelNum);
        levelMatch = levelDiff <= 1;
        roleFitScore += levelDiff === 0 ? 25 : levelDiff === 1 ? 15 : levelDiff === 2 ? 5 : 0;

        // 3. Summary specificity to target roles (max 20 pts)
        summaryMentionsRole = roleKeywords.some(kw => summaryLower.includes(kw));
        if (summaryMentionsRole) roleFitScore += 20;
        else if (summaryLower.length > 50) roleFitScore += 5;

        // 4. Location / remote readiness (max 10 pts)
        const isRemoteOpen = remotePolicy === 'remote' || remotePolicy === 'any';
        const hasLocation = !!identity.location || (preferences?.locations?.length ?? 0) > 0;
        if (isRemoteOpen || hasLocation) roleFitScore += 10;

        // 5. Profile completeness for discoverability (max 10 pts)
        if (completeness >= 80) roleFitScore += 10;
        else if (completeness >= 60) roleFitScore += 5;
    }

    roleFitScore = Math.min(100, Math.round(roleFitScore));

    // Total: weighted blend of all six dimensions
    const totalScore = Math.round(
        (atsScore * 0.22) +
        (appealScore * 0.18) +
        (signalScore * 0.15) +
        (completeness * 0.10) +
        (marketFit * 0.10) +
        (roleFitScore * 0.25)
    );

    const radarData = [
        { subject: 'ATS Indexing', A: atsScore, fullMark: 100 },
        { subject: 'Recruiter Appeal', A: appealScore, fullMark: 100 },
        { subject: 'Signal Strength', A: signalScore, fullMark: 100 },
        { subject: 'Completeness', A: completeness, fullMark: 100 },
        { subject: 'Market Fit', A: marketFit, fullMark: 100 },
        { subject: 'Role Fit', A: roleFitScore, fullMark: 100 },
    ];

    const breakdown = [
        {
            category: "Completeness",
            score: completeness,
            feedback: completeness > 80
                ? "Your profile is comprehensive and professional."
                : "Missing key sections. Recruiters prefer fully populated profiles."
        },
        {
            category: "ATS Indexing",
            score: atsScore,
            feedback: atsScore > 75
                ? "Excellent keyword density for search engines."
                : "Add more specific technical skills to improve discovery."
        },
        {
            category: "Recruiter Appeal",
            score: appealScore,
            feedback: appealScore > 70
                ? "Strong social proof and career narrative detected."
                : "Strengthen your summary and add professional links."
        },
        {
            category: "Role Fit Likelihood",
            score: roleFitScore,
            feedback: targetRoles.length === 0
                ? "Set target roles in your Job Preferences to activate role fit analysis."
                : roleFitScore >= 70
                    ? `Strong alignment with your target roles (${targetRoles.slice(0, 2).join(', ')}${targetRoles.length > 2 ? '…' : ''}).`
                    : `Your profile partially aligns with "${targetRoles[0]}"${missingKeywords.length > 0 ? `. Missing keywords: ${missingKeywords.slice(0, 3).join(', ')}` : ''}.`
        },
    ];

    const recommendations: string[] = [];
    if (completeness < 100) recommendations.push("Fill out all profile sections to reach 100% completeness.");
    if (skills.length < 12) recommendations.push("Add more niche technical skills to rank higher in specialised searches.");
    if (!hasLinkedIn) recommendations.push("Add your LinkedIn profile to increase credibility by 70%.");
    if (atoms.some(a => a.content.length < 60)) recommendations.push("Deepen your impact narrative in your work history.");
    if (signalScore < 60) recommendations.push("Add high-velocity skills like AI, Cloud, or Architecture to boost signal strength.");
    if (targetRoles.length === 0) recommendations.push("Set your target job titles in Job Preferences so Hunter can calculate your role fit likelihood.");
    if (targetRoles.length > 0 && !summaryMentionsRole) recommendations.push(`Tailor your summary to mention your target roles (${targetRoles.slice(0, 2).join(', ')}) to improve selection rates.`);
    if (missingKeywords.length > 0) recommendations.push(`Add skills or experience related to: ${missingKeywords.slice(0, 4).join(', ')} to close your role fit gap.`);

    return {
        totalScore,
        atsPassRate: atsScore,
        recruiterAppeal: appealScore,
        signalStrength: signalScore,
        completeness,
        roleFitLikelihood: roleFitScore,
        radarData,
        breakdown,
        recommendations: recommendations.length > 0 ? recommendations : ["Your profile is performing at peak visibility levels."],
        roleFitDetail: {
            targetRoles,
            alignedKeywords,
            missingKeywords,
            levelMatch,
            summaryMentionsRole,
        },
    };
};

export const getCoachAdvice = async (
    profile: CandidateProfile,
    score: VisibilityScore,
    preferences?: UserPreferences | null
): Promise<CoachAdvice[]> => {
    const advice: CoachAdvice[] = [];
    const identity = profile.identity;

    // Quick Wins
    if (score.completeness < 90) {
        advice.push({
            type: 'quick_win',
            title: 'Close the Completeness Gap',
            description: "You're missing a few key details that prevent you from appearing in \"complete-only\" recruiter filters.",
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
            actionRoute: '/dashboard'
        });
    }

    // Role fit advice
    const targetRoles = preferences?.target_roles || score.roleFitDetail.targetRoles;
    if (targetRoles.length === 0) {
        advice.push({
            type: 'quick_win',
            title: 'Define Your Target Roles',
            description: "You haven't set target job titles yet. Without them Hunter can't calculate your role fit or personalise your job feed.",
            actionLabel: 'Set Target Roles',
            actionRoute: '/auto-applier-settings'
        });
    } else if (score.roleFitLikelihood < 60) {
        const missing = score.roleFitDetail.missingKeywords.slice(0, 3).join(', ');
        advice.push({
            type: 'strategic',
            title: `Strengthen Fit for "${targetRoles[0]}"`,
            description: `Your profile is missing key signals for your target role${missing ? `: ${missing}` : ''}. Adding these to your skills and summary significantly improves selection rates.`,
            actionLabel: 'Update Profile',
            actionRoute: '/resume-builder'
        });
    }

    if (targetRoles.length > 0 && !score.roleFitDetail.summaryMentionsRole) {
        advice.push({
            type: 'strategic',
            title: 'Tailor Your Summary to Target Roles',
            description: `Your professional summary doesn't reference your target roles (${targetRoles.slice(0, 2).join(', ')}). A targeted summary can increase recruiter response rates by up to 40%.`,
            actionLabel: 'Edit Summary',
            actionRoute: '/resume-builder'
        });
    }

    // Strategic
    if (score.atsPassRate < 70) {
        advice.push({
            type: 'strategic',
            title: 'Optimise for ATS Search',
            description: 'Your keyword density is slightly low. Use the LinkedIn Optimiser to identify high-impact keywords for your target roles.',
            actionLabel: 'Optimise Keywords'
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
            description: "Show, don't just tell. Adding a portfolio or GitHub link significantly boosts trust for technical roles.",
            actionLabel: 'Link Portfolio'
        });
    }

    return advice.slice(0, 4);
};
