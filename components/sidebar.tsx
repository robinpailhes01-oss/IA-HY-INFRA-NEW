import { SidebarNav } from "@/components/sidebar-nav";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar text-sidebar-foreground md:block">
      <SidebarNav />
    </aside>
  );
}
