import { NodeProps } from "@xyflow/react";
import WorkflowNode from "../../workflow-node";
import { MousePointer2, PlayIcon } from "lucide-react";
import AgentSettings from "./agent-settings";
const AgentNode = (props: NodeProps) => {
  const { id, data, selected } = props;
  const bgColor = data?.color as string;
  const nodeLabel = (data?.label as string) || "Agent";
  return (
    <>
      <WorkflowNode
        color={bgColor}
        label={nodeLabel}
        subText="Agent"
        nodeId={id}
        className="min-w-28!"
        selected={selected}
        isDeleteable={true}
        handles={{
          target: true,
          source: true,
        }}
        settingTitle={`${nodeLabel} settings`}
        icon={MousePointer2}
        settingDescription="Call the model with your instructions and tools"
        settingComponent={<AgentSettings nodeId={id} data={data} />}
      />
    </>
  );
};

export default AgentNode;
