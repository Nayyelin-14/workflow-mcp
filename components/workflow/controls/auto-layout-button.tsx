import { useWorkflow } from "@/context/workflow-context";
import { autoLayout } from "@/lib/workflow/layout";
import { Button } from "@/components/ui/button";
import { LayoutGridIcon } from "lucide-react";

export default function AutoLayoutButton() {
  const { nodes, edges, setNodes } = useWorkflow();

  const handleAutoLayout = () => {
    const laidOut = autoLayout(nodes, edges);
    setNodes(laidOut);
  };

  return (
    <Button
      size={"icon"}
      className="rounded-full w-8 h-8"
      onClick={handleAutoLayout}
      variant={"ghost"}
      title="Auto arrange nodes"
    >
      <LayoutGridIcon size={16} />
    </Button>
  );
}
