import { Edge, Node } from "@xyflow/react";
import { UIMessage } from "ai";
import { NodeTypeEnum, NodeType, getNodeExecutor } from "./node-config";
import { ExecutorContextType } from "@/types/workflow";

const executeWorkflow = async (
  nodes: Node[],
  edges: Edge[],
  userInput: string,
  messages: UIMessage[],
  channel: ExecutorContextType["channel"],
  workflowRunId: string,
) => {
  const startNode = nodes.find((n) => n.type === NodeTypeEnum.START);
  if (!startNode) throw new Error("Start node is not found in the workflow");

  const context: ExecutorContextType = {
    outputs: {
      [startNode.id]: {
        input: userInput,
      },
    },
    history: messages || [],
    workflowRunId,
    channel,
  };

  let currentNodeId: string | null = startNode.id;
  while (currentNodeId) {
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    const executorFactory = getNodeExecutor(node.type as NodeType);
    if (executorFactory) {
      const executor = executorFactory();
      const result = await executor(node, context);
      context.outputs[node.id] = result.output;
    }

    const outgoingEdge = edges.find((e) => e.source === currentNodeId);
    currentNodeId = outgoingEdge?.target ?? null;
  }
};
export { executeWorkflow };
