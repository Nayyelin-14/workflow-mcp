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
import StartNode from "@/components/workflow/custom-nodes/start/start-node";
import AgentNode from "@/components/workflow/custom-nodes/agent/agent-node";
import IfElseNode from "@/components/workflow/custom-nodes/if-else/ifelse-node";

const WorkflowCanvas = () => {
  const { view, nodes, setNodes, edges, setEdges } = useWorkflow();
  const { screenToFlowPosition } = useReactFlow();

  const [toolMode, setToolMode] = useState<ToolMode>(TOOL_MODE_ENUM.HAND);
  const isSelectMode = toolMode === TOOL_MODE_ENUM.SELECT;

  const isPreview = view === "preview";

  const nodeTypes = {
    [NodeTypeEnum.START]: StartNode,
    [NodeTypeEnum.AGENT]: AgentNode,
    [NodeTypeEnum.IF_ELSE]: IfElseNode,
  };

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
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const node_type = event.dataTransfer.getData(
        "application/reactflow",
      ) as NodeType;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = createNode({
        type: node_type,
        position,
      });

      setNodes((prev) => [...prev, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

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
            defaultViewport={{ x: 0, y: 0, zoom: 1.2 }}
            nodeTypes={nodeTypes}
            onDrop={onDrop}
            onDragOver={onDragOver}
            panOnScroll={!isSelectMode}
            panOnDrag={!isSelectMode}
            zoomOnScroll={!isSelectMode}
            selectionOnDrag={isSelectMode}
          />
          <Background
            bgColor="var(--sidebar)"
            variant={BackgroundVariant.Dots}
          />
          {!isPreview && <NodePanel />}
          {!isPreview && (
            <Controls toolMode={toolMode} setToolMode={setToolMode} />
          )}
        </div>
      </div>
    </>
  );
};

export default WorkflowCanvas;
