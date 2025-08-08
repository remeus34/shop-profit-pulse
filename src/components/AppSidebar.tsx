import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  Receipt,
  ShoppingBag,
  LineChart,
  Truck,
  Wallet,
  Package,
  Megaphone,
  Search,
} from "lucide-react";

const items = [
  { title: "Dashboard", url: "/", icon: BarChart3 },
  { title: "Orders", url: "/orders", icon: Receipt },
  { title: "Listings", url: "/listings", icon: ShoppingBag },
  { title: "Product Insights", url: "/insights", icon: LineChart },
  { title: "Shipping", url: "/shipping", icon: Truck },
  { title: "Expenses", url: "/expenses", icon: Wallet },
  { title: "COGS", url: "/cogs", icon: Package },
  { title: "Ads", url: "/ads", icon: Megaphone },
  { title: "Research", url: "/research", icon: Search },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isExpanded = items.some((i) => isActive(i.url));
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
