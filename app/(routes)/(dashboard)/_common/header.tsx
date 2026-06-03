"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogoutLink,
  useKindeBrowserClient,
} from "@kinde-oss/kinde-auth-nextjs";
import { LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";
import { cn } from "@/lib/utils";

const AppHeader = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const { user, isLoading } = useKindeBrowserClient();

  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between px-4 lg:px-0">
        <div />
        <div className="flex items-center gap-4">
          <Button
            className="relative size-8 cursor-pointer rounded-full"
            variant="outline"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <SunIcon
              className={cn(
                "absolute h-5 w-5",
                isDark ? "scale-100" : "scale-0",
              )}
            />
            <MoonIcon
              className={cn(
                "absolute h-5 w-5",
                isDark ? "scale-0" : "scale-100",
              )}
            />
          </Button>

          {isLoading ? (
            <div className="size-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className="size-8 shrink-0 rounded-full">
                  <AvatarImage src={user.picture ?? undefined} />
                  <AvatarFallback className="rounded-full">
                    {user.given_name?.charAt(0)}
                    {user.family_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuItem className="cursor-pointer">
                  <LogoutLink className="flex w-full items-center gap-1">
                    <LogOutIcon className="h-4 w-4" />
                    <span>Logout</span>
                  </LogoutLink>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
