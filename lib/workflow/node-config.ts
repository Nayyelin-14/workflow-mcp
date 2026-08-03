/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Flag,
  GitBranch,
  Globe,
  MessageSquare,
  MousePointer2Icon,
  Play,
} from "lucide-react";
import { generateID } from "../helper";
import { MODELS } from "../constants";
import { ExecuteStartNode } from "@/components/workflow/custom-nodes/start/startnode-executor";
import { ExecuteAgentNode } from "@/components/workflow/custom-nodes/agent/agentnode-executor";
import { ExecuteIfElseNode } from "@/components/workflow/custom-nodes/if-else/ifelse-executor";
import { ExecuteEndNode } from "@/components/workflow/custom-nodes/end/endnode-executer";

export const NodeTypeEnum = {
  START: "start",
  AGENT: "agent",
  IF_ELSE: "if_else",
  END: "end",
  HTTP: "http",
  COMMENT: "comment",
} as const;

export type NodeType = (typeof NodeTypeEnum)[keyof typeof NodeTypeEnum];
// type NodeType = "start" | "agent" | "if_else" | "end" | "http" | "comment";
type NodeConfigBase = {
  type: NodeType;
  label: string;
  icon: React.ElementType;
  color: string;

  inputs: Record<string, any>;
  outputs: string[];
};

export const NODE_EXECUTORS = {
  [NodeTypeEnum.START]: ExecuteStartNode,
  [NodeTypeEnum.AGENT]: ExecuteAgentNode,
  [NodeTypeEnum.IF_ELSE]: ExecuteIfElseNode,
  [NodeTypeEnum.END]: ExecuteEndNode,
};

export const NODE_CONFIG: Record<NodeType, NodeConfigBase> = {
  [NodeTypeEnum.START]: {
    type: NodeTypeEnum.START,
    label: "Start",
    icon: Play,
    color: "bg-emerald-500",
    inputs: {
      inputValue: " ",
    },
    outputs: ["input"], //{{startId.input}}
  },

  [NodeTypeEnum.AGENT]: {
    type: NodeTypeEnum.AGENT,
    label: "Agent",
    icon: MousePointer2Icon,
    color: "bg-blue-500",
    inputs: {
      label: "Agent",
      instructions: "",
      model: MODELS[0].value,
      tools: [],
      outputFormat: "text", // text or json
      responseSchema: null,
    },
    outputs: ["output.text"], // {{agentid.output.classify}} ==="return_item"
  },

  [NodeTypeEnum.IF_ELSE]: {
    type: NodeTypeEnum.IF_ELSE,
    label: "If / Else",
    icon: GitBranch,
    color: "bg-orange-500",
    inputs: {
      conditions: [
        {
          caseName: "",
          variable: "",
          operator: "",
          value: "",
        },
      ],
    },
    outputs: ["output.result"],
  },

  [NodeTypeEnum.HTTP]: {
    type: NodeTypeEnum.HTTP,
    label: "HTTP",
    icon: Globe,
    color: "bg-blue-400",
    inputs: {
      method: "GET",
      url: "",
      headers: {},
      body: {},
    },
    outputs: ["output.body"],
  },

  [NodeTypeEnum.COMMENT]: {
    type: NodeTypeEnum.COMMENT,
    label: "Comment",
    icon: MessageSquare,
    color: "bg-yellow-500",
    inputs: {
      comment: "",
    },
    outputs: ["output.comment"],
  },

  [NodeTypeEnum.END]: {
    type: NodeTypeEnum.END,
    label: "End",
    icon: Flag,
    color: "bg-red-500",
    inputs: {
      value: " ",
    },
    outputs: ["output.end"],
  },
} as const;

export const getNodeConfig = (type: NodeType) => {
  console.log(`[node-config] getNodeConfig called for type: "${type}"`);
  const nodeType = NODE_CONFIG?.[type];

  if (!nodeType) {
    console.log(`[node-config] No config found for type: "${type}"`);
    return null;
  }

  console.log(
    `[node-config] Found config for "${type}":`,
    JSON.stringify(nodeType, null, 2),
  );
  return nodeType;
};
export const getNodeExecutor = (type: NodeType) => {
  console.log(`[node-config] getNodeExecutor called for type: "${type}"`);
  const nodeExecutor = NODE_EXECUTORS?.[type as keyof typeof NODE_EXECUTORS];

  if (!nodeExecutor) {
    console.log(`[node-config] No executor found for type: "${type}"`);
    return null;
  }

  console.log(`[node-config] Found executor for "${type}"`);
  return nodeExecutor;
};
export type NodeSettingsProps = {
  nodeId: string;
  data: Record<string, unknown>;
};

export type CreateNodeOptions = {
  type: NodeType;
  position?: { x: number; y: number };
};

export function createNode({
  type,
  position = { x: 400, y: 200 },
}: CreateNodeOptions) {
  console.log(`\n=== Creating Node ===`);
  console.log("Type:", type);
  console.log("Position:", JSON.stringify(position));

  const config = getNodeConfig(type);

  if (!config) {
    console.error(`No node config found for type: ${type}`);
    throw new Error(`No node config found ${type}`);
  }

  const id = generateID(type);
  console.log("Generated ID:", id);

  const node = {
    id,
    type,
    position,
    deleteable: type === NodeTypeEnum.START ? false : true,
    data: {
      label: config.label,
      color: config.color,
      nodeType: type,
      outputs: config.outputs,
      ...config.inputs,
    },
  };
  console.log("Created node:", JSON.stringify(node, null, 2));
  console.log("=== Node Created ===\n");
  return node;
}
