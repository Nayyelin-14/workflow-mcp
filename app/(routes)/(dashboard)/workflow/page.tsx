"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteWorkflow, useGetWorkflows } from "@/features/use-workflow";
import { Trash2Icon, WorkflowIcon } from "lucide-react";
import CreateWorkflow from "../_common/createWorkflow";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useState } from "react";

const Page = () => {
  const router = useRouter();
  const { data, isPending } = useGetWorkflows();
  const workflows = data || [];
  const { mutate: deleteWorkflow, isPending: isDeleting } =
    useDeleteWorkflow();
  const [workflowToDelete, setWorkflowToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleConfirmDelete = () => {
    if (!workflowToDelete) return;
    deleteWorkflow(workflowToDelete.id, {
      onSuccess: () => setWorkflowToDelete(null),
    });
  };

  return (
    <div className="min-h-auto">
      <div className="py-6 flex flex-col gap-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Workflows</h1>
            <p className="text-muted-foreground mt-1">
              Build a chat agent workflow with custom logic and tools
            </p>
          </div>
          <CreateWorkflow />
        </div>

        <div>
          {isPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : workflows && workflows.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {workflows.map((w) => (
                <Card className="relative group" key={w.id}>
                  <Button
                    variant={"ghost"}
                    size={"icon-sm"}
                    className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setWorkflowToDelete({ id: w.id, name: w.name })}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                  <CardContent
                    className="space-y-5 cursor-pointer"
                    onClick={() => router.push(`/SingleWorkflow/${w.id}`)}
                  >
                    <div>
                      <div className="relative mb-3">
                        <div className="flex items-center justify-center w-10 h-10  rounded-xl bg-primary/10 text-primary">
                          <WorkflowIcon size={22} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground text-base">
                          {w.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 text-ellipsis">
                          {w.description ?? "No description"}
                        </p>
                      </div>
                    </div>
                    <div className="pt-1 flex items-center text-xs text-muted-foreground/70 font-medium ">
                      <span>
                        {format(new Date(w.createdAt), "MMM d , yyyy")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WorkflowIcon size={28} />
                </EmptyMedia>
                <EmptyTitle>No Workflows Found</EmptyTitle>
                <EmptyDescription>
                  You have not created any workflows yet.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <Dialog
        open={!!workflowToDelete}
        onOpenChange={(open) => !open && setWorkflowToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workflow?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{workflowToDelete?.name}
              &rdquo;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={"outline"}
              disabled={isDeleting}
              onClick={() => setWorkflowToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant={"destructive"}
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting && <Spinner />}
              {isDeleting ? "Deleting" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Page;
