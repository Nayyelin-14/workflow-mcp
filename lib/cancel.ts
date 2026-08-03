import { redis } from "./redis";

const controllers = new Map<string, AbortController>();

export function cancelWorkflow(workflowRunId: string) {
  let controller = controllers.get(workflowRunId);
  if (!controller) {
    controller = new AbortController();
    controllers.set(workflowRunId, controller);
  }
  controller.abort();
  redis?.set(`cancel:${workflowRunId}`, "1", { ex: 120 }).catch(() => {});
}

export function getWorkflowAbortSignal(workflowRunId: string): AbortSignal {
  let controller = controllers.get(workflowRunId);
  if (!controller) {
    controller = new AbortController();
    controllers.set(workflowRunId, controller);
  }
  return controller.signal;
}

export function cleanupWorkflow(workflowRunId: string) {
  controllers.delete(workflowRunId);
  redis?.del(`cancel:${workflowRunId}`).catch(() => {});
}
