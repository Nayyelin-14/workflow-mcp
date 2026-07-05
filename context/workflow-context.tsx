import { createNode, NodeTypeEnum } from "@/lib/workflow/node-config";
import { Edge, Node } from "@xyflow/react";
import React, { createContext, useContext, useEffect, useState } from "react";

export type WorkFlowView = "edit" | "preview";
interface WorkflowContextType {
  view: WorkFlowView;
  setView: (view: WorkFlowView) => void;
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  getVariablesForNode: (nodeId: string) => {
    id: string;
    label: string;
    outputs: string[];
  }[];
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined,
);

// If/Else nodes used to expose a generic "source-1" handle in addition to
// their per-condition handles. That handle was removed, so edges saved
// against it point at a handle that no longer exists and can never render.
function sanitizeEdges(nodes: Node[], edges: Edge[]) {
  return edges.filter((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    return !(
      sourceNode?.type === NodeTypeEnum.IF_ELSE &&
      edge.sourceHandle === "source-1"
    );
  });
}

export function WorkflowProvider({
  workflowId,
  initialNodes,
  initialEdges,
  children,
}: {
  workflowId: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  children: React.ReactNode;
}) {
  const [view, setView] = useState<WorkFlowView>("edit");

  const start_node = createNode({
    type: NodeTypeEnum.START,
  });
  const [nodes, setNodes] = useState<Node[]>(() =>
    initialNodes?.length ? initialNodes : [start_node],
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    sanitizeEdges(initialNodes ?? [], initialEdges ?? []),
  );

  useEffect(() => {
    if (initialNodes?.length) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setNodes(initialNodes);
      setEdges(sanitizeEdges(initialNodes, initialEdges ?? []));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [workflowId, initialNodes, initialEdges]);
  const getUpStreamNodes = (nodeId: string) => {
    const upstream = new Set<string>();
    const addToset = (id: string) => {
      edges
        .filter((e) => e.target === id)
        .forEach((e) => {
          upstream.add(e.source);
          addToset(e.source);
        });
    };

    addToset(nodeId);
    return upstream;
  };
  const getVariablesForNode = (nodeId: string) => {
    const upstreamNodeIds = getUpStreamNodes(nodeId);

    return nodes
      .filter((node) => upstreamNodeIds.has(node.id))
      .map((n) => ({
        id: n.id,
        label: n.data.label as string,
        outputs: (n.data.outputs as string[]) || [],
      }));
  };
  return (
    <WorkflowContext.Provider
      value={{
        view,
        setView,
        nodes,
        setNodes,
        edges,
        setEdges,
        getVariablesForNode,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}
