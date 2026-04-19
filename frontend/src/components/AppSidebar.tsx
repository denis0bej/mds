import { Shield, Compass, Map, BookOpen, Trophy } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();

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
      </SidebarContent>
    </Sidebar>
  );
}
