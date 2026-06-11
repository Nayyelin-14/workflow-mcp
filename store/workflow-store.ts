import { Edge, Node } from "@xyflow/react";
import { create } from "zustand";

interface WorkflowStoreState {
  savedNodes: Node[];
  savedEdges: Edge[];
  setSavedState: (nodes: Node[], edges: Edge[]) => void;
  resetSavedState: () => void;
}

export const useWorkflowStore = create<WorkflowStoreState>((set) => ({
  savedEdges: [],
  savedNodes: [],
  setSavedState: (nodes, edges) => set({ savedEdges: edges, savedNodes: nodes }),
  resetSavedState: () =>
    set({
      savedEdges: [],
      savedNodes: [],
    }),
}));
