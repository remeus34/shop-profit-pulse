import { Outlet, NavLink } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 gap-2">
            <SidebarTrigger />
            <NavLink to="/" className="font-semibold">
              Etsy Profit Radar
            </NavLink>
            <div className="ml-auto flex items-center gap-2">
              <NavLink to="/connect">
                <Button size="sm">Connect</Button>
              </NavLink>
            </div>
          </header>
          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
