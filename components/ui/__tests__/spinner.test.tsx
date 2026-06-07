import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "@/components/ui/spinner";

describe("Spinner", () => {
  it("renders with loading label", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading",
    );
  });

  it("applies custom className", () => {
    render(<Spinner className="text-red-500" />);
    expect(screen.getByRole("status")).toHaveClass("text-red-500");
  });
});
