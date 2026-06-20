import { ExecutorContextType } from "@/types/workflow";
import { Node } from "@xyflow/react";
import React from "react";

export const ExecuteStartNode = (node: Node, context: ExecutorContextType) => {
  return {
    output: {
      input: context.outputs[node.id]?.input || "",
    },
  };
};
