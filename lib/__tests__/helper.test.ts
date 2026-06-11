import { describe, it, expect } from "vitest";
import { generateID } from "@/lib/helper";

describe("generateID", () => {
  it("returns a string with the type prefix", () => {
    const id = generateID("start");
    expect(id).toMatch(/^start-/);
  });

  it("lowercases the type", () => {
    const id = generateID("AGENT");
    expect(id).toMatch(/^agent-/);
  });

  it("includes a nanoid suffix of 10 chars", () => {
    const id = generateID("end");
    const suffix = id.slice(id.indexOf("-") + 1);
    expect(suffix).toHaveLength(10);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateID("node")));
    expect(ids.size).toBe(100);
  });
});
