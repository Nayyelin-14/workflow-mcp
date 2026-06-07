"use client";

import {
  TagsInputRoot,
  TagsInputInput as TagsInputInputPrimitive,
  TagsInputItem as TagsInputItemPrimitive,
  TagsInputItemText,
  TagsInputItemDelete,
  type TagsInputRootProps,
  type TagsInputInputProps,
  type TagsInputItemProps,
} from "@diceui/tags-input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function TagsInput(props: TagsInputRootProps) {
  return <TagsInputRoot {...props} />;
}

function TagsInputList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {children}
    </div>
  );
}

function TagsInputItem({
  children,
  className,
  ...props
}: TagsInputItemProps & { className?: string }) {
  return (
    <TagsInputItemPrimitive className={cn("", className)} {...props}>
      <TagsInputItemText>{children}</TagsInputItemText>
      <TagsInputItemDelete>
        <X className="size-3" />
      </TagsInputItemDelete>
    </TagsInputItemPrimitive>
  );
}

function TagsInputInput(props: TagsInputInputProps) {
  return <TagsInputInputPrimitive {...props} />;
}

export { TagsInput, TagsInputList, TagsInputItem, TagsInputInput };
