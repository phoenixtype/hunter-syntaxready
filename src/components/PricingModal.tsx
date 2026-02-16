
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { upgradeToPro } from "@/lib/subscription";
import { toast } from "sonner";

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PricingModal = ({ isOpen, onClose }: PricingModalProps) => {
    const [loading, setLoading] = useState(false);

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            await upgradeToPro();
            // Redirect happens inside upgradeToPro, so we don't need to close or toast success immediately
            // But if it returns (void), we might want to catch errors
        } catch (e) {
            console.error(e);
            toast.error("Payment initiation failed.", { description: "Please try again later." });
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl glass-card border-white/10 p-0 overflow-hidden">
                <div className="grid md:grid-cols-2">
                    {/* Free Tier */}
                    <div className="p-8 space-y-6 bg-background/50">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">Hunter Basic</h3>
                            <p className="text-2xl font-mono">$0<span className="text-sm text-muted-foreground font-sans">/mo</span></p>
                            <p className="text-sm text-muted-foreground">Essential tools for your job search.</p>
                        </div>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-foreground" /> 20 Applications / Month</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-foreground" /> Basic Resume Tailoring</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-foreground" /> Daily Job Feed</li>
                        </ul>
                        <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                    </div>

                    {/* Pro Tier */}
                    <div className="p-8 space-y-6 bg-gradient-to-br from-primary/10 to-primary/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2">
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">Recommended</span>
                        </div>
                        <div className="space-y-2 relative z-10">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                Hunter Pro <Sparkles className="w-4 h-4 text-foreground" />
                            </h3>
                            <p className="text-2xl font-mono">$29<span className="text-sm text-muted-foreground font-sans">/mo</span></p>
                            <p className="text-sm text-muted-foreground">Supercharge your search with Agentic AI.</p>
                        </div>
                        <ul className="space-y-3 text-sm relative z-10">
                            <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-foreground" /> Unlimited Applications</li>
                            <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-foreground" /> Deep Intelligence Briefings</li>
                            <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-foreground" /> Negotiation Coach Agent</li>
                            <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-foreground" /> Visibility Signal Analysis</li>
                        </ul>
                        <Button
                            className="w-full relative z-10 bg-primary hover:bg-primary/90 transition-colors"
                            onClick={handleUpgrade}
                            disabled={loading}
                        >
                            {loading ? "Processing..." : "Upgrade to Pro"}
                        </Button>

                        {/* Background FX */}
                        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150 translate-x-1/2 translate-y-1/2"></div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PricingModal;
