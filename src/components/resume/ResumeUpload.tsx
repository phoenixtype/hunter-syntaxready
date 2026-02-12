import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { extractTextFromFile, CandidateProfile, ResumeParseError } from '@/lib/resume_engine';
import { parseResumeHeuristic, toATSFormat } from '@/lib/resume_parser';
import { ATSResumeData } from '@/lib/ats_types';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { saveCandidateProfile } from '@/lib/resume_engine';

interface ResumeUploadProps {
    onUploadComplete: (profile: CandidateProfile) => void;
    onATSDataExtracted?: (data: ATSResumeData) => void;
}

export const ResumeUpload = ({ onUploadComplete, onATSDataExtracted }: ResumeUploadProps) => {
    const { user } = useAuth();
    const { ensureValidSession } = useSession();

    // Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState<'idle' | 'reading' | 'parsing' | 'complete' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);



    const processFile = useCallback(async (file: File) => {
        setIsUploading(true);
        setUploadStep('reading');
        setProgress(10);
        setErrorMsg(null);

        console.log('[UPLOAD] ==========================================');
        console.log('[UPLOAD] Starting file processing:', file.name);
        console.log('[UPLOAD] File type:', file.type);
        console.log('[UPLOAD] File size:', file.size, 'bytes');

        try {
            // 1. Text Extraction (Client Side)
            console.log('[UPLOAD] Extracting text from PDF...');
            const text = await extractTextFromFile(file);
            console.log('[UPLOAD] Text extraction complete');
            console.log('[UPLOAD] Extracted text length:', text?.length || 0);
            console.log('[UPLOAD] First 300 chars:', text?.substring(0, 300) || '(empty)');
            setProgress(40);

            // 2. Heuristic Parsing (Instant, No AI Cost)
            setUploadStep('parsing');
            console.log('[UPLOAD] Starting heuristic parsing...');
            const heuristicProfile = parseResumeHeuristic(text);
            console.log('[UPLOAD] Parsing complete, profile:', heuristicProfile.identity);

            // 3. Convert to ATS Format (Standardized JSON for form auto-fill)
            const atsData = toATSFormat(heuristicProfile);
            console.log('[ATS] ==========================================');
            console.log('[ATS] Standardized ATS Resume Data:');
            console.log(JSON.stringify(atsData, null, 2));
            console.log('[ATS] ==========================================');

            console.warn('[UPLOAD] Extracted data:', atsData);

            // Set basic metadata
            heuristicProfile.resume_file_url = "";

            setProgress(100);
            setUploadStep('complete');

            // 4. Complete - call both callbacks
            console.log('[UPLOAD] Calling onUploadComplete with profile');
            onUploadComplete(heuristicProfile);

            // Call ATS callback if provided
            if (onATSDataExtracted) {
                onATSDataExtracted(atsData);
            }

            // Show extracted data in toast for visibility
            const extractedInfo = [
                atsData.fullName,
                atsData.email,
                atsData.skills.length > 0 ? `${atsData.skills.length} skills` : null
            ].filter(Boolean).join(' • ');


            toast.success(`Resume parsed: ${extractedInfo || 'Check console for details'}`);

            setIsUploading(false);
            setUploadStep('complete');
            setProgress(100);
            console.log('[UPLOAD] ==========================================');

        } catch (error) {
            console.error("[UPLOAD] Error:", error);
            setUploadStep('error');
            setErrorMsg(error instanceof Error ? error.message : "Failed to process resume");
            setIsUploading(false);
        }
    }, [onUploadComplete, onATSDataExtracted]);

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
                        className={`group relative p-10 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
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


        </>
    );
};
