import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CandidateProfile } from "@/lib/resume_engine";
import { exportResumeToPdf, exportResumeToDocx } from "@/lib/pdf_export";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileDown, Trash2, FileText, Building2, Loader2, Calendar, Copy, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import PageHeader from "@/components/PageHeader";

interface TailoredResume {
  id: string;
  job_title: string;
  company: string;
  job_url: string | null;
  cover_letter: string;
  changes_summary: string[];
  tailored_profile: CandidateProfile;
  created_at: string;
}

const TailoredResumes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<TailoredResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (!user) return;
    fetchResumes();
  }, [user]);

  const fetchResumes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tailored_resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load saved resumes");
    } else {
      setResumes((data || []) as unknown as TailoredResume[]);
    }
    setLoading(false);
  };

  const handleDownloadPdf = (resume: TailoredResume) => {
    const name = `${resume.job_title}_${resume.company}`.replace(/[^a-z0-9_]/gi, "_");
    exportResumeToPdf(resume.tailored_profile, `${name}_resume.pdf`);
    toast.success("PDF downloaded");
  };

  const handleDownloadDocx = async (resume: TailoredResume) => {
    const name = `${resume.job_title}_${resume.company}`.replace(/[^a-z0-9_]/gi, "_");
    await exportResumeToDocx(resume.tailored_profile, `${name}_resume.docx`);
    toast.success("Word document downloaded");
  };

  const handleCopyCoverLetter = async (resume: TailoredResume) => {
    await navigator.clipboard.writeText(resume.cover_letter);
    setCopiedId(resume.id);
    toast.success("Cover letter copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase
      .from("tailored_resumes")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete");
    } else {
      setResumes((prev) => prev.filter((r) => r.id !== deleteId));
      toast.success("Resume deleted");
    }
    setDeleteId(null);
  };

  const totalPages = Math.ceil(resumes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedResumes = resumes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Tailored Resumes" },
          ]}
        />

        <h1 className="text-2xl font-bold tracking-tight">My Tailored Resumes</h1>
        <p className="text-sm text-muted-foreground">
          All your optimized resumes and cover letters, saved and ready to download.
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No tailored resumes yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Use the "Tailor" button on any job card or the "Optimize for Job" tool to generate your first optimized resume.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedResumes.map((resume) => (
              <Card key={resume.id} className="overflow-hidden hover:border-primary/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{resume.job_title}</h3>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <Building2 className="w-3 h-3 mr-1" />
                          {resume.company}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(resume.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        {resume.job_url && (
                          <a
                            href={resume.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate max-w-[200px]"
                          >
                            View job listing
                          </a>
                        )}
                      </div>

                      {resume.changes_summary.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {resume.changes_summary.slice(0, 3).map((change, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                              <span>{change}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" className="gap-1.5">
                            <FileDown className="w-3.5 h-3.5" />
                            Download
                            <ChevronDown className="w-3 h-3 opacity-70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownloadPdf(resume)}>
                            <FileText className="w-3.5 h-3.5 mr-2 text-red-500" />
                            Download as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadDocx(resume)}>
                            <FileText className="w-3.5 h-3.5 mr-2 text-blue-500" />
                            Download as DOCX
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyCoverLetter(resume)}
                        className="gap-1.5"
                      >
                        {copiedId === resume.id ? (
                          <><Check className="w-3.5 h-3.5" />Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" />Cover Letter</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(resume.id)}
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pt-6 pb-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const page = i + 1;
                      // Show first page, last page, current page, and pages immediately surrounding current
                      if (
                        page === 1 || 
                        page === totalPages || 
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink 
                              href="#"
                              isActive={currentPage === page}
                              onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      // Show ellipsis for gaps
                      if (
                        (page === 2 && currentPage > 3) ||
                        (page === totalPages - 1 && currentPage < totalPages - 2)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tailored resume?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this optimized resume and cover letter. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TailoredResumes;
