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
      comment: " ",
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
  const nodeType = NODE_CONFIG?.[type];

  if (!nodeType) return null;

  return nodeType;
};

export type CreateNodeOptions = {
  type: NodeType;
  position?: { x: number; y: number };
};

export function createNode({
  type,
  position = { x: 400, y: 200 },
}: CreateNodeOptions) {
  const config = getNodeConfig(type);

  if (!config) {
    throw new Error(`No node config found ${type}`);
  }
  const id = generateID(type);
  return {
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
}
