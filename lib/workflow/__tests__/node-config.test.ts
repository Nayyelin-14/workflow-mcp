import { describe, it, expect } from "vitest";
import {
  NODE_CONFIG,
  getNodeConfig,
  createNode,
  NodeTypeEnum,
  type NodeSettingsProps,
} from "@/lib/workflow/node-config";

describe("NODE_CONFIG", () => {
  it("has all 6 node types", () => {
    expect(Object.keys(NODE_CONFIG)).toHaveLength(6);
  });

  it("each node has required fields", () => {
    for (const config of Object.values(NODE_CONFIG)) {
      expect(config).toHaveProperty("type");
      expect(config).toHaveProperty("label");
      expect(config).toHaveProperty("icon");
      expect(config).toHaveProperty("color");
      expect(config).toHaveProperty("inputs");
    }
  });

  it("comment node has correct config", () => {
    const config = NODE_CONFIG[NodeTypeEnum.COMMENT];
    expect(config.label).toBe("Comment");
    expect(config.color).toBe("bg-yellow-500");
    expect(config.inputs).toHaveProperty("comment");
    expect(config.inputs.comment).toBe("");
    expect(config.outputs).toContain("output.comment");
  });
});

describe("getNodeConfig", () => {
  it("returns config for valid type", () => {
    const config = getNodeConfig(NodeTypeEnum.START);
    expect(config).not.toBeNull();
    expect(config?.label).toBe("Start");
  });

  it("returns config for comment type", () => {
    const config = getNodeConfig(NodeTypeEnum.COMMENT);
    expect(config?.label).toBe("Comment");
  });

  it("returns null for invalid type", () => {
    const config = getNodeConfig("invalid" as never);
    expect(config).toBeNull();
  });
});

describe("createNode", () => {
  it("creates a node with default position", () => {
    const node = createNode({ type: NodeTypeEnum.AGENT });
    expect(node.id).toMatch(/^agent-/);
    expect(node.type).toBe("agent");
    expect(node.position).toEqual({ x: 400, y: 200 });
  });

  it("creates a node with custom position", () => {
    const node = createNode({
      type: NodeTypeEnum.END,
      position: { x: 100, y: 300 },
    });
    expect(node.position).toEqual({ x: 100, y: 300 });
  });

  it("start node is not deletable", () => {
    const node = createNode({ type: NodeTypeEnum.START });
    expect(node.deleteable).toBe(false);
  });

  it("other nodes are deletable", () => {
    const node = createNode({ type: NodeTypeEnum.IF_ELSE });
    expect(node.deleteable).toBe(true);
  });

  it("includes input defaults in data", () => {
    const node = createNode({ type: NodeTypeEnum.HTTP });
    expect(node.data).toMatchObject({
      method: "GET",
      url: "",
    });
  });

  it("creates comment node with empty comment", () => {
    const node = createNode({ type: NodeTypeEnum.COMMENT });
    expect(node.type).toBe("comment");
    expect(node.data).toHaveProperty("comment");
    expect(node.data.comment).toBe("");
    expect(node.data.label).toBe("Comment");
  });

  it("throws for unknown type", () => {
    expect(() => createNode({ type: "unknown" as never })).toThrow(
      "No node config found unknown",
    );
  });
});
