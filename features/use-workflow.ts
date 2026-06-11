import { useWorkflowStore } from "@/store/workflow-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edge, Node } from "@xyflow/react";
import axios from "axios";
import { toast } from "sonner";

export type WorkflowType = {
  id: string;
  userId: string;
  name: string;
  description: string;
  flowObject: string;
  createdAt: string;
  updatedAt: string;
};

export const useGetWorkflows = () => {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data } = await axios.get<{
        success: boolean;
        workflows: WorkflowType[];
      }>("/api/workflow");
      return data.workflows ?? [];
    },
  });
};

export type WorkflowDetail = {
  id: string;
  name: string;
  flowObject: Record<string, unknown>;
};

export const useGetWorkflowById = (workflowId: string) => {
  const { setSavedState } = useWorkflowStore();
  return useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      const res = await axios.get(`/api/workflow/${workflowId}`);
      const result = res?.data?.data as WorkflowDetail & {
        flowObject: { nodes: Node[]; edges: Edge[] };
      };
      if (result?.flowObject) {
        setSavedState(result.flowObject.nodes, result.flowObject.edges);
      }
      return result ?? null;
    },
    enabled: !!workflowId,
    retry: false,
  });
};

type WorkflowPayload = {
  name: string;
  description?: string;
};
export const useCreateWorkFlow = () => {
  return useMutation({
    mutationFn: async ({ name, description }: WorkflowPayload) =>
      axios
        .post("/api/workflow", { name, description })
        .then((res) => res.data),
    onSuccess: () => {
      toast.success("Workflow created successfully");
    },
    onError: () => {
      toast.error("Failed to create workflow");
    },
  });
};

export const useUpdateWorkflow = (workflowId: string) => {
  const { setSavedState } = useWorkflowStore();
  return useMutation({
    mutationFn: async (data: { nodes: Node[]; edges: Edge[] }) =>
      axios.put(`/api/workflow/${workflowId}`, data).then((res) => res.data),
    onSuccess: (result) => {
      const flowObject = result?.data?.flowObject as
        | { nodes: Node[]; edges: Edge[] }
        | undefined;
      if (flowObject) {
        setSavedState(flowObject.nodes, flowObject.edges);
      }
      toast.success("Workflow updated successfully");
    },
    onError: () => {
      toast.error("Failed to update workflow");
    },
  });
};
