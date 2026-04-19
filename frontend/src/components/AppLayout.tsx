import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-12 flex items-center border-b border-gold px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
            <span className="ml-4 font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Dungeons & Dragons — AI Game Master
            </span>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
