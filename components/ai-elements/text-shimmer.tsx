import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type TextShimmerLoaderProps = HTMLAttributes<HTMLSpanElement> & {
  text: string;
};

export const TextShimmerLoader = ({
  text,
  className,
  ...props
}: TextShimmerLoaderProps) => (
  <span
    className={cn(
      "bg-clip-text text-sm font-medium text-transparent",
      "bg-[linear-gradient(90deg,var(--muted-foreground)_40%,var(--foreground)_50%,var(--muted-foreground)_60%)]",
      "bg-[length:200%_100%] animate-[text-shimmer_2s_linear_infinite]",
      className,
    )}
    {...props}
  >
    {text}
  </span>
);
