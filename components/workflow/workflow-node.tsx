import { LucideIcon, Settings, Trash2Icon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";
import { BaseHandle } from "./custom-nodes/react-workflow/base-handle";
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "./custom-nodes/react-workflow/base-node";
import {
  NodeStatusIndicator,
  type NodeStatus,
} from "./custom-nodes/react-workflow/node-status-indicator";
import { Position, useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { ButtonGroup } from "../ui/button-group";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

type workflownodeProps = {
  nodeId: string;
  label: string;
  subText: string;
  icon: LucideIcon;
  selected?: boolean;
  color?: string;
  status?: NodeStatus;
  isDeleteable?: boolean;
  handles: { target: boolean; source: boolean };
  className?: string;
  children?: React.ReactNode;
  settingComponent?: React.ReactNode;
  settingTitle?: string;
  settingDescription?: string;
};

const WorkflowNode = ({
  nodeId,
  label,
  subText,
  icon: Icon,
  selected,
  color,
  status,
  handles,
  className,
  children,
  settingComponent,
  settingTitle,
  settingDescription,
  isDeleteable,
}: workflownodeProps) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const { deleteElements } = useReactFlow();
  const onDelete = () => {
    if (!isDeleteable) {
      toast.error("Failed to delete");
      return;
    }
    deleteElements({
      nodes: [
        {
          id: nodeId,
        },
      ],
    });
  };
  return (
    <>
      <div className="relative">
        <NodeStatusIndicator status={status} variant="border">
          <BaseNode
            onDoubleClick={(e) => {
              if (!settingComponent) return;
              e.stopPropagation();
              setShowSettings(true);
            }}
            className={cn("min-w-36  w-fit cursor-pointer", className)}
          >
            <BaseNodeHeader className="flex items-start px-3 pt-3 pb-3.5">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "rounded-sm! size-7 flex items-center justify-center",
                    color,
                  )}
                >
                  <Icon className="size-3.5  text-white" />
                </div>

                <div className="flex flex-col">
                  <BaseNodeHeaderTitle className="text-sm! pr-2 font-medium">
                    {label}
                  </BaseNodeHeaderTitle>
                  {subText && (
                    <p className="text-[11px] text-muted-foreground -mt-0.5 truncate max-w-20">
                      {subText}
                    </p>
                  )}
                </div>
              </div>
              {selected && (
                <ButtonGroup className="flex items-center -mt-px">
                  {settingComponent && (
                    <Button
                      variant={"ghost"}
                      size={"icon-sm"}
                      className="size-6! hover:bg-accent "
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettings(true);
                      }}
                    >
                      <Settings className="size-3" />
                    </Button>
                  )}
                  {isDeleteable && (
                    <Button
                      variant={"ghost"}
                      size={"icon-sm"}
                      className="size-6! hover:bg-destructive/10 hover:text-destructive -ml-px "
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  )}
                </ButtonGroup>
              )}
            </BaseNodeHeader>
            {children && <BaseNodeContent>{children}</BaseNodeContent>}
            {handles.target && (
              <BaseHandle
                id={"target-1"}
                type="target"
                className="size-2.5! hover:scale-125 transition-transform"
                position={Position.Left}
              />
            )}
            {handles.source && (
              <BaseHandle
                id={"source-1"}
                type="source"
                className="size-2.5! hover:scale-125 transition-transform"
                position={Position.Right}
              />
            )}
          </BaseNode>
        </NodeStatusIndicator>
      </div>

      {settingComponent && (
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent
            className="max-w-md! px-0 pb-2"
          >
            <DialogHeader className="px-4">
              <DialogTitle>{settingTitle || `${label} Settings`}</DialogTitle>
              {settingDescription && (
                <DialogDescription>{settingDescription}</DialogDescription>
              )}{" "}
            </DialogHeader>

            <div className="px-4 space-y-4 h-full max-h-[65vh] overflow-y-auto">
              {settingComponent}
            </div>
            <DialogFooter className="px-14 border-t pt-2 bg-transparent">
              <Button
                variant={"secondary"}
                className="w-full"
                onClick={() => setShowSettings(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default WorkflowNode;
