import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, ExternalLink, Briefcase, LayoutGrid, List as ListIcon, AlertCircle, StickyNote, GripVertical } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getApplicationHistory, ApplicationRecord, updateApplicationStatus } from "@/lib/application_engine";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import PipelineSummary from "./PipelineSummary";
import ApplicationDetailSheet from "./ApplicationDetailSheet";
import ApplicationAnalytics from "./ApplicationAnalytics";

type Stage = "applied" | "interview" | "offer" | "rejected";

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "applied", label: "Applied", color: "bg-primary/10 text-primary border-primary/20" },
  { id: "interview", label: "Interview", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  { id: "offer", label: "Offer", color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
  { id: "rejected", label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const STAGE_STATUS_MAP: Record<Stage, string> = {
  applied: "applied",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
};

const getStage = (status: string): Stage => {
  const s = status.toLowerCase();
  if (s.includes("interview") || s.includes("screening")) return "interview";
  if (s.includes("offer") || s.includes("accepted")) return "offer";
  if (s.includes("reject") || s.includes("failed") || s.includes("declined")) return "rejected";
  return "applied";
};

const safeFormatDistance = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recently";
  return formatDistanceToNow(d, { addSuffix: true });
};

// Droppable column wrapper
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[80px] rounded-lg transition-colors p-1 ${isOver ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
    >
      {children}
    </div>
  );
}

// Draggable card wrapper
function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group/drag">
      <div
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover/drag:opacity-60 transition-opacity z-10"
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

export const ApplicationsView = () => {
  const { session } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list">(() => {
    try { return (localStorage.getItem("hunter_tracker_view") as "board" | "list") || "list"; } catch { return "list"; }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [detailApp, setDetailApp] = useState<ApplicationRecord | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchHistory = async () => {
    if (session?.user?.id) {
      try {
        const history = await getApplicationHistory(session.user.id);
        setApplications(history);
        setError(false);
      } catch (e) {
        console.error("Failed to load applications", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const toggleViewMode = (mode: "board" | "list") => {
    setViewMode(mode);
    try { localStorage.setItem("hunter_tracker_view", mode); } catch { /* ignore */ }
  };

  const handleSaveNote = async (appId: string) => {
    try {
      await updateApplicationStatus(appId, applications.find(a => a.id === appId)?.status || "applied", noteInput);
      setApplications(prev => prev.map(app => app.id === appId ? { ...app, notes: noteInput } : app));
      setEditingNoteId(null);
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [session?.user?.id]);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      await updateApplicationStatus(appId, newStatus);
      setApplications(prev =>
        prev.map(app => app.id === appId ? { ...app, status: newStatus } : app)
      );
      toast.success(`Status updated to "${newStatus}"`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  // DnD handler
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const appId = active.id as string;
    const targetStage = over.id as Stage;

    if (!STAGES.find(s => s.id === targetStage)) return;

    const app = applications.find(a => a.id === appId);
    if (!app) return;

    const currentStage = getStage(app.status);
    if (currentStage === targetStage) return;

    const newStatus = STAGE_STATUS_MAP[targetStage];
    handleStatusChange(appId, newStatus);
  };

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach(s => {
      counts[s.id] = applications.filter(a => getStage(a.status) === s.id).length;
    });
    return counts;
  }, [applications]);

  const draggedApp = activeId ? applications.find(a => a.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <h3 className="font-semibold mb-1">Failed to load applications</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          There was a problem fetching your application history. Check your connection and try again.
        </p>
        <button onClick={fetchHistory} className="text-sm text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const grouped = STAGES.map(stage => ({
    ...stage,
    apps: applications.filter(app => getStage(app.status) === stage.id),
  }));

  const renderCard = (app: ApplicationRecord, isDragOverlay = false) => (
    <div
      className={`p-4 rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all ${isDragOverlay ? "shadow-lg ring-2 ring-primary/20" : ""} ${!isDragOverlay ? "pl-7" : ""}`}
    >
      <div
        className="flex items-start justify-between gap-2 mb-2 cursor-pointer"
        onClick={() => !isDragOverlay && setDetailApp(app)}
      >
        <div className="min-w-0">
          <h4 className="text-sm font-medium truncate">{app.job_title}</h4>
          <p className="text-xs text-muted-foreground truncate">{app.company}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {safeFormatDistance(app.applied_at)}
        </span>
      </div>

      {/* Notes */}
      {editingNoteId === app.id ? (
        <div className="mt-2 space-y-1">
          <textarea
            autoFocus
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            placeholder="Add a note..."
            className="w-full text-xs bg-muted border border-border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
          />
          <div className="flex gap-1.5">
            <button onClick={() => handleSaveNote(app.id)} className="text-[10px] text-primary font-medium hover:underline">Save</button>
            <button onClick={() => setEditingNoteId(null)} className="text-[10px] text-muted-foreground hover:underline">Cancel</button>
          </div>
        </div>
      ) : app.notes ? (
        <p className="mt-2 text-[10px] text-muted-foreground line-clamp-2 italic cursor-pointer hover:text-foreground" onClick={() => { setEditingNoteId(app.id); setNoteInput(app.notes || ""); }}>
          {app.notes}
        </p>
      ) : null}

      <div className="flex items-center justify-between mt-3 gap-2">
        <Select
          value={app.status}
          onValueChange={(val) => handleStatusChange(app.id, val)}
        >
          <SelectTrigger className="h-7 text-[10px] w-auto min-w-[100px] border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="screening">Screening</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditingNoteId(app.id); setNoteInput(app.notes || ""); }}
            className="p-1 text-muted-foreground hover:text-primary transition-colors"
            title="Add note"
          >
            <StickyNote className="w-3 h-3" />
          </button>
          {app.job_url && (
            <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="p-1 text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Job Tracker</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length > 0
              ? `Tracking ${applications.length} role${applications.length > 1 ? "s" : ""} · ${viewMode === "board" ? "drag cards between columns" : "click a status to update"}`
              : "Mark jobs as applied from the Jobs tab to start tracking"}
          </p>
        </div>
        
        {applications.length > 0 && (
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50">
            <Button
              variant={viewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => toggleViewMode("board")}
              className={`h-8 px-3 text-xs ${viewMode === "board" ? "shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
              Board
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { toggleViewMode("list"); setCurrentPage(1); }}
              className={`h-8 px-3 text-xs ${viewMode === "list" ? "shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              <ListIcon className="w-3.5 h-3.5 mr-1.5" />
              List
            </Button>
          </div>
        )}
      </div>

      {/* Pipeline Summary */}
      {applications.length > 0 && <PipelineSummary counts={pipelineCounts} />}

      {/* Analytics */}
      {applications.length > 0 && <ApplicationAnalytics applications={applications} />}

      <AnimatePresence mode="wait">
      {applications.length === 0 ? (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">Nothing tracked yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            When you click <strong>Apply Now</strong> on a job, it'll show up here so you can track its progress.
          </p>
        </motion.div>
      ) : viewMode === "board" ? (
        /* Kanban Board with DnD */
        <motion.div key="board" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-x-visible md:pb-0 md:mx-0 md:px-0">
            {grouped.map((stage) => (
              <div key={stage.id} className="space-y-3 min-w-[280px] md:min-w-0 snap-start">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{stage.label}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                      {stage.apps.length}
                    </span>
                  </div>
                </div>

                <DroppableColumn id={stage.id}>
                  {stage.apps.map((app) => (
                    <DraggableCard key={app.id} id={app.id}>
                      {renderCard(app)}
                    </DraggableCard>
                  ))}

                  {stage.apps.length === 0 && (
                    <div className="p-6 rounded-lg border border-dashed border-border text-center">
                      <p className="text-xs text-muted-foreground">Drop here</p>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            ))}
          </div>

          <DragOverlay>
            {draggedApp ? (
              <div className="w-[280px]">
                {renderCard(draggedApp, true)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        </motion.div>
      ) : (
        /* List View */
        <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
          <div className="grid gap-3">
            {applications
              .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
              .map((app) => {
                const stageInfo = STAGES.find(s => s.id === getStage(app.status)) || STAGES[0];
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setDetailApp(app)}
                  >
                    <div className="flex-1 min-w-0 flex items-start sm:items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10">
                        <span className="text-sm font-bold text-primary">{app.company?.[0]?.toUpperCase() ?? "?"}</span>
                      </div>
                      <div className="grid gap-1">
                        <h4 className="text-sm font-medium truncate">{app.job_title}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="font-medium text-foreground/80">{app.company}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {safeFormatDistance(app.applied_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Select
                          value={app.status}
                          onValueChange={(val) => handleStatusChange(app.id, val)}
                        >
                          <SelectTrigger className={`h-8 text-xs w-[130px] border-border ${stageInfo.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="screening">Screening</SelectItem>
                            <SelectItem value="interview">Interview</SelectItem>
                            <SelectItem value="offer">Offer</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => { setEditingNoteId(app.id); setNoteInput(app.notes || ""); }}
                          className={`p-1.5 rounded-md transition-colors ${app.notes ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                          title={app.notes ? "View/edit note" : "Add note"}
                        >
                          <StickyNote className="w-4 h-4" />
                        </button>
                        {app.job_url ? (
                          <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="p-1.5 opacity-30 cursor-not-allowed">
                            <ExternalLink className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      {editingNoteId === app.id && (
                        <div className="space-y-1 w-full sm:w-[220px]">
                          <textarea
                            autoFocus
                            value={noteInput}
                            onChange={e => setNoteInput(e.target.value)}
                            placeholder="Add a note..."
                            className="w-full text-xs bg-muted border border-border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[56px]"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveNote(app.id)} className="text-[11px] text-primary font-medium hover:underline">Save</button>
                            <button onClick={() => setEditingNoteId(null)} className="text-[11px] text-muted-foreground hover:underline">Cancel</button>
                          </div>
                        </div>
                      )}
                      {app.notes && editingNoteId !== app.id && (
                        <p className="text-[11px] text-muted-foreground italic line-clamp-1 w-full sm:w-[220px]">
                          {app.notes}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>

          {/* Pagination */}
          {Math.ceil(applications.length / ITEMS_PER_PAGE) > 1 && (
            <div className="pt-4 pb-2">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.ceil(applications.length / ITEMS_PER_PAGE) }).map((_, i) => {
                    const page = i + 1;
                    const tPages = Math.ceil(applications.length / ITEMS_PER_PAGE);
                    if (page === 1 || page === tPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink href="#" isActive={currentPage === page} onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}>
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    if ((page === 2 && currentPage > 3) || (page === tPages - 1 && currentPage < tPages - 2)) {
                      return <PaginationItem key={page}><PaginationEllipsis /></PaginationItem>;
                    }
                    return null;
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(Math.ceil(applications.length / ITEMS_PER_PAGE), p + 1)); }}
                      className={currentPage === Math.ceil(applications.length / ITEMS_PER_PAGE) ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      <ApplicationDetailSheet
        app={detailApp}
        open={!!detailApp}
        onClose={() => setDetailApp(null)}
      />
    </motion.div>
  );
};
