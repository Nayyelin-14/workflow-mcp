import { useWorkflowStore } from "@/store/workflow-store";
import { Edge, Node } from "@xyflow/react";
import { useCallback, useMemo } from "react";

interface useUnsavedChangeReturn {
  hasUnsavedChanges: boolean;

  discardChanges: () => {
    nodes: Node[];
    edges: Edge[];
  };
}

export function useUnsavedChanges({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}): useUnsavedChangeReturn {
  const { savedEdges, savedNodes } = useWorkflowStore();
  const hasUnsavedChanges = useMemo(() => {
    const nodeData = (list: Node[]) =>
      list.map((n) => ({ id: n.id, type: n.type, data: n.data }));
    const edgeData = (list: Edge[]) =>
      list.map((e) => ({ source: e.source, target: e.target, id: e.id }));
    return (
      JSON.stringify(nodeData(nodes)) !==
        JSON.stringify(nodeData(savedNodes)) ||
      JSON.stringify(edgeData(edges)) !== JSON.stringify(edgeData(savedEdges))
    );
  }, [nodes, edges, savedEdges, savedNodes]);

  const discardChanges = useCallback(() => {
    return { nodes: savedNodes, edges: savedEdges };
  }, [savedEdges, savedNodes]);
  return {
    hasUnsavedChanges,
    discardChanges,
  };
}
