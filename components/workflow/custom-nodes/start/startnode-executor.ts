import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";
import React from "react";

export const ExecuteStartNode = (node: Node, context: ExecutorContextType) => {
  const startOutput = context.outputs[node.id] as { input?: string } | undefined;
  return {
    output: {
      input: startOutput?.input || "",
    },
  };
};
