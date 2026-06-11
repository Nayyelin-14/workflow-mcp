import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NodeProps, useReactFlow } from "@xyflow/react";
import React, { useState } from "react";

const CommentNode = ({ data, id: nodeId }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const [comment, setComment] = useState<string>(
    (data?.comment as string) || "",
  );

  const handleCommentChange = (value: string) => {
    updateNodeData(nodeId, {
      comment: value,
    });
  };
  return (
    <div
      className={cn(
        `h-full box-border p-1 border rounded-lg bg-amber-300 dark:bg-[#b08915] w-full`,
      )}
      style={{ width: "155px", minHeight: "100px", maxHeight: "180px" }}
    >
      <Textarea
        value={comment || ""}
        onChange={(e) => setComment(e.target.value)}
        onBlur={() => handleCommentChange(comment)}
      />
    </div>
  );
};

export default CommentNode;
