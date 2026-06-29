import { Node } from "@xyflow/react";

export const ExecuteEndNode = (node: Node) => {
  console.log(`\n=== End Node [${node.id}] ===`);
  const text = node?.data.value as string;
  console.log("End value:", text);
  const result = {
    output: {
      input: text,
    },
  };
  console.log("End output:", JSON.stringify(result, null, 2));
  return result;
};
