
import { useEffect, useState } from "react";
import { LogEntry, getLogs, subscribeToLogs, LogType } from "@/lib/activity_logger";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Terminal, Shield, Activity, Bot, Search, PenTool, Database } from "lucide-react";

export const AgentActivityLog = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        setLogs(getLogs());
        const unsubscribe = subscribeToLogs(() => {
            setLogs(getLogs());
        });
        return unsubscribe;
    }, []);

    const getIcon = (agent: string) => {
        switch (agent.toLowerCase()) {
            case 'crawler': return <Search className="w-3 h-3" />;
            case 'writer': return <PenTool className="w-3 h-3" />;
            case 'system': return <Shield className="w-3 h-3" />;
            case 'learning': return <Database className="w-3 h-3" />;
            case 'monetization': return <Activity className="w-3 h-3" />;
            default: return <Bot className="w-3 h-3" />;
        }
    };

    const getTypeColor = (type: LogType) => {
        switch (type) {
            case 'error': return 'text-destructive border-destructive/20 bg-destructive/10';
            default: return 'text-muted-foreground border-border bg-secondary';
        }
    };

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-[300px] animate-fade-in">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-foreground" />
                    <h3 className="font-mono text-sm font-semibold tracking-wider uppercase text-muted-foreground">Agent_Audit_Log</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
                    </span>
                    <span className="text-[10px] font-mono text-foreground">SYSTEM_ACTIVE</span>
                </div>
            </div>

            <ScrollArea className="flex-1 p-0">
                <div className="flex flex-col font-mono text-xs">
                    {logs.map((log) => (
                        <div key={log.id} className="border-b border-border p-3 hover:bg-accent transition-colors flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                            <span className="text-muted-foreground/50 shrink-0 w-16">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>

                            <div className={`flex items-center justify-center w-5 h-5 rounded shrink-0 ${getTypeColor(log.type)}`}>
                                {getIcon(log.agent)}
                            </div>

                            <div className="flex-1">
                                <span className={log.type === 'error' ? 'text-destructive font-bold' : 'text-foreground font-semibold'}>
                                    [{log.agent.toUpperCase()}]
                                </span>
                                <span className="mx-2 text-muted-foreground">::</span>
                                <span className="text-foreground/90">{log.action}</span>
                                {log.details && (
                                    <p className="text-muted-foreground mt-0.5 ml-0">{log.details}</p>
                                )}
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground italic">
                            Awaiting agent signals...
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
