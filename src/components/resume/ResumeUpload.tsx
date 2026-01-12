import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { extractTextFromFile, CandidateProfile, ResumeParseError } from '@/lib/resume_engine';
import { parseResumeHeuristic } from '@/lib/resume_parser';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { ResumeVerificationWizard } from './ResumeVerificationWizard';

interface ResumeUploadProps {
    onUploadComplete: (profile: CandidateProfile) => void;
}

export const ResumeUpload = ({ onUploadComplete }: ResumeUploadProps) => {
    const { user } = useAuth();
    const { ensureValidSession } = useSession();
    
    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState<'idle' | 'reading' | 'parsing' | 'complete' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [parsedProfile, setParsedProfile] = useState<CandidateProfile | null>(null);

    const processFile = useCallback(async (file: File) => {
        setIsUploading(true);
        setUploadStep('reading');
        setProgress(10);
        setErrorMsg(null);

        try {
            // 1. Text Extraction (Client Side)
            const text = await extractTextFromFile(file);
            setProgress(40);
            
            // 2. Heuristic Parsing (Instant, No AI Cost)
            setUploadStep('parsing');
            const heuristicProfile = parseResumeHeuristic(text);
            
            // Set basic metadata
            heuristicProfile.resume_file_url = ""; // We could upload file here if needed, but keeping it simple
            
            setProgress(100);
            setUploadStep('complete');
            
            // 3. Open Verification Wizard
            setTimeout(() => {
                setParsedProfile(heuristicProfile);
                setShowWizard(true);
                setIsUploading(false); // Reset upload UI behind modal
                setUploadStep('idle');
                setProgress(0);
            }, 500);

        } catch (error) {
            console.error("Upload error:", error);
            setUploadStep('error');
            setErrorMsg(error instanceof Error ? error.message : "Failed to process resume");
            setIsUploading(false);
        }
    }, []);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File too large (Max 10MB)');
            return;
        }
        await processFile(file);
    }, [processFile]);

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
        <>
            <div className="w-full max-w-2xl mx-auto">
                {isUploading || uploadStep === 'error' ? (
                    <div className="p-8 border-2 border-dashed rounded-xl border-primary/20 bg-muted/30 text-center space-y-4 animate-in fade-in zoom-in-95 leading-relaxed">
                         <div className="flex justify-center mb-4">
                            {uploadStep === 'error' ? (
                                <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                                    <Wand2 className="h-6 w-6" />
                                </div>
                            )}
                         </div>
                         
                         <h3 className="font-semibold text-lg">
                            {uploadStep === 'reading' && "Reading Document..."}
                            {uploadStep === 'parsing' && "Analyzing Structure..."}
                            {uploadStep === 'error' && "Upload Failed"}
                            {uploadStep === 'complete' && "Ready for Review!"}
                         </h3>
                         
                         {uploadStep === 'error' ? (
                             <p className="text-red-400 text-sm">{errorMsg}</p>
                         ) : (
                             <Progress value={progress} className="h-2 w-64 mx-auto" />
                         )}
                    </div>
                ) : (
                    <div
                        {...getRootProps()}
                        className={`group relative p-10 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${
                            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                        }`}
                    >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center transition-colors group-hover:bg-primary/10">
                                <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold">Drop resume to analyze</p>
                                <p className="text-sm text-muted-foreground">PDF / DOCX (Max 10MB)</p>
                            </div>
                            <Button variant="secondary" className="pointer-events-none">Select Document</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Wizard Modal */}
            {showWizard && parsedProfile && (
                <ResumeVerificationWizard 
                    isOpen={showWizard}
                    onClose={() => setShowWizard(false)}
                    initialData={parsedProfile}
                    onSave={(finalProfile) => {
                        onUploadComplete(finalProfile);
                        setShowWizard(false);
                    }}
                />
            )}
        </>
    );
};
