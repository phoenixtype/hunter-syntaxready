import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, Send, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { sendRecruiterOutreach, type TalentCandidate, type RecruiterJob } from "@/lib/recruiter_engine";

interface OutreachModalProps {
  candidate: TalentCandidate;
  jobs: RecruiterJob[];
  onClose: () => void;
}

const OutreachModal = ({ candidate, jobs, onClose }: OutreachModalProps) => {
  const activeJobs = jobs.filter(j => j.status === "active");
  const [selectedJobId, setSelectedJobId] = useState<string>(activeJobs[0]?.id ?? "__none__");
  const [sending, setSending] = useState(false);

  const selectedJob = activeJobs.find(j => j.id === selectedJobId);

  const [subject, setSubject] = useState(
    selectedJob
      ? `${selectedJob.company} — Opportunity: ${selectedJob.title}`
      : "Exciting opportunity — let's connect"
  );

  const [message, setMessage] = useState(
    selectedJob
      ? `Hi ${candidate.full_name.split(" ")[0]},\n\nI came across your profile on Hunter and I think you'd be a great fit for our ${selectedJob.title} role at ${selectedJob.company}.\n\n${selectedJob.location_type === "remote" ? "This is a fully remote position." : `Based in ${selectedJob.location ?? selectedJob.company}.`} ${selectedJob.salary_min ? `Compensation is up to $${Math.round(selectedJob.salary_max! / 1000)}k.` : ""}\n\nWould you be open to a quick conversation?\n\nBest regards`
      : `Hi ${candidate.full_name.split(" ")[0]},\n\nI came across your profile on Hunter and was impressed by your background in ${candidate.skills.slice(0, 2).join(" and ")}.\n\nI'd love to connect and share some opportunities that might align with what you're looking for.\n\nWould you be open to a quick call?\n\nBest regards`
  );

  // Update template when job selection changes
  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    const job = activeJobs.find(j => j.id === jobId);
    if (job) {
      setSubject(`${job.company} — Opportunity: ${job.title}`);
      setMessage(
        `Hi ${candidate.full_name.split(" ")[0]},\n\nI came across your profile on Hunter and I think you'd be a great fit for our ${job.title} role at ${job.company}.\n\n${job.location_type === "remote" ? "This is a fully remote position." : `Based in ${job.location ?? job.company}.`} ${job.salary_min ? `Compensation is up to $${Math.round(job.salary_max! / 1000)}k.` : ""}\n\nWould you be open to a quick conversation?\n\nBest regards`
      );
    } else {
      setSubject("Exciting opportunity — let's connect");
      setMessage(
        `Hi ${candidate.full_name.split(" ")[0]},\n\nI came across your profile on Hunter and was impressed by your background in ${candidate.skills.slice(0, 2).join(" and ")}.\n\nI'd love to connect and share some opportunities that might align with what you're looking for.\n\nBest regards`
      );
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    try {
      await sendRecruiterOutreach({
        candidateId: candidate.user_id,
        subject: subject.trim(),
        message: message.trim(),
        jobId: selectedJobId !== "__none__" ? selectedJobId : undefined,
        outreachType: "email",
      });
      toast.success(`Message sent to ${candidate.full_name}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-sm font-semibold flex items-center justify-center">
              {candidate.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Reach out to {candidate.full_name}</p>
              <p className="text-xs text-muted-foreground">{candidate.headline ?? "Candidate"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Job context */}
          {activeJobs.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invite for a role (optional)</Label>
              <Select value={selectedJobId} onValueChange={handleJobChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">General outreach (no specific role)</span>
                  </SelectItem>
                  {activeJobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3 shrink-0" />
                        {j.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-xs text-muted-foreground">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs text-muted-foreground">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="resize-none text-sm min-h-[160px]"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            The candidate will receive this via email. They can reply directly to you.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button size="sm" onClick={handleSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send message
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OutreachModal;
