import { SidebarProvider } from "@/components/ui/sidebar";
import AppSideBar from "../_common/app-sidebar";
import AppHeader from "../_common/header";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSideBar />
      <main className="w-full flex-1">
        <AppHeader />
        <div className="w-full px-4 lg:px-12 mx-auto max-w-6xl">{children}</div>
      </main>
    </SidebarProvider>
  );
}
