import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Home,
  User,
  FileText,
  Briefcase,
  MessageSquare,
  Settings,
  Crown,
  LogOut,
  Zap
} from "lucide-react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const MobileDrawer = ({ open, onClose }: MobileDrawerProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isPro } = useSubscription();

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const menuItems = [
    {
      icon: Home,
      label: "Dashboard",
      path: "/dashboard",
      description: "Your job search overview"
    },
    {
      icon: Briefcase,
      label: "Job Hunt",
      path: "/application-wizard",
      description: "Find and apply to jobs"
    },
    {
      icon: FileText,
      label: "Resume Builder",
      path: "/resume-builder",
      description: "Create perfect resumes"
    },
    {
      icon: MessageSquare,
      label: "Interview Coach",
      path: "/interview-coach",
      description: "Practice with AI"
    },
    {
      icon: Zap,
      label: "Auto Applier",
      path: "/auto-applier-settings",
      description: "Automated job applications"
    },
    {
      icon: User,
      label: "Profile",
      path: "/profile",
      description: "Manage your profile"
    }
  ];

  const proFeatures = [
    {
      icon: FileText,
      label: "Tailored Resumes",
      path: "/tailored-resumes",
      description: "AI-customized resumes"
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">{user?.email || "User"}</p>
                <p className="text-sm opacity-90">
                  {isPro ? "Pro Member" : "Free Plan"}
                  {isPro && <Crown className="inline w-4 h-4 ml-1" />}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {menuItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className="w-full justify-start h-auto p-3 text-left"
                  onClick={() => handleNavigate(item.path)}
                >
                  <item.icon className="w-5 h-5 mr-3 text-gray-600" />
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-gray-500">{item.description}</div>
                  </div>
                </Button>
              ))}
            </div>

            {isPro && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 px-3">Pro Features</p>
                  {proFeatures.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3 text-left bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100"
                      onClick={() => handleNavigate(item.path)}
                    >
                      <item.icon className="w-5 h-5 mr-3 text-orange-600" />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {item.label}
                          <Crown className="w-4 h-4 text-yellow-500" />
                        </div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </>
            )}

            <Separator className="my-4" />

            {/* Settings & Logout */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start p-3"
                onClick={() => handleNavigate("/settings")}
              >
                <Settings className="w-5 h-5 mr-3 text-gray-600" />
                Settings
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start p-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Footer */}
          {!isPro && (
            <div className="p-4 border-t bg-gradient-to-r from-blue-50 to-purple-50">
              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                onClick={() => handleNavigate("/recruiter/pricing")}
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
              <p className="text-xs text-center text-gray-500 mt-2">
                Unlock unlimited job applications & AI features
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};