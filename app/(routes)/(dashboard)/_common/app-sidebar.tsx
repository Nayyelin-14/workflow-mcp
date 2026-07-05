"use client";
import Logo from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Settings, WorkflowIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

const AppSideBar = () => {
  const router = useRouter();
  const pathName = usePathname();
  const navItems = [
    {
      title: "Workflows",
      url: "/workflow",
      icon: WorkflowIcon,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-center px-4 group-data-[collapsible=icon]:px-2">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <SidebarMenu>
          {navItems?.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                isActive={pathName === item.url}
                className="data-[active=true]:bg-primary/10"
                onClick={() => router.push(item.url)}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSideBar;
