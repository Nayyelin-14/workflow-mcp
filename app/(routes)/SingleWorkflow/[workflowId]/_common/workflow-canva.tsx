import React, { useState, useCallback } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Controls, {
  TOOL_MODE_ENUM,
  ToolMode,
} from "@/components/workflow/controls";
import { cn } from "@/lib/utils";
import NodePanel from "./NodePanel";
import { useWorkflow } from "@/context/workflow-context";
import { createNode, NodeType, NodeTypeEnum } from "@/lib/workflow/node-config";
import { DRAG_DATA_TYPE } from "@/lib/constants";
import StartNode from "@/components/workflow/custom-nodes/start/start-node";
import AgentNode from "@/components/workflow/custom-nodes/agent/agent-node";
import IfElseNode from "@/components/workflow/custom-nodes/if-else/ifelse-node";
import CommentNode from "@/components/workflow/custom-nodes/comment/comment-node";
import EndNode from "@/components/workflow/custom-nodes/end/end-node";
import { useUpdateWorkflow } from "@/features/use-workflow";
import {
  ActionBar,
  ActionBarGroup,
  ActionBarItem,
} from "@/components/ui/action-bar";
import { Spinner } from "@/components/ui/spinner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-change";
import LiveChat from "@/components/workflow/live-chat";

const WorkflowCanvas = ({ workflowId }: { workflowId: string }) => {
  const { view, nodes, setNodes, edges, setEdges } = useWorkflow();
  const { screenToFlowPosition } = useReactFlow();

  const [toolMode, setToolMode] = useState<ToolMode>(TOOL_MODE_ENUM.HAND);
  const isSelectMode = toolMode === TOOL_MODE_ENUM.SELECT;

  const isPreview = view === "preview";

  const nodeTypes = {
    [NodeTypeEnum.START]: StartNode,
    [NodeTypeEnum.AGENT]: AgentNode,
    [NodeTypeEnum.IF_ELSE]: IfElseNode,
    [NodeTypeEnum.COMMENT]: CommentNode,
    [NodeTypeEnum.END]: EndNode,
  };

  const { hasUnsavedChanges, discardChanges } = useUnsavedChanges({
    nodes,
    edges,
  });

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [setEdges],
  );
  const onConnect = useCallback(
    (params: Connection) => {
      console.log(`\n[UI:Canvas] Edge connected`);
      console.log(`[UI:Canvas] Source: ${params.source} (handle: ${params.sourceHandle})`);
      console.log(`[UI:Canvas] Target: ${params.target} (handle: ${params.targetHandle})`);
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const node_type = event.dataTransfer.getData(DRAG_DATA_TYPE) as NodeType;

      console.log(`\n[UI:Canvas] Node dropped on canvas`);
      console.log(`[UI:Canvas] Node type: ${node_type}`);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      console.log(`[UI:Canvas] Drop position:`, JSON.stringify(position));

      const newNode = createNode({
        type: node_type,
        position,
      });

      console.log(`[UI:Canvas] Adding node to canvas:`, JSON.stringify(newNode, null, 2));
      setNodes((prev) => [...prev, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  // /update workflow
  const { mutate: updateWorkFlowAction, isPending: isUpdating } =
    useUpdateWorkflow(workflowId);

  const handleDiscard = () => {
    const result = discardChanges();
    setNodes(result.nodes);
    setEdges(result.edges);
  };
  const handleSaveChanges = () => {
    console.log("\n[UI:Canvas] Saving workflow changes...");
    console.log(`[UI:Canvas] Nodes count: ${nodes.length}`);
    console.log(`[UI:Canvas] Edges count: ${edges.length}`);
    console.log("[UI:Canvas] Nodes:", JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, data: n.data })), null, 2));
    console.log("[UI:Canvas] Edges:", JSON.stringify(edges.map(e => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target })), null, 2));
    updateWorkFlowAction({ nodes, edges });
  };
console.log(nodes, edges)
  return (
    <>
      <div className="relative flex flex-1 h-full overflow-hidden">
        <div className="flex-1 relative h-full">
          <ReactFlow
            className={cn(
              isSelectMode
                ? "cursor-default"
                : "cursor-grab active:cursor-grabbing",
            )}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            defaultEdgeOptions={{ type: "smoothstep" }}
            defaultViewport={{ x: 0, y: 0, zoom: 1.2 }}
            nodeTypes={nodeTypes}
            onDrop={onDrop}
            onDragOver={onDragOver}
            snapToGrid={true}
            snapGrid={[20, 20]}
            panOnScroll={!isSelectMode}
            panOnDrag={!isSelectMode}
            zoomOnScroll={!isSelectMode}
            selectionOnDrag={isSelectMode}
          />
          <Background
            bgColor="var(--sidebar)"
            variant={BackgroundVariant.Dots}
          />
          <div className={cn("transition-opacity duration-300 ease-in-out", isPreview ? "opacity-0 pointer-events-none" : "opacity-100")}>
            <NodePanel />
          </div>
          <div className={cn("transition-all duration-300 ease-in-out delay-75", isPreview ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100")}>
            <Controls toolMode={toolMode} setToolMode={setToolMode} />
          </div>
        </div>
        <LiveChat workflowId={workflowId} />
      </div>

      <ActionBar
        open={hasUnsavedChanges}
        side="top"
        align="center"
        sideOffset={70}
        className="max-w-xs "
      >
        <ActionBarGroup>
          <ActionBarItem
            disabled={isUpdating}
            variant={"ghost"}
            onClick={handleDiscard}
          >
            Discard
          </ActionBarItem>
          <ActionBarItem
            disabled={isUpdating}
            variant={"secondary"}
            onClick={handleSaveChanges}
          >
            {isUpdating && <Spinner />}
            {!isUpdating && "Save Changes"}
          </ActionBarItem>
        </ActionBarGroup>
      </ActionBar>
    </>
  );
};

export default WorkflowCanvas;
