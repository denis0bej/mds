import { Link, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameContext";
import { Target } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";

export function AppLayout() {
  const { user } = useAuth();
  const { mainMission, adventureComplete } = useGame();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-12 flex items-center justify-between border-b border-gold px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <div className="flex items-center flex-1">
              <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
              <span className="ml-4 font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:inline-block">
                D&D — AI Game Master
              </span>
            </div>

            {mainMission && !adventureComplete && (
              <div className="flex-[2] flex justify-center overflow-hidden px-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-full max-w-full">
                  <Target className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-display text-[10px] uppercase tracking-wider text-primary truncate">
                    {mainMission.title}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 flex justify-end items-center gap-2 sm:gap-4 min-w-[100px] sm:min-w-[150px]">
              <SettingsDialog />
              {user && (
                <Link
                  to="/account"
                  className="font-display text-[10px] uppercase tracking-wider text-primary hover:text-gold-glow transition-colors truncate max-w-[60px] sm:max-w-[120px]"
                >
                  {user.username}
                </Link>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
