import { NodeProps } from "@xyflow/react";
import React from "react";
import WorkflowNode from "../../workflow-node";
import { PlayIcon } from "lucide-react";
import StartNodeSettings from "./start-settings";
const StartNode = (props: NodeProps) => {
  const { id, data, selected } = props;
  const bgColor = data?.color as string;
  return (
    <>
      <WorkflowNode
        color={bgColor}
        label="Start"
        subText="Trigger"
        nodeId={id}
        selected={selected}
        className="min-w-28!"
        isDeleteable={false}
        handles={{
          target: false,
          source: true,
        }}
        settingTitle=""
        icon={PlayIcon}
        settingDescription="The workflow setting point"
        settingComponent={<StartNodeSettings nodeId={id} />}
      />
    </>
  );
};

export default StartNode;
