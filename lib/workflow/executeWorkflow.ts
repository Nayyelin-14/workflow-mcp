import { Edge, Node } from "@xyflow/react";
import { UIMessage } from "ai";
import { NodeTypeEnum, NodeType, getNodeExecutor } from "./node-config";
import { ExecutorContextType } from "@/types/workflow";
import { redis } from "@/lib/redis";
import { getWorkflowAbortSignal, cleanupWorkflow } from "@/lib/cancel";
import TopologicalSort from "topological-sort";

export function topologicalSort(nodes: Node[], edges: Edge[]) {
  const graph = new TopologicalSort(new Map());
  const excludeTypes: NodeType[] = [NodeTypeEnum.COMMENT];

  console.log("[Graph] Adding nodes...");
  nodes.forEach((node) => {
    graph.addNode(node.id, node);
  });
  console.log(
    "[Graph] Nodes added:",
    nodes.map((n) => ({ id: n.id, type: n.type })),
  );

  console.log("[Graph] Adding edges...");
  edges.forEach((edge) => {
    graph.addEdge(edge.source, edge.target);
  });
  console.log(
    "[Graph] Edges added:",
    edges.map((e) => `${e.source} → ${e.target}`),
  );

  try {
    const sortedResult = graph.sort();
    const sortedIds = Array.from(sortedResult.keys());

    const sortedNodes = sortedIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter(
        (n) =>
          n?.type !== undefined && !excludeTypes.includes(n.type as NodeType),
      );

    console.log(
      "[Graph] Topological order (filtered):",
      sortedNodes.map((n) => ({ id: n?.id, type: n?.type })),
    );
    return sortedNodes;
  } catch (error) {
    throw new Error(
      "Workflow contains a cycle or invalid dependencies. Cannot execute",
      { cause: error },
    );
  }
}

export const getNextNode = (
  currentNodeId: string,
  edges: Edge[],
  context: ExecutorContextType,
) => {
  const outgoingEdges = edges.filter((edge) => edge.source === currentNodeId);
  if (outgoingEdges.length === 0) return [];

  const currentOutput = context.outputs[currentNodeId] as
    | { output?: { selectedBranch?: string } }
    | undefined;

  if (currentOutput?.output?.selectedBranch) {
    const branchEdge = outgoingEdges.find(
      (edge) => edge.sourceHandle === currentOutput.output?.selectedBranch,
    );
    return branchEdge ? [branchEdge.target] : [];
  }
  return outgoingEdges.map((edge) => edge.target);
};

export const executeWorkflow = async (
  nodes: Node[],
  edges: Edge[],
  userInput: string,
  messages: UIMessage[],
  channel: ExecutorContextType["channel"],
  workflowRunId: string,
) => {
  const startNode = nodes.find((n) => n.type === NodeTypeEnum.START);
  if (!startNode) throw new Error("Start node is not found in the workflow");

  const cancelledInRedis = await redis?.get(`cancel:${workflowRunId}`);
  if (cancelledInRedis) {
    console.log(`[Workflow] Cancelled before start (Redis flag)`);
    await channel.emit("workflow.chunk", {
      type: "finish",
      finishReason: "stop",
    });
    cleanupWorkflow(workflowRunId);
    return { success: true, output: "Workflow cancelled by user" };
  }

  const signal = getWorkflowAbortSignal(workflowRunId);

  const context: ExecutorContextType = {
    outputs: {
      [startNode.id]: {
        input: userInput,
      },
    },
    history: messages || [],
    workflowRunId,
    channel,
    signal,
  };
  const sortedNodes = topologicalSort(nodes, edges);
  const nodeToExecuteNext = new Set<string>([startNode.id]);
  let lastOutputText = "";

  for (const node of sortedNodes) {
    if (!node) {
      throw new Error("Something went wrong");
    }
    if (!nodeToExecuteNext.has(node?.id as string)) {
      continue;
    }
    if (signal.aborted) {
      console.log(`[Workflow] Cancelled before executing node ${node.id}`);
      await channel.emit("workflow.chunk", {
        type: "finish",
        finishReason: "stop",
      });
      cleanupWorkflow(workflowRunId);
      return { success: true, output: "Workflow cancelled by user" };
    }
    const nodeType = node?.type as NodeType;
    const executor = getNodeExecutor(nodeType);
    if (!executor) continue;

    await channel.emit("workflow.chunk", {
      type: "data-workflow-Node",
      id: node.id,
      data: {
        id: node.id,
        nodeType: node.type,
        nodeName: node.data?.label,
        status: "processing",
      },
    });

    try {
      const result = await executor(node, context);
      const outputText = result.output?.text ?? result.output;
      await channel.emit("workflow.chunk", {
        type: "data-workflow-Node",
        id: node?.id,
        data: {
          id: node?.id,
          nodeType: node?.type,
          nodeName: node?.data.label,
          status: "complete",
          ...(outputText ? { output: outputText } : {}),
        },
      });

      if (node?.type !== NodeTypeEnum.START) {
        context.outputs[node.id] = result;
        const outputText = result?.output?.text ?? "";
        if (outputText) lastOutputText = outputText;
        const nextNodes = getNextNode(node.id, edges, context);
        nextNodes.forEach((id) => nodeToExecuteNext.add(id));
      }

      if (node?.type === NodeTypeEnum.END) {
        console.log("Workflow execution completed");
        const endOutput = result?.output?.input ?? result?.output?.text ?? "";
        await emitTextResponse(channel, endOutput || lastOutputText);
        await channel.emit("workflow.chunk", {
          type: "finish",
          finishReason: "stop",
        });
        cleanupWorkflow(workflowRunId);
        return {
          success: true,
          output: context.outputs,
        };
      }

      const nextNodeIds = getNextNode(node?.id, edges, context);

      if (nextNodeIds.length === 0) {
        await emitTextResponse(channel, lastOutputText);
        await channel.emit("workflow.chunk", {
          type: "finish",
          finishReason: "stop",
        });
        cleanupWorkflow(workflowRunId);
        return {
          success: true,
          output: "Workflow Stopped!!! Nothing to execute",
        };
      }

      nextNodeIds.forEach((id) => nodeToExecuteNext.add(id));
    } catch (error) {
      await channel.emit("workflow.chunk", {
        type: "data-workflow-Node",
        id: node.id,
        data: {
          id: node.id,
          nodeType: node.type,
          nodeName: node.data?.label,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });

      cleanupWorkflow(workflowRunId);
      throw error;
    }
  }

  await emitTextResponse(channel, lastOutputText);
  await channel.emit("workflow.chunk", {
    type: "finish",
    finishReason: "stop",
  });
  cleanupWorkflow(workflowRunId);

  return {
    success: true,
    output: context.outputs,
  };
};

async function emitTextResponse(
  channel: ExecutorContextType["channel"],
  text: string,
) {
  if (!text || text.trim().length === 0) return;
  const trimmed = text.trim();
  const chunkSize = 500;
  for (let i = 0; i < trimmed.length; i += chunkSize) {
    await channel.emit("workflow.chunk", {
      type: "text-delta",
      textDelta: trimmed.slice(i, i + chunkSize),
    });
  }
}
