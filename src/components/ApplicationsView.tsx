import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, DollarSign, Calendar, Loader2 } from "lucide-react";
import { getApplicationHistory, ApplicationRecord } from "@/lib/application_engine";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'rejected': case 'failed': return 'bg-destructive/10 text-destructive border-destructive/20';
        default: return 'bg-secondary text-secondary-foreground border-border';
    }
};

export const ApplicationsView = () => {
    const { session } = useAuth();
    const [applications, setApplications] = useState<ApplicationRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (session?.user?.id) {
                try {
                    const history = await getApplicationHistory(session.user.id);
                    setApplications(history);
                } catch (e) {
                    console.error("Failed to load applications", e);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [session?.user?.id]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-lg font-bold">Application Pipeline</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage your ongoing conversations and offers.</p>
                </div>
                <Button variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    Calendar View
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border border-border/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-secondary/20">
                            <TableRow>
                                <TableHead>Company & Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Compensation</TableHead>
                                <TableHead>Applied</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {applications.map((app) => (
                                <TableRow key={app.id} className="hover:bg-secondary/10">
                                    <TableCell>
                                        <div className="font-medium">{app.company}</div>
                                        <div className="text-xs text-muted-foreground">{app.job_title}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${getStatusColor(app.status)} font-normal capitalize`}>
                                            {app.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center text-sm font-mono text-muted-foreground">
                                            <DollarSign className="w-3 h-3 mr-1" />
                                            {app.metadata?.salary_range || 'Not specified'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            {app.applied_at ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true }) : 'Recently'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {applications.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No active applications. Start hunting!
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
