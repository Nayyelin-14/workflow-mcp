// MCPDialog.tsx
// Modal for connecting a new MCP (Model Context Protocol) server.
// Two-step flow:
//   1. "connect" – user enters URL, label, and API key, then connects to probe available tools
//   2. "select"   – user picks which tools from the server to expose, then adds the server
import { addMCPServer, connectMcpServer } from "@/app/actions/agent-workflow";
import { MCPToolType } from "@/lib/constants";
import React, { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { KeyRoundIcon, Server } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";

// Props passed down from the parent component that opens this dialog.
interface MCPDialogProps {
  open: boolean; // whether the dialog is currently visible
  onOpenChange: (open: boolean) => void; // called to open/close the dialog
  onAdd: (data: {
    label: string; // user-friendly name for the server
    serverId: string; // server id returned by the backend after saving
    selectedTools: MCPToolType[]; // tools the user chose to enable
  }) => void; // called with the final result once the server is added
}

const MCPDialog: React.FC<MCPDialogProps> = ({ open, onOpenChange, onAdd }) => {
  // Which step of the wizard we're on. "connect" = enter server details, "select" = pick tools.
  const [step, setStep] = useState<"connect" | "select">("connect");

  // Connection form state.
  const [url, setUrl] = useState<string>(""); // server endpoint URL
  const [apiKey, setApiKey] = useState<string>(""); // auth token / API key
  const [label, setLabel] = useState<string>(""); // display name for the server
  const [tools, setTools] = useState<MCPToolType[]>([]); // tools discovered after connecting

  // UI state.
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set()); // names of checked tools
  const [loading, setLoading] = useState<boolean>(false); // true while awaiting a network call

  // Resets all local state so the next open starts fresh at the connect step.
  const reset = () => {
    setStep("connect");
    setUrl("");
    setApiKey("");
    setLabel("");
    setTools([]);
    setSelectedTools(new Set());
  };

  // Fetches the list of tools exposed by the server, then advances to the tool-selection step.
  const handleConnect = async () => {
    setLoading(true);
    try {
      const { tools } = await connectMcpServer({ url, apiKey });
      if (tools) setTools(tools);
      setSelectedTools(new Set(tools.map((tool) => tool.name))); // select all by default
      setStep("select");
      toast.success("Connected to MCP Server");
    } catch (error) {
      console.log(error);
      toast.error("Failed to connect to MCP server");
    } finally {
      setLoading(false);
    }
  };

  // Adds/removes a tool name from the selection set when its checkbox is toggled.
  const toggleTool = (name: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Persists the MCP server via the backend, reports the result to the parent, and closes.
  const handleAddMcp = async () => {
    setLoading(true);
    const selected_tools = tools.filter((t) => selectedTools.has(t.name));
    try {
      const { serverId } = await addMCPServer({ url, apiKey, label });
      onAdd({ label, serverId, selectedTools: selected_tools });
      onOpenChange(false);
      reset();
      toast.success("MCP server added successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to save MCP server");
    } finally {
      setLoading(false);
    }
  };

  // Static list of supported auth methods shown in the Authentication dropdown.
  const authList = [
    {
      value: "token",
      label: "Access token / API key",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg! px-0 pb-2"
        overlayClass="bg-black/60!"
        aria-describedby={undefined}
      >
        {/* STEP 1: server connection form */}
        {step === "connect" ? (
          <div className="pb-8">
            {/* Header: icon + title */}
            <div className="flex flex-col items-center mb-6">
              <Server className="w-8 h-8 mb-3 text-muted-foreground" />
              <DialogTitle className="text-lg font-semibold">
                Connect to MCP server
              </DialogTitle>
            </div>

            <div className="space-y-4 px-10 mx-auto">
              {/* URL input field */}
              {/* ======= */}
              <div>
                <Label className="mb-2">URL</Label>
                <InputGroup>
                  <InputGroupInput
                    id="mcp-url"
                    placeholder="https://mcp.exmaple.com/mcp"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </InputGroup>
                <p className="text-[10px] ml-3 text-muted-foreground/80 mt-1">
                  Only use MCP server you trust and verified
                </p>
              </div>
              {/* ======= */}

              {/* Label input field (display name) */}
              {/* ======= */}
              <div>
                <Label className="mb-2">Label</Label>
                <InputGroup>
                  <InputGroupInput
                    placeholder="my_mcp_server"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </InputGroup>
              </div>
              {/* ======= */}

              {/* Authentication method selector (only "token" supported for now) + API key input */}
              {/* ======= */}
              <div>
                <Label className="mb-2">Authentication</Label>
                <Select value="token" disabled>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {authList?.map((item) => (
                      <SelectItem value={item.value} key={item.label}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <InputGroup>
                    <InputGroupAddon>
                      <KeyRoundIcon className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="password"
                      placeholder="Add your api key/ access token"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </InputGroup>
                </div>
              </div>
              {/* ======= */}

              {/* Connect button – enabled only when all required fields are filled */}
              {/* ======= */}
              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleConnect}
                  disabled={!url || !label || !apiKey || loading}
                  className="w-28 cursor-pointer"
                >
                  {loading && <Spinner />}
                  Connect
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: tool selection */
          <div className="w-full px-6 mx-auto space-y-4">
            {/* Header showing the connected server's URL */}
            <div className="flex flex-col gap-1 mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-8 h-8 mb-3 text-muted-foreground" />
                <span className="text-base font-semibold">
                  Connect to MCP server
                </span>
                <p className="text-xs text-muted-foreground">{url}</p>
              </div>
            </div>

            {/* Scrollable list of discovered tools, each with a checkbox */}
            {/* ======= */}
            <div>
              <h1 className="font-semibold text-sm mb-2">TOOLS</h1>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {tools?.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-center gap-3 p-2 border border-black rounded-sm"
                  >
                    <Checkbox
                      checked={selectedTools.has(tool.name)}
                      onCheckedChange={() => toggleTool(tool.name)}
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-xs">{tool.name}</h5>
                      <p className="text-xs text-muted-foreground line-clamp-1 truncate max-w-75">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* ======= */}

            {/* Cancel + Add buttons; Add shows how many tools are selected */}
            {/* ======= */}
            <div className="felx gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                disabled={loading}
                onClick={handleAddMcp}
                className="flex-1"
              >
                {loading ? <Spinner /> : `Add (${selectedTools.size} selected)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MCPDialog;
