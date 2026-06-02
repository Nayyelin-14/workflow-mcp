import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PlusIcon, WorkflowIcon } from "lucide-react";
import React from "react";

const page = () => {
  return (
    <div className="min-h-auto">
      <div className="py-6 flex flex-col gap-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Workflows</h1>
            <p className="text-muted-foreground mt-1">
              Build a chat agent workflow with custom logic and tools
            </p>
          </div>
          <Button>
            <PlusIcon size={18} />
            New Workflow
          </Button>
        </div>

        <div>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant={"icon"}>
                <WorkflowIcon size={28} />
              </EmptyMedia>
              <EmptyTitle>No Workflows Found</EmptyTitle>
              <EmptyDescription>
                You have not created any workflows yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    </div>
  );
};

export default page;
