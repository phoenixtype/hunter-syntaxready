import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { parseResume, CandidateProfile } from '@/lib/resume_engine';
import { useAuth } from '@/hooks/useAuth';

interface ResumeUploadProps {
    onUploadComplete: (profile: CandidateProfile) => void;
}

export const ResumeUpload = ({ onUploadComplete }: ResumeUploadProps) => {
    const { user } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState<'idle' | 'extracting' | 'uploading' | 'parsing' | 'complete'>('idle');
    const [progress, setProgress] = useState(0);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error('File too large', { description: 'Please upload a file smaller than 10MB' });
            return;
        }

        setIsUploading(true);
        setUploadStep('extracting');
        setProgress(10);

        try {
            // simulate progress for better UX
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 90));
            }, 500);

            toast.info('Starting resume analysis', { description: 'This may take up to 30 seconds...' });

            const profile = await parseResume(file, user?.id);

            clearInterval(progressInterval);
            setProgress(100);
            setUploadStep('complete');
            toast.success('Resume analyzed successfully!');

            // Small delay to show completion state
            setTimeout(() => {
                onUploadComplete(profile);
                setIsUploading(false);
                setUploadStep('idle');
                setProgress(0);
            }, 1000);

        } catch (error) {
            console.error('Upload details:', error);
            setUploadStep('idle');
            setIsUploading(false);
            setProgress(0);

            let errorMessage = 'Failed to process resume';
            let errorDesc = 'Unknown error occurred';

            if (error instanceof Error) {
                errorMessage = error.message;

                // Analyze common Supabase errors
                if (errorMessage.includes('Bucket not found')) {
                    errorDesc = 'Storage bucket "resumes" does not exist. Please run the setup SQL.';
                } else if (errorMessage.includes('Invalid JWT') || errorMessage.includes('401')) {
                    errorDesc = 'Session expired. Please sign out and sign in again.';
                } else if (errorMessage.includes('non 2xx status code')) {
                    errorDesc = 'Server error. Check Edge Function logs.';
                }
            }

            toast.error('Resume Analysis Failed', {
                description: errorDesc,
                duration: 5000,
                action: {
                    label: 'View Logs',
                    onClick: () => console.error(error)
                }
            });
        }
    }, [user, onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        maxFiles: 1,
        disabled: isUploading
    });

    return (
        <div className="w-full max-w-2xl mx-auto">
            {isUploading ? (
                <div className="p-8 border-2 border-dashed rounded-xl border-primary/20 bg-muted/30 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex justify-center">
                        {uploadStep === 'complete' ? (
                            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        ) : (
                            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">
                            {uploadStep === 'extracting' && 'Reading document...'}
                            {uploadStep === 'uploading' && 'Securing file...'}
                            {uploadStep === 'parsing' && 'Analyzing with AI...'}
                            {uploadStep === 'complete' && 'Analysis Complete!'}
                            {uploadStep === 'idle' && 'Processing...'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Extracting skills, experience, and qualifications
                        </p>
                    </div>

                    <Progress value={progress} className="h-2 w-full max-w-sm mx-auto" />
                </div>
            ) : (
                <div
                    {...getRootProps()}
                    className={`
            group relative p-10 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out cursor-pointer
            ${isDragActive
                            ? 'border-primary bg-primary/5 scale-[1.01]'
                            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                        }
          `}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className={`
              h-16 w-16 rounded-full bg-muted flex items-center justify-center transition-colors group-hover:bg-primary/10
            `}>
                            <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>

                        <div className="space-y-1">
                            <p className="text-lg font-semibold text-foreground">
                                Drop your resume here, or click to browse
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Support for PDF & DOCX (Max 10MB)
                            </p>
                        </div>

                        <Button variant="secondary" className="mt-2 pointer-events-none">
                            <FileText className="mr-2 h-4 w-4" />
                            Select Document
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
