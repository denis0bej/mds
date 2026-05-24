import { Link, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/context/AuthContext";

export function AppLayout() {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-12 flex items-center justify-between border-b border-gold px-4">
            <div className="flex items-center">
              <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
              <span className="ml-4 font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Dungeons & Dragons — AI Game Master
              </span>
            </div>

            {user && (
              <Link
                to="/account"
                className="font-display text-xs uppercase tracking-wider text-primary hover:text-gold-glow transition-colors"
              >
                {user.username}
              </Link>
            )}
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
