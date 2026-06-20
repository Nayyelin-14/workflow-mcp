import { UIMessage } from "ai";

export type ExecutorContextType = {
  outputs: Record<string, any>;
  history: UIMessage[];
  workflowRunId: string;
  channel: any;
};
export type ExecutorResultType = {
  output: any;
};
