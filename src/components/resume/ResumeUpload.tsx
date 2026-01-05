import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { parseResume, CandidateProfile, ResumeParseError } from '@/lib/resume_engine';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';

interface ResumeUploadProps {
    onUploadComplete: (profile: CandidateProfile) => void;
}

// Helper function to get user-friendly error descriptions
const getErrorDescription = (errorCode: string): string => {
    const descriptions: Record<string, string> = {
        'FILE_TOO_LARGE': 'The file exceeds the 10MB size limit. Try compressing your PDF or removing unnecessary images.',
        'INVALID_FILE_TYPE': 'Please upload a PDF or DOCX file. Other formats are not supported.',
        'SESSION_INVALID': 'Your login session has expired. You\'ll need to sign in again to continue.',
        'AUTH_FAILED': 'We couldn\'t verify your identity. Please sign out and sign back in.',
        'EXTRACTION_FAILED': 'We couldn\'t read the PDF file. It may be password-protected, corrupted, or contain only images.',
        'INSUFFICIENT_TEXT': 'The PDF doesn\'t contain enough readable text. Make sure it\'s not a scanned image.',
        'PARSE_FAILED': 'Our AI couldn\'t understand the resume format. Try using a standard resume template with clear sections.',
        'RATE_LIMITED': 'You\'ve made too many requests. Please wait 60 seconds before trying again.',
        'SERVICE_ERROR': 'Our servers are experiencing issues. Please try again in a few moments.',
        'UNKNOWN': 'An unexpected error occurred. Please try again or contact support if the issue persists.'
    };

    return descriptions[errorCode] || descriptions['UNKNOWN'];
};

export const ResumeUpload = ({ onUploadComplete }: ResumeUploadProps) => {
    const { user } = useAuth();
    const { ensureValidSession } = useSession();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState<'idle' | 'validating' | 'extracting' | 'uploading' | 'parsing' | 'complete' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [lastFile, setLastFile] = useState<File | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    const processFile = useCallback(async (file: File) => {
        setLastFile(file);
        setLastError(null);
        setIsUploading(true);
        setUploadStep('validating');
        setProgress(5);

        try {
            // 1. Validate session first
            toast.info('Validating session...', { duration: 1000 });
            const sessionValid = await ensureValidSession();

            if (!sessionValid) {
                throw new ResumeParseError(
                    'SESSION_INVALID',
                    'Your session has expired. Please sign out and sign in again.',
                    'Session validation failed'
                );
            }

            setProgress(10);
            setUploadStep('extracting');

            // 2. Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 90));
            }, 500);

            toast.info('Analyzing resume...', { description: 'This may take up to 30 seconds' });

            // 3. Parse resume
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
                setLastFile(null);
            }, 1000);

        } catch (error) {
            console.error('[UPLOAD] Error:', error);
            setUploadStep('error');
            setIsUploading(false);
            setProgress(0);

            let errorTitle = 'Resume Analysis Failed';
            let errorDesc = 'An unexpected error occurred';
            let actionLabel = 'Retry';

            if (error instanceof ResumeParseError) {
                errorTitle = error.userMessage;
                errorDesc = getErrorDescription(error.code);
                setLastError(error.code);

                // Different action based on error type
                if (error.code === 'SESSION_INVALID' || error.code === 'AUTH_FAILED') {
                    actionLabel = 'Sign Out';
                } else if (error.code === 'RATE_LIMITED') {
                    actionLabel = 'OK';
                }
            } else if (error instanceof Error) {
                errorDesc = error.message;
                setLastError('UNKNOWN');
            }

            toast.error(errorTitle, {
                description: errorDesc,
                duration: 7000,
                action: lastError !== 'RATE_LIMITED' ? {
                    label: actionLabel,
                    onClick: () => {
                        if (lastError === 'SESSION_INVALID' || lastError === 'AUTH_FAILED') {
                            window.location.href = '/login';
                        } else {
                            // Retry
                            processFile(file);
                        }
                    }
                } : undefined
            });
        }
    }, [user, onUploadComplete, ensureValidSession, lastError]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Client-side validation
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File too large', { description: 'Please upload a file smaller than 10MB' });
            return;
        }

        await processFile(file);
    }, [processFile]);

    const handleRetry = useCallback(() => {
        if (lastFile) {
            processFile(lastFile);
        }
    }, [lastFile, processFile]);

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
            {isUploading || uploadStep === 'error' ? (
                <div className="p-8 border-2 border-dashed rounded-xl border-primary/20 bg-muted/30 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex justify-center">
                        {uploadStep === 'complete' ? (
                            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        ) : uploadStep === 'error' ? (
                            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                        ) : (
                            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">
                            {uploadStep === 'validating' && 'Validating session...'}
                            {uploadStep === 'extracting' && 'Reading document...'}
                            {uploadStep === 'uploading' && 'Securing file...'}
                            {uploadStep === 'parsing' && 'Analyzing with AI...'}
                            {uploadStep === 'complete' && 'Analysis Complete!'}
                            {uploadStep === 'error' && 'Upload Failed'}
                            {uploadStep === 'idle' && 'Processing...'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {uploadStep === 'error'
                                ? 'See error details above. Click retry to try again.'
                                : 'Extracting skills, experience, and qualifications'
                            }
                        </p>
                    </div>

                    {uploadStep === 'error' ? (
                        <Button
                            onClick={handleRetry}
                            variant="default"
                            className="mt-4"
                            disabled={!lastFile}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry Upload
                        </Button>
                    ) : (
                        <Progress value={progress} className="h-2 w-full max-w-sm mx-auto" />
                    )}
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
