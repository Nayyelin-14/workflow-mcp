import { describe, it, expect } from "vitest";
import { DRAG_DATA_TYPE, MODELS, TOOLS } from "@/lib/constants";

describe("DRAG_DATA_TYPE", () => {
  it("is the correct mime type string", () => {
    expect(DRAG_DATA_TYPE).toBe("application/reactflow");
  });
});

describe("MODELS", () => {
  it("has model entries with value and label", () => {
    for (const model of MODELS) {
      expect(model).toHaveProperty("value");
      expect(model).toHaveProperty("label");
    }
  });

  it("has Gemini models available", () => {
    const geminiModels = MODELS.filter((m) =>
      m.value.startsWith("google/gemini"),
    );
    expect(geminiModels.length).toBeGreaterThan(0);
  });
});

describe("TOOLS", () => {
  it("has tool entries with required fields", () => {
    for (const tool of TOOLS) {
      expect(tool).toHaveProperty("id");
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("type");
    }
  });

  it("has native and mcp tool types", () => {
    const types = new Set(TOOLS.map((t) => t.type));
    expect(types.has("native")).toBe(true);
  });
});
