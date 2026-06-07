import { cn } from "@/lib/utils";
import { getNodeConfig, NodeTypeEnum } from "@/lib/workflow/node-config";
import { Panel } from "@xyflow/react";
import React from "react";

const NODE_LIST = [
  {
    group: "Core",
    items: [NodeTypeEnum.AGENT, NodeTypeEnum.END, NodeTypeEnum.COMMENT],
  },
  {
    group: "Logic",
    items: [NodeTypeEnum.IF_ELSE],
  },
  {
    group: "Network",
    items: [NodeTypeEnum.HTTP],
  },
];

const onDragStart = (event: React.DragEvent, nodeType: string) => {
  event.dataTransfer.setData("application/reactflow", nodeType);
  event.dataTransfer.effectAllowed = "move";
};
const NodePanel = () => {
  return (
    <Panel
      position="top-left"
      className="flex flex-col  w-51 top-10! h-fit bg-card shadow-xl pb-5 rounded-lg"
    >
      <div className="flex-1 p-4 space-y-2">
        {NODE_LIST?.map((gp) => (
          <div className="space-y-1" key={gp.group}>
            <h4 className="text-[11px] font-medium text-muted-foreground px-1">
              {gp.group}
            </h4>
            <div className="space-y-1">
              {gp.items.map((nodeType) => {
                const config = getNodeConfig(nodeType);
                if (!config) {
                  return null;
                }
                const Icon = config?.icon;

                return (
                  <button
                    disabled={false}
                    key={nodeType}
                    draggable
                    onDragStart={(e) => onDragStart(e, nodeType)}
                    className={cn(
                      `flex items-center gap-3 p-1 w-full hover:bg-accent transition-all cursor-grab active:cursor-grabbing disabled:opacity-50 disabled:pointer-events-none`,
                    )}
                  >
                    <div
                      className={cn(
                        `rounded-sm size-7 flex items-center justify-center`,
                        config?.color,
                      )}
                    >
                      <Icon className="size-3.5! text-white" />
                    </div>
                    <span className="text-sm font-medium">
                      {config?.label ?? nodeType}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
};

export default NodePanel;
