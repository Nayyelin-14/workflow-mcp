"use client";
import { useGetWorkflowById } from "@/features/use-workflow";
import { useParams } from "next/navigation";
import React from "react";
import Header from "./_common/header";
import { Spinner } from "@/components/ui/spinner";
import { WorkflowProvider } from "@/context/workflow-context";

const page = () => {
  const params = useParams();
  const workflowId = params?.workflowId as string;
  const {
    data: workflow,
    isPending,
    isError,
    error,
  } = useGetWorkflowById(workflowId);
  console.log({ workflow, isPending, isError, error });
  if (!workflow && !isPending) {
    return <div>Workflow not found</div>;
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen relative">
        <WorkflowProvider>
          <Header
            name={workflow?.name!}
            workflowId={workflowId!}
            isLoading={isPending}
          />
          <div className="flex-1 relative overflow-hidden">
            {isPending ? (
              <div className="flex items-center justify-center h-full">
                <Spinner className="size-12 text-primary" />
              </div>
            ) : (
              <div></div>
            )}
          </div>
        </WorkflowProvider>
      </div>
    </div>
  );
};

export default page;
