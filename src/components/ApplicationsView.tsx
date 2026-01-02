import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, DollarSign, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";

// Mock data for now - in production this would come from a database
const mockApplications = [
    {
        id: 1,
        company: "TechCorp Inc.",
        role: "Senior Fullstack Engineer",
        status: "Interviewing",
        date: "2 Days ago",
        salary: "$140k - $160k",
        nextStep: "System Design Round"
    },
    {
        id: 2,
        company: "StartupAI",
        role: "Founding Engineer",
        status: "Applied",
        date: "Today",
        salary: "$120k - $180k",
        nextStep: "Awaiting Review"
    },
    {
        id: 3,
        company: "Legacy Systems",
        role: "Lead Developer",
        status: "Offer",
        date: "1 Week ago",
        salary: "$155k",
        nextStep: "Negotiation"
    }
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Interviewing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        case 'Offer': return 'bg-green-500/10 text-green-500 border-green-500/20';
        case 'Rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
        default: return 'bg-secondary text-muted-foreground';
    }
};

export const ApplicationsView = () => {
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
                                <TableHead>Next Step</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockApplications.map((app) => (
                                <TableRow key={app.id} className="hover:bg-secondary/10">
                                    <TableCell>
                                        <div className="font-medium">{app.company}</div>
                                        <div className="text-xs text-muted-foreground">{app.role}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${getStatusColor(app.status)} font-normal`}>
                                            {app.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center text-sm font-mono text-muted-foreground">
                                            <DollarSign className="w-3 h-3 mr-1" />
                                            {app.salary}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{app.nextStep}</div>
                                        <div className="text-[10px] text-muted-foreground">{app.date}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {mockApplications.length === 0 && (
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
