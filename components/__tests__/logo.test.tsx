import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Logo from "@/components/logo";

vi.mock("next/navigation", () => ({
  useRouter: () => ({}),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("Logo", () => {
  it("renders brand name", () => {
    render(<Logo />);
    expect(screen.getByText("Flow")).toBeInTheDocument();
    expect(screen.getByText("agent.ai")).toBeInTheDocument();
  });

  it("links to /workflow", () => {
    render(<Logo />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/workflow");
  });

  it("renders the F icon", () => {
    render(<Logo />);
    expect(screen.getByText("F")).toBeInTheDocument();
  });
});
