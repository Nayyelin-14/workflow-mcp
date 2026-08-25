// agent-settings.tsx
// Settings panel for an "Agent" node in the workflow canvas.
// Renders the controls used to configure an agent: its name, system
// instructions, available tools (native + MCP), model, and output format
// (text or JSON with a schema). Every change is written back into the
// node's `data` on the canvas via updateNodeData.
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
import { MCPToolType, MODELS, TOOLS } from "@/lib/constants";
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
import type { NodeSettingsProps } from "@/lib/workflow/node-config";
import MCPDialog from "@/components/mcp/mcp-dialog";

// The two supported output formats for an agent node.
const OUTPUT_FORMATS = [
  { value: "text", label: "text" },
  { value: "json", label: "json" },
];

const AgentSettings = ({ nodeId, data }: NodeSettingsProps) => {
  // Controls whether the "connect MCP server" dialog is open.
  const [mcpDialogOpen, setMcpDialogOpen] = useState<boolean>(false);

  const { updateNodeData } = useReactFlow();
  // Open/close state for the Model and Output Format popovers.
  const [openModel, setOpenModel] = useState<boolean>(false);
  const [openFormat, setOpenFormat] = useState<boolean>(false);

  // Local text bindings synced to the node once the field loses focus.
  const [agentLabel, setAgentLabel] = useState<string>(
    (data?.label as string) || "Agent",
  );

  const [instructions, setInstructions] = useState<string>(
    (data?.instructions as string) || "",
  );

  // Read the current values straight from the node's data.
  const model = data?.model;
  const tools =
    (data?.tools as {
      type: string;
      value: string;
      name?: string;
      label?: string;
    }[]) || [];
  const outputFormat = data?.outputFormat || "text";
  const responseSchema = (data?.responseSchema as Record<string, unknown>) || {
    type: "object",
    title: "response_schema",
    properties: {} as Record<string, unknown>,
  };

  // Generic helper: writes a single key/value pair into the node's data.
  const handleChange = (key: string, value: unknown) => {
    updateNodeData(nodeId, {
      [key]: value,
    });
  };

  // Adds a tool to the node. The special "mcpServer" id opens the MCP dialog
  // instead of adding a native tool immediately.
  const handleAddTool = (toolId: string) => {
    if (toolId === "mcpServer") {
      setMcpDialogOpen(true);
      return;
    }
    // Guard against adding the same native tool twice.
    const exists = tools.some(
      (t: { type: string; value: string }) =>
        t.type === "native" && t.value === toolId,
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

  // Callback from the MCP dialog: appends the chosen external server + tools
  // to this agent's own tool list.
  const handleAddMCPTools = ({
    label,
    serverId,
    selectedTools,
  }: {
    label: string;
    serverId: string;
    selectedTools: MCPToolType[];
  }) => {
    handleChange("tools", [
      ...tools,
      {
        type: "mcp",
        label,
        serverId,
        tools: selectedTools,
      },
    ]);
  };

  // Removes a tool from the list by its index.
  const handleRemoveTool = (index: number) => {
    handleChange(
      "tools",
      tools.filter(
        (_: { type: string; value: string }, i: number) => i !== index,
      ),
    );
  };
  return (
    <>
      <div className="space-y-4">
        {/* Agent display name */}
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

        {/* System instructions written to the model prompt */}
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

        {/* Tools: add native tools via dropdown, or connect an MCP server */}
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
                {/* Only show tools that aren't already selected */}
                {TOOLS?.filter(
                  (tool) =>
                    !tools.some(
                      (t) => t.type === "native" && t.value === tool.id,
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

          {/* Render the currently selected tools as removable badges */}
          {tools.length > 0 && (
            <div className="flex flex-wrap ga-2">
              {tools.map((tool, index: number) => {
                // Resolve the icon + name for native tools from the TOOLS catalog.
                const nativeTool =
                  tool.type === "native"
                    ? TOOLS.find((t) => t.id === tool.value)
                    : null;
                const Icon = nativeTool?.icon;
                const label =
                  tool.type === "native" ? nativeTool?.name : tool?.label;
                return (
                  <Badge key={`${tool.type}-${tool.value}-${index}`}>
                    {Icon && <Icon className="h-4 w-4" />}
                    {label}
                    <button
                      type="button"
                      className="ml-1 hover:text-destructive"
                      onClick={(e) => {
                        // Prevent the badge's default/click behavior from
                        // bubbling up, then remove the tool.
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

        {/* Model selector */}
        {/* model select */}
        <div className="flex items-center justify-between">
          <Label>Model</Label>
          <Popover open={openModel} onOpenChange={setOpenModel}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="text-xs justify-between">
                {/* Show the currently selected model's label, or default to the first one */}
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

        {/* output format: text vs json */}
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
                          // Switching to text clears the JSON schema and resets
                          // outputs; switching to json keeps the schema editor.
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

        {/* JSON schema editor, only shown when output format is json */}
        {/* output format if json */}
        {outputFormat === "json" && (
          <div className="space-y-2 border-t pt-3">
            <Label>JSON schema</Label>
            <JsonSchema
              schema={responseSchema}
              onChange={(schema) => {
                // Rebuild the node's outputs from the schema's properties so
                // each property becomes a connectionable output edge.
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

      {/* MCP connect dialog triggered by the "+" tools menu */}
      <MCPDialog
        open={mcpDialogOpen}
        onOpenChange={setMcpDialogOpen}
        onAdd={handleAddMCPTools}
      />
    </>
  );
};

export default AgentSettings;
