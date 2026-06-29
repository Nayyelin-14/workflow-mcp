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
  console.log("\n==============================================");
  console.log("🚀 Workflow Execution Started");
  console.log("==============================================");
  console.log("User input:", userInput);
  console.log("Total nodes:", nodes.length);
  console.log("Total edges:", edges.length);

  while (currentNodeId) {
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) {
      console.log(`\n⚠️ Node ${currentNodeId} not found, breaking`);
      break;
    }

    console.log(`\n--- Processing Node: ${node.id} [type: ${node.type}] ---`);

    const executorFactory = getNodeExecutor(node.type as NodeType);
    if (executorFactory) {
      const executor = executorFactory();
      console.log(`Executing ${node.type} node...`);
      const result = await executor(node, context);
      context.outputs[node.id] = result.output;
      console.log(`✅ ${node.type} node completed`);
      console.log("Output stored:", JSON.stringify(result.output, null, 2));
    } else {
      console.log(`⚠️ No executor found for type: ${node.type}, skipping`);
    }

    const outgoingEdge = edges.find((e) => e.source === currentNodeId);
    if (outgoingEdge) {
      console.log(`Following edge: ${outgoingEdge.id} (sourceHandle: ${outgoingEdge.sourceHandle || "none"}) → ${outgoingEdge.target}`);
      currentNodeId = outgoingEdge.target;
    } else {
      console.log(`No outgoing edge from ${currentNodeId}, workflow ends`);
      currentNodeId = null;
    }
  }

  console.log("\n==============================================");
  console.log("🏁 Workflow Execution Finished");
  console.log("Final outputs:", JSON.stringify(context.outputs, null, 2));
  console.log("==============================================");
};
export { executeWorkflow };
