import { useReactFlow, useStore } from "@xyflow/react";
import React from "react";
import { Button } from "../ui/button";
import {
  HandIcon,
  MaximizeIcon,
  MinusIcon,
  MousePointer2,
  PlusIcon,
} from "lucide-react";
import { Separator } from "../ui/separator";
import AutoLayoutButton from "./controls/auto-layout-button";
import AlignmentTools from "./controls/alignment-tools";

export const TOOL_MODE_ENUM = {
  SELECT: "select",
  HAND: "hand",
} as const;

export type ToolMode = (typeof TOOL_MODE_ENUM)[keyof typeof TOOL_MODE_ENUM];
type props = {
  toolMode: ToolMode;
  setToolMode: (toolMode: ToolMode) => void;
};
const Controls = ({ toolMode, setToolMode }: props) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const zoom = useStore((s) => s.transform[2]);
  const zoomPercent = Math.round(zoom * 100);
  return (
    <div className="-translate-x-1/2 absolute flex items-center gap-1 left-1/2 bottom-6 rounded-full border bg-background backdrop-blur-md py-1.5 px-3 shadow-lg z-50">
      <div className="flex items-center gap-1">
        <Button
          size={"icon"}
          className="rounded-full w-8 h-8"
          onClick={() => setToolMode(TOOL_MODE_ENUM.HAND)}
          variant={toolMode === TOOL_MODE_ENUM.HAND ? "secondary" : "ghost"}
        >
          <HandIcon size={16} />
        </Button>
        <Button
          size={"icon"}
          className="rounded-full w-8 h-8"
          onClick={() => setToolMode(TOOL_MODE_ENUM.SELECT)}
          variant={toolMode === TOOL_MODE_ENUM.SELECT ? "secondary" : "ghost"}
        >
          <MousePointer2 size={16} />
        </Button>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-2">
        <Button
          size={"icon"}
          className="rounded-full w-8 h-8"
          onClick={() => zoomOut()}
          variant={"ghost"}
        >
          <MinusIcon size={16} />
        </Button>
        <div className="min-w-7 text-center  text-[13px] font-medium tabular-nums">
          {zoomPercent}%
        </div>
        <Button
          size={"icon"}
          className="rounded-full w-8 h-8"
          onClick={() => zoomIn()}
          variant={"ghost"}
        >
          <PlusIcon size={16} />
        </Button>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <AutoLayoutButton />
      <AlignmentTools />
      <Separator orientation="vertical" className="h-4" />
      <Button
        size={"icon"}
        className="rounded-full w-8 h-8"
        onClick={() => fitView()}
        variant={"ghost"}
      >
        <MaximizeIcon size={16} />
      </Button>
    </div>
  );
};

export default Controls;
