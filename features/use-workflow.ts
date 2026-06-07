import { useMutation, useQuery } from "@tanstack/react-query";
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
  return useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      const res = await axios.get(`/api/workflow/${workflowId}`);
      return (res.data?.data as WorkflowDetail) ?? null;
    },
    enabled: !!workflowId,
    retry: false,
  });
};

type wrokFlowPayload = {
  name: string;
  description?: string;
};
export const useCreateWorkFlow = () => {
  return useMutation({
    mutationFn: async ({ name, description }: wrokFlowPayload) =>
      axios
        .post("/api/workflow", { name, description })
        .then((res) => res.data),
    onSuccess: (data) => {
      toast.success("Workflow created successfully");
    },
    onError: (error) => {
      console.log(error);
      toast.error("Failed to create workflow");
    },
  });
};
