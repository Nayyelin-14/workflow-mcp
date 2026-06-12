"use client";
import { useGetWorkflowById } from "@/features/use-workflow";
import { useParams } from "next/navigation";
import React from "react";
import Header from "./_common/header";
import { Spinner } from "@/components/ui/spinner";
import { WorkflowProvider } from "@/context/workflow-context";
import WorkflowCanvas from "./_common/workflow-canva";
import { Edge, Node, ReactFlowProvider } from "@xyflow/react";

const Page = () => {
  const params = useParams();
  const workflowId = params?.workflowId as string;
  const { data: workflow, isPending } = useGetWorkflowById(workflowId);
  const flowObject = workflow?.flowObject as
    | { nodes: Node[]; edges: Edge[] }
    | undefined;

  if (!workflow && !isPending) {
    return <div>Workflow not found</div>;
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen relative">
        <ReactFlowProvider>
          <WorkflowProvider
            workflowId={workflowId}
            initialNodes={flowObject?.nodes ?? []}
            initialEdges={flowObject?.edges ?? []}
          >
            <Header
              name={workflow?.name ?? ""}
              workflowId={workflowId}
              isLoading={isPending}
            />
            <div className="flex-1 relative overflow-hidden">
              {isPending ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner className="size-12 text-primary" />
                </div>
              ) : (
                <WorkflowCanvas workflowId={workflow.id} />
              )}
            </div>
            
          </WorkflowProvider>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default Page;
