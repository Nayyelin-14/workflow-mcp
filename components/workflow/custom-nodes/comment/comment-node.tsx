import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NodeProps } from "@xyflow/react";
import React from "react";
import { useNodeData } from "@/hooks/use-node-data";

const CommentNode = ({ data, id: nodeId }: NodeProps) => {
  const { value: comment, handleChange: setComment, handleBlur: handleCommentBlur } = useNodeData(
    nodeId,
    "comment",
    ((data?.comment as string) || "").trim(),
  );
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
        onBlur={handleCommentBlur}
        className="h-full w-full px-1! border-none focus-visible:ring-offset-0 shadow-none overflow-auto 
        resize-none border-0 bg-transparent
        p-1 text-xs placeholder:text-xs focus-visible:ring-0 dark:bg-transparent
    dark:text-black max-h-37.5 min-h-20 "
        placeholder="Write down the comment"
      />
    </div>
  );
};

export default CommentNode;
