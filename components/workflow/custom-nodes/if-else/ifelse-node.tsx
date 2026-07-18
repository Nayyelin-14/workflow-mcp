import { NodeProps, Position } from "@xyflow/react";
import React from "react";
import WorkflowNode from "../../workflow-node";
import { GitBranchIcon } from "lucide-react";
import IfElseNodeSettings from "./ifelse-settings";
import { BaseHandle } from "../react-workflow/base-handle";

export type Condition = {
  caseName?: string;
  variable?: string;
  operator?: string;
  value?: string;
};

const IfElseNode = (props: NodeProps) => {
  const { id, data, selected } = props;
  const conditions = (data?.conditions as Condition[]) || [];
  const bgColor = data?.color as string;

  console.log(`[UI:IfElseNode] Rendering node: ${id}`);
  console.log(`[UI:IfElseNode] Conditions count: ${conditions.length}`);
  console.log(`[UI:IfElseNode] Conditions data:`, JSON.stringify(conditions, null, 2));

  const conditionStyle = `relative flex items-center justify-end p-2  
  text-xs rounded-md bg-muted/50 border border-dashed border-border
   text-[11px] font-medium text-mutedf-foreground whitespace-nowrap`;
  return (
    <>
      <WorkflowNode
        color={bgColor}
        label="If/else"
        subText="Condition"
        nodeId={id}
        selected={selected}
        isDeleteable={true}
        handles={{
          target: true,
          source: false,
        }}
        icon={GitBranchIcon}
        settingTitle="If / Else"
        settingDescription="Create conditions to branch your workflow"
        settingComponent={<IfElseNodeSettings nodeId={id} data={data} />}
      >
        {conditions?.map((condition, index) => {
          const condition_merge = `${condition.variable}${condition.operator} ${condition.value}`;
          return (
            <div className="relative" key={`condition-${index}`}>
              <div className={conditionStyle}>
                <p className="whitespace-nowrap overflow-hidden truncate max-w-62.5">
                  {condition.caseName ||
                    condition_merge ||
                    `Condition ${index + 1}`}
                </p>
              </div>

              <BaseHandle
                type="source"
                position={Position.Right}
                id={`condition-${index}`}
                className="size-2.5 -right-1.5 hover:scale-125 transition-transform"
              />
            </div>
          );
        })}

        <div className="relative ">
          <div className={conditionStyle}>Else</div>
          <BaseHandle
            type="source"
            position={Position.Right}
            id={`else`}
            className="size-2.5 -right-1.5 hover:scale-125 transition-transform"
          />
        </div>
      </WorkflowNode>
    </>
  );
};

export default IfElseNode;
