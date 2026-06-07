import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReactFlow } from "@xyflow/react";
import React, { useState } from "react";
import MentionInput from "../../mention-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronsUpDownIcon, Plus, X } from "lucide-react";
import { MODELS, TOOLS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { JsonSchema } from "./json-schema";

type props = {
  nodeId: string;
  data: any;
};
const OUTPUT_FORMATS = [
  { value: "text", label: "text" },
  { value: "json", label: "json" },
];

const AgentSettings = ({ nodeId, data }: props) => {
  const { updateNodeData } = useReactFlow();
  const [openModel, setOpenModel] = useState<boolean>(false);
  const [openFormat, setOpenFormat] = useState<boolean>(false);

  const [agentLabel, setAgentLabel] = useState<string>(data?.label || "Agent");

  const [instructions, setInstructions] = useState(data?.instructions || "");

  const model = data?.model;
  const tools = data?.tools || [];
  const outputFormat = data?.outputFormat || "text";
  const responseSchema = data?.responseSchema || {
    type: "object",
    title: "response_schema",
    properties: {},
  };

  const handleChange = (key: string, value: any) => {
    updateNodeData(nodeId, {
      [key]: value,
    });
  };

  const handleAddTool = (toolId: string) => {
    if (toolId === "mcpServer") {
      return;
    }
    const exists = tools.some(
      (t: any) => t.type === "native" && t.value === toolId,
    );
    if (!exists) {
      handleChange("tools", [
        ...tools,
        {
          type: "native",
          value: toolId,
        },
      ]);
    }
  };

  const handleRemoveTool = (index: number) => {
    handleChange(
      "tools",
      tools.filter((_: any, i: number) => i !== index),
    );
  };
  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Agent Name</Label>
          <Input
            value={agentLabel}
            onBlur={(e) => handleChange("label", e.target.value)}
            onChange={(e) => setAgentLabel(e.target.value)}
            placeholder="Agent"
            className="h-8"
          />
        </div>
        <div className="space-y-2">
          <Label>System instructions</Label>
          <MentionInput
            showTriggerButton={true}
            nodeId={nodeId}
            value={instructions}
            onChange={setInstructions}
            multiline={true}
            placeholder="You are a helpful AI assistant"
            onBlur={() => handleChange("instructions", instructions)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Tools</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size={"icon-sm"} variant={"outline"}>
                  <Plus className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {TOOLS?.filter(
                  (tool) =>
                    !tools.some(
                      (t: any) => t.type === "native" && t.value === tool.id,
                    ),
                ).map((tool) => {
                  const Icon = tool.icon;

                  return (
                    <DropdownMenuItem
                      key={tool.id}
                      onClick={() => handleAddTool(tool.id)}
                    >
                      <Icon className="size-4!" />
                      <span>{tool.name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {tools.length > 0 && (
            <div className="flex flex-wrap ga-2">
              {tools.map((tool: any, index: number) => {
                const nativeTool =
                  tool.type === "native"
                    ? TOOLS.find((t) => t.id === tool.value)
                    : null;
                const Icon = nativeTool?.icon;
                const label =
                  tool.type === "native" ? nativeTool?.name : tool.name;
                return (
                  <Badge>
                    {Icon && <Icon className="h-4 w-4" />}
                    {label}
                    <button
                      type="button"
                      className="ml-1 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleRemoveTool(index);
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
        {/* model select */}
        <div className="flex items-center justify-between">
          <Label>Model</Label>
          <Popover open={openModel} onOpenChange={setOpenModel}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="text-xs justify-between">
                {model
                  ? MODELS.find((m) => m.value === model)?.label
                  : MODELS[0]?.label}
                <ChevronsUpDownIcon className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <Command>
                <CommandInput placeholder="sSearch Model" className="h-8" />
                <CommandList>
                  <CommandEmpty>No model found</CommandEmpty>
                  <CommandGroup>
                    {MODELS.map((m) => (
                      <CommandItem
                        key={m.value}
                        value={m.value}
                        data-checked={model === m.value || undefined}
                        onSelect={(value) => {
                          handleChange("model", value);
                          setOpenModel(false);
                        }}
                      >
                        {m.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* output format */}
        <div className="flex items-center justify-between">
          <Label>Output Format</Label>
          <Popover open={openFormat} onOpenChange={setOpenFormat}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="text-xs justify-between">
                {OUTPUT_FORMATS.find((f) => f.value === outputFormat)?.label}
                <ChevronsUpDownIcon className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0 w-fit">
              <Command>
                <CommandList>
                  <CommandEmpty>No format found</CommandEmpty>
                  <CommandGroup>
                    {OUTPUT_FORMATS.map((format) => (
                      <CommandItem
                        key={format.value}
                        value={format.value}
                        data-checked={
                          outputFormat === format.value || undefined
                        }
                        onSelect={(value) => {
                          updateNodeData(nodeId, {
                            outputFormat: value,
                            outputs: value === "text" ? ["output.text"] : [],
                            responseSchema:
                              value === "text" ? {} : responseSchema,
                          });
                          setOpenFormat(false);
                        }}
                        className="cursor-pointer"
                      >
                        {format.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* output format if json */}
        {outputFormat === "json" && (
          <div className="space-y-2 border-t pt-3">
            <Label>JSON schema</Label>
            <JsonSchema
              schema={responseSchema}
              onChange={(schema) => {
                const newOutputList = Object.keys(schema?.properties || {}).map(
                  (key) => `output.${key}`,
                );
                updateNodeData(nodeId, {
                  responseSchema: schema,
                  outputs: newOutputList,
                });
              }}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default AgentSettings;
