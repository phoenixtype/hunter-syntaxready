import { CandidateProfile } from '@/lib/resume_engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Briefcase,
    GraduationCap,
    Code2,
    ExternalLink,
    Search,
    FileDown
} from 'lucide-react';
import { toast } from 'sonner';

interface ResumePreviewProps {
    profile: CandidateProfile;
    initialJobsFound?: number;
}

export const ResumePreview = ({ profile }: ResumePreviewProps) => {
    const _activeTab = 'overview';

    const { identity, skills, experience_atoms: experience, education } = profile;

    const handleFindJobs = () => {
        toast.info('Searching for matching jobs...', {
            description: `Analyzing ${skills.length} skills and ${experience.length} roles`
        });
        // This will be connected to the job search engine
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-card border rounded-md shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        {identity.name}
                        {profile.identity.links?.map((link, i) => (
                            <a
                                key={i}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        ))}
                    </h2>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <span className="text-sm">{identity.email}</span>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(profile.resume_file_url!, '_blank')}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Original PDF
                    </Button>
                    <Button onClick={handleFindJobs} size="sm">
                        <Search className="h-4 w-4 mr-2" />
                        Find Matching Jobs
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Skills & Quick Stats */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Code2 className="h-5 w-5 text-primary" />
                                Top Skills
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {skills
                                    .sort((a, b) => b.proficiency - a.proficiency)
                                    .map((skill, idx) => (
                                        <Badge
                                            key={idx}
                                            variant={skill.proficiency > 0.8 ? "default" : "secondary"}
                                            className="cursor-help"
                                            title={`Proficiency: ${(skill.proficiency * 100).toFixed(0)}%`}
                                        >
                                            {skill.name}
                                        </Badge>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-primary" />
                                Education
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {education.map((edu, idx) => (
                                <div key={idx} className="border-l-2 border-muted pl-4 py-1">
                                    <h4 className="font-semibold text-sm">{edu.school}</h4>
                                    <p className="text-sm text-muted-foreground">{edu.degree}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{edu.year}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Experience Timeline */}
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-primary" />
                                Experience History
                            </CardTitle>
                            <CardDescription>
                                AI-extracted roles and key achievements
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[600px] pr-4">
                                <div className="space-y-8">
                                    {experience.map((role, idx) => (
                                        <div key={role.id || idx} className="relative pl-6 border-l border-border hover:border-primary/50 transition-colors">
                                            <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />

                                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2">
                                                <h3 className="font-semibold text-lg text-foreground">
                                                    {role.role}
                                                </h3>
                                                <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                    {role.duration}
                                                </span>
                                            </div>

                                            <div className="text-sm font-medium text-primary mb-2">
                                                {role.company}
                                            </div>

                                            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                                                {role.content}
                                            </p>

                                            {role.keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {role.keywords.slice(0, 5).map((k, i) => (
                                                        <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border">
                                                            {k}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
