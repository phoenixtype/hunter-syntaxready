import { RecruiterPaywall } from "@/components/recruiter/RecruiterPaywall";

const STATUS_COLORS: Record<JobStatus, string> = {
// ...
const MyJobs = () => {
  // ...
  return (
    <RecruiterPaywall>
      <div className="flex flex-col min-h-screen">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
          <h1 className="text-base font-semibold">My Job Listings</h1>
          <Button onClick={() => navigate("/recruiter/post-job")} className="rounded-full shadow-md-1 gap-2">
            <Plus className="w-4 h-4" /> Post a Job
          </Button>
        </header>

        {/* ... remaining content ... */}
      </div>
    </RecruiterPaywall>
  );
};

export default MyJobs;

const MyJobs = () => {
  const navigate = useNavigate();
  const { jobs, loading, refresh } = useMyJobs();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | JobStatus>("all");
  const [actioning, setActioning] = useState<string | null>(null);

  const filtered = jobs.filter((j) => {
    const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || j.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleToggleStatus = async (job: RecruiterJob) => {
    setActioning(job.id);
    try {
      const newStatus: JobStatus = job.status === "active" ? "paused" : "active";
      await updateJob(job.id, { status: newStatus });
      toast.success(newStatus === "active" ? "Job is now live!" : "Job paused.");
      refresh();
    } catch {
      toast.error("Failed to update job status");
    } finally {
      setActioning(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    setActioning(jobId);
    try {
      await deleteJob(jobId);
      toast.success("Job deleted.");
      refresh();
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setActioning(null);
    }
  };

  const handleMarkFilled = async (job: RecruiterJob) => {
    setActioning(job.id);
    try {
      await updateJob(job.id, { status: "filled" });
      toast.success("Position marked as filled.");
      refresh();
    } catch {
      toast.error("Failed to update job");
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
        <h1 className="text-base font-semibold">My Job Listings</h1>
        <Button onClick={() => navigate("/recruiter/post-job")} className="rounded-full shadow-md-1 gap-2">
          <Plus className="w-4 h-4" /> Post a Job
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search listings…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | JobStatus)}>
            <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(JOB_STATUS_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary counts */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{jobs.filter((j) => j.status === "active").length} active</span>
          <span>·</span>
          <span>{jobs.filter((j) => j.status === "draft").length} drafts</span>
          <span>·</span>
          <span>{jobs.reduce((s, j) => s + j.application_count, 0)} total applicants</span>
        </div>

        {/* Jobs list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-muted/50 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{search || filterStatus !== "all" ? "No listings match your filters" : "No job listings yet"}</p>
            {!search && filterStatus === "all" && (
              <Button onClick={() => navigate("/recruiter/post-job")} className="rounded-full mt-1 gap-2">
                <Plus className="w-4 h-4" /> Post your first job
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <div key={job.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => navigate(`/recruiter/jobs/${job.id}`)}
                        className="font-semibold text-sm hover:text-primary transition-colors text-left"
                      >
                        {job.title}
                      </button>
                      <Badge className={`text-xs rounded-full font-normal ${STATUS_COLORS[job.status]}`}>
                        {JOB_STATUS_LABELS[job.status]}
                      </Badge>
                    </div>

                    {/* Meta */}
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.company} · {job.location || "No location"} · {LOCATION_TYPE_LABELS[job.location_type]} · {EMPLOYMENT_TYPE_LABELS[job.employment_type]}
                    </p>

                    {/* Salary + tech */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">{formatSalary(job)}</span>
                      {(job.tech_stack ?? []).slice(0, 4).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs rounded-full py-0">{t}</Badge>
                      ))}
                      {(job.tech_stack ?? []).length > 4 && (
                        <span className="text-xs text-muted-foreground">+{(job.tech_stack ?? []).length - 4} more</span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{job.application_count} applicants</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{job.view_count} views</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-xs gap-1.5 text-primary hover:bg-primary/10"
                      onClick={() => navigate(`/recruiter/jobs/${job.id}`)}
                    >
                      <Users className="w-3.5 h-3.5" /> Applicants
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      title="Edit job"
                      onClick={() => navigate(`/recruiter/jobs/${job.id}/edit`)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    {(job.status === "active" || job.status === "paused" || job.status === "draft") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        title={job.status === "active" ? "Pause listing" : "Activate listing"}
                        disabled={actioning === job.id}
                        onClick={() => handleToggleStatus(job)}
                      >
                        {job.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                    )}

                    {job.status === "active" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full text-green-600 hover:bg-green-50"
                        title="Mark as filled"
                        disabled={actioning === job.id}
                        onClick={() => handleMarkFilled(job)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="rounded-full text-destructive/70 hover:bg-destructive/10 hover:text-destructive" title="Delete listing">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{job.title}</strong> and remove it from the candidate job feed. All received applications will also be removed. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="rounded-full bg-destructive hover:bg-destructive/90"
                            onClick={() => handleDelete(job.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyJobs;
