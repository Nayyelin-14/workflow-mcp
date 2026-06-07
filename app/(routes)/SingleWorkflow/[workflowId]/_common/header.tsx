import { Button } from "@/components/ui/button";
import {
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkflow } from "@/context/workflow-context";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Code,
  MoreHorizontal,
  Pencil,
  Play,
  Trash,
} from "lucide-react";
import Link from "next/link";
import React from "react";
type workflowHeaderProps = {
  name?: string;
  workflowId?: string;
  isLoading: boolean;
};
const tabs = [
  { id: "edit" as const, label: "Edit", icon: Pencil },
  { id: "preview" as const, label: "Preview", icon: Play },
];
const Header = ({ name, isLoading }: workflowHeaderProps) => {
  //   const [view, setView] = useState<string>("edit");
  const { view, setView } = useWorkflow();

  const zIndex = view === "preview" ? "z-99" : " ";
  const handleSetView = (tabId: "edit" | "preview") => {
    setView(tabId);
  };
  return (
    <div className="relative">
      <header className="w-full bg-transparent absolute top-0 z-50">
        <div className="flex h-14 items-center  justify-between px-4">
          <Link
            className={`flex items-center gap-3 bg-card py-1 px-1 rounded-lg ${zIndex}`}
            href="/workflow"
          >
            <Button variant={"secondary"} size={"icon"} className="size-8">
              <ChevronLeft className="size-4" />
            </Button>
            <div>
              {isLoading ? (
                <Skeleton className="w-20" />
              ) : (
                <h1 className="text-sm font-semibold truncate max-w-50">
                  {name || "Untitled workflow"}
                </h1>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-1 rounded-lg  p-1 mt-1 z-999">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  onClick={() => handleSetView(t.id)}
                  className={cn(
                    `flex items-center cursor-pointer gap-2 rounded-md px-3 py-1.5 bg-muted text-sm font-medium transition-colors`,
                    view === t.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={t.id}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center  gap-2 bg-card p-1 rounded-lg">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant={"ghost"} size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Trash className="w-3.5 h-3.5" />
                  <span>Delte</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant={"ghost"} size="icon" className="size-8">
              <Code className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Header;
