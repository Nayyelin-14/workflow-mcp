import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";
import React from "react";

export const ExecuteStartNode = (node: Node, context: ExecutorContextType) => {
  console.log(`\n=== Start Node [${node.id}] ===`);
  const startOutput = context.outputs[node.id] as { input?: string } | undefined;
  const result = {
    output: {
      input: startOutput?.input || "",
    },
  };
  console.log("Start output:", JSON.stringify(result, null, 2));
  return result;
};
