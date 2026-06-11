import { NodeProps } from "@xyflow/react";
import React from "react";
import WorkflowNode from "../../workflow-node";
import { Square } from "lucide-react";
import EndNodeSettings from "./Endnode-settings";

const EndNode = (props: NodeProps) => {
  const { data, id, selected } = props;
  const bgColor = data?.color as string;
  return (
    <>
      <WorkflowNode
        color={bgColor}
        label="End"
        subText=""
        className="min-w-fit"
        nodeId={id}
        isDeleteable={true}
        handles={{ target: true, source: true }}
        selected={selected}
        icon={Square}
        settingTitle="End Node Settings"
        settingDescription="Choose the workflow output"
        settingComponent={<EndNodeSettings nodeId={id} data={data} />}
      />
    </>
  );
};

export default EndNode;
