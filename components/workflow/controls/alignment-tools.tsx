import { useWorkflow } from "@/context/workflow-context";
import { Button } from "@/components/ui/button";
import {
  AlignLeftIcon,
  AlignRightIcon,
  AlignStartHorizontalIcon,
  AlignEndHorizontalIcon,
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignVerticalDistributeCenterIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Node } from "@xyflow/react";

function alignLeft(nodes: Node[]): Node[] {
  const minX = Math.min(...nodes.map((n) => n.position.x));
  return nodes.map((n) => ({ ...n, position: { ...n.position, x: minX } }));
}

function alignRight(nodes: Node[]): Node[] {
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  return nodes.map((n) => ({ ...n, position: { ...n.position, x: maxX } }));
}

function alignTop(nodes: Node[]): Node[] {
  const minY = Math.min(...nodes.map((n) => n.position.y));
  return nodes.map((n) => ({ ...n, position: { ...n.position, y: minY } }));
}

function alignBottom(nodes: Node[]): Node[] {
  const maxY = Math.max(...nodes.map((n) => n.position.y));
  return nodes.map((n) => ({ ...n, position: { ...n.position, y: maxY } }));
}

function alignCenterH(nodes: Node[]): Node[] {
  const avgX = nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length;
  return nodes.map((n) => ({ ...n, position: { ...n.position, x: avgX } }));
}

function alignCenterV(nodes: Node[]): Node[] {
  const avgY = nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length;
  return nodes.map((n) => ({ ...n, position: { ...n.position, y: avgY } }));
}

function distributeH(nodes: Node[]): Node[] {
  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
  const totalWidth = sorted[sorted.length - 1].position.x - sorted[0].position.x;
  const gap = totalWidth / (sorted.length - 1);
  return nodes.map((n) => {
    const idx = sorted.findIndex((s) => s.id === n.id);
    return { ...n, position: { ...n.position, x: sorted[0].position.x + idx * gap } };
  });
}

function distributeV(nodes: Node[]): Node[] {
  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const totalHeight = sorted[sorted.length - 1].position.y - sorted[0].position.y;
  const gap = totalHeight / (sorted.length - 1);
  return nodes.map((n) => {
    const idx = sorted.findIndex((s) => s.id === n.id);
    return { ...n, position: { ...n.position, y: sorted[0].position.y + idx * gap } };
  });
}

const ALIGN_ACTIONS = [
  { label: "Align left", icon: AlignLeftIcon, action: alignLeft },
  { label: "Align center H", icon: AlignCenterHorizontalIcon, action: alignCenterH },
  { label: "Align right", icon: AlignRightIcon, action: alignRight },
  { label: "Align top", icon: AlignStartHorizontalIcon, action: alignTop },
  { label: "Align center V", icon: AlignCenterVerticalIcon, action: alignCenterV },
  { label: "Align bottom", icon: AlignEndHorizontalIcon, action: alignBottom },
  { label: "Distribute H", icon: AlignHorizontalDistributeCenterIcon, action: distributeH },
  { label: "Distribute V", icon: AlignVerticalDistributeCenterIcon, action: distributeV },
];

export default function AlignmentTools() {
  const { nodes, setNodes } = useWorkflow();

  const selectedNodes = nodes.filter((n) => n.selected);
  const hasSelection = selectedNodes.length > 1;

  const apply = (fn: (ns: Node[]) => Node[]) => {
    const selectedIds = new Set(selectedNodes.map((n) => n.id));
    setNodes((prev) =>
      prev.map((n) => (selectedIds.has(n.id) ? fn(selectedNodes).find((s) => s.id === n.id)! : n)),
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={"icon"}
          className="rounded-full w-8 h-8"
          variant={"ghost"}
          disabled={!hasSelection}
          title="Align / Distribute nodes"
        >
          <AlignLeftIcon size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-44">
        <DropdownMenuGroup>
          {ALIGN_ACTIONS.map(({ label, icon: Icon, action }) => (
            <DropdownMenuItem
              key={label}
              disabled={!hasSelection}
              onClick={() => apply(action)}
            >
              <Icon className="size-3.5 mr-2" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
