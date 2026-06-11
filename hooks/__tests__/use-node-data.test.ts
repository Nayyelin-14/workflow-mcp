import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNodeData } from "@/hooks/use-node-data";

const mockUpdateNodeData = vi.fn();

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    updateNodeData: mockUpdateNodeData,
  }),
}));

describe("useNodeData", () => {
  beforeEach(() => {
    mockUpdateNodeData.mockClear();
  });

  it("initializes with given value", () => {
    const { result } = renderHook(() =>
      useNodeData("node-1", "comment", "initial"),
    );
    expect(result.current.value).toBe("initial");
  });

  it("initializes with function initializer", () => {
    const { result } = renderHook(() =>
      useNodeData("node-1", "comment", () => "computed"),
    );
    expect(result.current.value).toBe("computed");
  });

  it("handleChange updates local value", () => {
    const { result } = renderHook(() =>
      useNodeData("node-1", "comment", ""),
    );
    act(() => result.current.handleChange("new value"));
    expect(result.current.value).toBe("new value");
  });

  it("handleBlur calls updateNodeData with key and value", () => {
    const { result } = renderHook(() =>
      useNodeData("node-1", "comment", "saved"),
    );
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).toHaveBeenCalledWith("node-1", {
      comment: "saved",
    });
  });

  it("handleChange then handleBlur persists updated value", () => {
    const { result } = renderHook(() =>
      useNodeData("node-1", "value", ""),
    );
    act(() => result.current.handleChange("updated"));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).toHaveBeenCalledWith("node-1", {
      value: "updated",
    });
  });

  it("setValue works directly", () => {
    const { result } = renderHook(() =>
      useNodeData("node-1", "key", ""),
    );
    act(() => result.current.setValue("direct"));
    expect(result.current.value).toBe("direct");
  });
});
