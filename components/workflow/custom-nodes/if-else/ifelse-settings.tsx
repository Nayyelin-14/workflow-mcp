import { useReactFlow } from "@xyflow/react";
import React from "react";
import { Condition } from "./ifelse-node";
import { Button } from "@/components/ui/button";
import { Plus, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import MentionInput from "../../mention-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeSettingsProps } from "@/lib/workflow/node-config";
const OPERATORS = [
  { label: "Equals", value: "=" },
  { label: "Not equals", value: "!=" },
  { label: "Contains", value: "contains" },
  { label: "Not contains", value: "not_contains" },
  { label: "Starts with", value: "starts_with" },
  { label: "Ends with", value: "ends_with" },
  { label: "Greater than", value: ">" },
  { label: "Less than", value: "<" },
  { label: "Greater than or equal", value: ">=" },
  { label: "Less than or equal", value: "<=" },
  { label: "Is empty", value: "is_empty" },
  { label: "Is not empty", value: "is_not_empty" },
] as const;

const IfElseNodeSettings = ({ nodeId, data }: NodeSettingsProps) => {
  const { updateNodeData } = useReactFlow();
  const conditions = (data?.conditions as Condition[]) || [];
  const condition_label = (index: number) => {
    if (index === 0) return "If";
    return "Else If";
  };

  const handleAddCondition = () => {
    updateNodeData(nodeId, {
      conditions: [
        ...conditions,
        {
          caseName: "",
          variable: "",
          operator: "",
        },
      ],
    });
    toast.info("New condition added");
  };
  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      const updatedConditions = conditions.filter((_, i) => i !== index);
      updateNodeData(nodeId, {
        conditions: updatedConditions,
      });
      toast.warning("Selected condition removed");
    }
  };

  const handleUpdateCondition = (
    index: number,
    conditionField: keyof Condition,
    conditionValue: string,
  ) => {
    const updateConditions = [...conditions];
    updateConditions[index] = {
      ...updateConditions[index],
      [conditionField]: conditionValue,
    };
    updateNodeData(nodeId, {
      conditions: updateConditions,
    });
  };
  return (
    <div>
      <div className="space-y-2">
        {conditions?.map((condition, index) => {
          return (
            <div
              key={`setting-condition-${index}`}
              className="space-y-2 pb-2.5 border-b last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {condition_label(index)}
                </h4>
                {conditions.length > 1 && (
                  <Button
                    variant={"ghost"}
                    size={"icon-sm"}
                    onClick={() => {
                      handleRemoveCondition(index);
                    }}
                    className="h-6 w-6  hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  value={condition.caseName || ""}
                  placeholder="Case name (Optional)"
                  className="bg-muted/50"
                  onChange={(e) => {
                    handleUpdateCondition(index, "caseName", e.target.value);
                  }}
                />
              </div>

              <MentionInput
                showTriggerButton={true}
                nodeId={nodeId}
                value={condition.variable || ""}
                onChange={(value) => {
                  handleUpdateCondition(index, "variable", value);
                }}
                multiline={false}
                placeholder="{{agent.output}}"
                classname="bg-muted/50 text-xs w-full "
              />
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={condition.operator || ""}
                  onValueChange={(value) => {
                    handleUpdateCondition(index, "operator", value);
                  }}
                >
                  <SelectTrigger className="w-28 text-xs">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="w-44">
                    {OPERATORS?.map((operator) => {
                      return (
                        <SelectItem key={operator.value} value={operator.value}>
                          {operator.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  className="bg-muted/50 text-xs"
                  placeholder="Value"
                  value={condition.value || ""}
                  onChange={(e) =>
                    handleUpdateCondition(index, "value", e.target.value)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
      <Button variant={"outline"} size={"sm"} onClick={handleAddCondition}>
        <Plus className="size-4" />
        Add new condition
      </Button>
    </div>
  );
};

export default IfElseNodeSettings;
