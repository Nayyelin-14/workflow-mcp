import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { CopyIcon, FileText } from "lucide-react";
import React from "react";
import { toast } from "sonner";

const StartNodeSettings = ({ nodeId }: { nodeId: string }) => {
  const inputVariable = `${nodeId}-input`;
  const onCopy = () => {
    navigator.clipboard.writeText(`{{${inputVariable}}`);
    toast.success("Variable copied to clipboard");
  };
  return (
    <div className="space-y-2">
      <h5 className="font-medium">Input Variable</h5>
      <InputGroup>
        <InputGroupAddon>
          <FileText className="size-4 text-purple-500" />
        </InputGroupAddon>
        <code className="flex-1 px-2 py-1 font-mono bg-background">{`{{${inputVariable}}`}</code>
        <InputGroupButton
          variant={"ghost"}
          size={"icon-sm"}
          className="h-6"
          onClick={() => onCopy()}
        >
          <CopyIcon className="size-4  text-muted-foreground" />
        </InputGroupButton>
      </InputGroup>
    </div>
  );
};

export default StartNodeSettings;
