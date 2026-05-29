import { Shield, Compass, Map, BookOpen, Trophy, RotateCcw } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { SettingsModal } from "@/components/SettingsModal";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Character", url: "/", icon: Shield },
  { title: "Adventure", url: "/adventure", icon: Compass },
  { title: "Map", url: "/map", icon: Map },
  { title: "Game", url: "/game", icon: BookOpen },
  { title: "Summary", url: "/summary", icon: Trophy },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { setCharacter, setSessionId, clearAdventureData } = useGame();

  const handleReset = () => {
    if (!confirm("Reset character and start over?")) return;
    localStorage.removeItem("dnd_session_id");
    setSessionId(null);
    setCharacter(null);
    clearAdventureData();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-gold">
      <SidebarContent className="pt-6">
        {!collapsed && (
          <div className="px-4 pb-6 mb-4 border-b border-gold">
            <h1 className="font-display text-primary text-lg tracking-widest text-gold-glow text-center">
              The Eldritch Archive
            </h1>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center pb-4 mb-4 border-b border-gold">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sidebar-foreground hover:text-primary transition-colors duration-200"
                      activeClassName="text-primary bg-sidebar-accent glow-gold"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="font-display text-xs uppercase tracking-wider">
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer actions at the bottom */}
        <div className="mt-auto px-2 pb-4 space-y-2">
          <div className={`${collapsed ? "flex justify-center" : ""}`}>
            <SettingsModal />
          </div>
          
          <button
            onClick={handleReset}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-200 w-full ${collapsed ? "justify-center" : ""}`}
            title="New Character"
          >
            <RotateCcw className="h-4 w-4 flex-shrink-0" />
            {!collapsed && (
              <span className="font-display text-xs uppercase tracking-wider">
                New Character
              </span>
            )}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
