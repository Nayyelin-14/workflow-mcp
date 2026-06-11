import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import React from "react";
import type { NodeSettingsProps } from "@/lib/workflow/node-config";
import { useNodeData } from "@/hooks/use-node-data";

const EndNodeSettings = ({ nodeId, data }: NodeSettingsProps) => {
  const { value, handleChange, handleBlur } = useNodeData(nodeId, "value", (data.value as string) || "");
  return (
    <div className="space-y-2">
      <Label className="font-medium" htmlFor="output">
        Output
      </Label>
      <Textarea
        id="output"
        value={value || ""}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="bg-muted/50 resize-none"
        rows={4}
        placeholder="Define the output variable or message"
      />
      <p className="text-xs text-muted-foregrounf">
        Set the final output value or message for the workflow
      </p>
    </div>
  );
};

export default EndNodeSettings;
