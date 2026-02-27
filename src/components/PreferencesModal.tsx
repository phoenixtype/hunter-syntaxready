import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPreferences } from "@/lib/user_preferences";
import PreferencesPanel from "./PreferencesPanel";

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    preferences: UserPreferences | null;
}

const PreferencesModal = ({ isOpen, onClose, preferences }: PreferencesModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Job Preferences</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <PreferencesPanel preferences={preferences} onSaved={onClose} />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PreferencesModal;
