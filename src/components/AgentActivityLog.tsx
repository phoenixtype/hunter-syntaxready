
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
            case 'error': return 'text-red-500 border-red-500/20 bg-red-500/10';
            case 'warning': return 'text-amber-500 border-amber-500/20 bg-amber-500/10';
            case 'success': return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10';
            case 'action': return 'text-blue-500 border-blue-500/20 bg-blue-500/10';
            default: return 'text-muted-foreground border-border bg-secondary/50';
        }
    };

    return (
        <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-[300px] animate-fade-in border-white/10">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    <h3 className="font-mono text-sm font-semibold tracking-wider uppercase text-muted-foreground">Agent_Audit_Log</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500">SYSTEM_ACTIVE</span>
                </div>
            </div>

            <ScrollArea className="flex-1 p-0">
                <div className="flex flex-col font-mono text-xs">
                    {logs.map((log) => (
                        <div key={log.id} className="border-b border-white/5 p-3 hover:bg-white/5 transition-colors flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                            <span className="text-muted-foreground/50 shrink-0 w-16">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>

                            <div className={`flex items-center justify-center w-5 h-5 rounded shrink-0 ${getTypeColor(log.type)}`}>
                                {getIcon(log.agent)}
                            </div>

                            <div className="flex-1">
                                <span className={log.type === 'error' ? 'text-red-400 font-bold' : 'text-primary/90 font-semibold'}>
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
                        <div className="p-8 text-center text-muted-foreground/50 italic">
                            Awaiting agent signals...
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
