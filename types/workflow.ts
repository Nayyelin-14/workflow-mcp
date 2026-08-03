import { UIMessage } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Channel = { emit: (...args: any[]) => Promise<void> };

export type ExecutorContextType = {
  outputs: Record<string, unknown>;
  history: UIMessage[];
  workflowRunId: string;
  channel: Channel;
  signal?: AbortSignal;
};
export type ExecutorResultType = {
  output: unknown;
};
