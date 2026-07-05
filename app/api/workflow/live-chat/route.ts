import prisma from "@/lib/prisma";
import { realtime } from "@/lib/realtime";
import { executeWorkflow } from "@/lib/workflow/executeWorkflow";
import { Client } from "@upstash/qstash";
import { serve } from "@upstash/workflow/nextjs";
import { Edge, Node } from "@xyflow/react";
import { UIMessage } from "ai";

export const GET = async (req: Request) => {
  console.log("\n==============================================");
  console.log("📡 SSE ROUTE HIT: GET /api/workflow/live-chat (SSE stream)");
  console.log("==============================================");

  const { searchParams } = new URL(req.url);
  const workflowRunId =
    searchParams.get("id") || searchParams.get("workflowRunId");
  console.log("SSE request for workflowRunId:", workflowRunId);

  if (!workflowRunId) {
    console.error("Missing workflow run id in SSE request");
    return new Response("Missing workflow run id", { status: 400 });
  }

  const channel = realtime.channel(workflowRunId);
  console.log("Realtime channel created for:", workflowRunId);

  const stream = new ReadableStream({
    async start(controller) {
      const encofer = new TextEncoder();
      console.log("Subscribing to realtime channel events...");
      await channel.subscribe({
        events: ["workflow.chunk"],
        history: true,
          onData({ data }) {
          console.log("SSE sending chunk:", JSON.stringify(data).substring(0, 100));
          controller.enqueue(
            encofer.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
          if (data.type === "finish") {
            console.log("SSE stream complete (finish event)");
            controller.close();
          }
        },
      });
      req.signal.addEventListener("abort", () => {
        console.log("SSE connection aborted by client");
        controller.close();
      });
      console.log("SSE stream established");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
};

export const { POST } = serve(
  async (context) => {
    console.log("\n==============================================");
    console.log("⚡ WORKFLOW SERVE HANDLER TRIGGERED (QStash callback)");
    console.log("==============================================");
    console.log("=============", context, "=============");
    console.log("==============================================");

    console.log("Workflow Run ID:", context.workflowRunId);

    const { workflowId, messages } = context.requestPayload as {
      workflowId: string;

      messages: UIMessage[];
    };
    console.log("Payload workflowId:", workflowId);
    console.log("Payload messages count:", messages?.length);

    const workflowRunId = context.workflowRunId;
    const channel = realtime.channel(workflowRunId);
    const message = messages[messages.length - 1];
    const userInput =
      message.role === "user" && message.parts[0].type === "text"
        ? message.parts[0].text
        : "";
    console.log("User input:", userInput);

    console.log("\n--- Step 1: Fetch workflow from database ---");
    const { nodes, edges } = await context.run(
      "fetch-from-database",
      async () => {
        console.log("Fetching workflow data for ID:", workflowId);
        const workflowData = await prisma.workflow.findUnique({
          where: {
            id: workflowId,
          },
        });

        if (!workflowData) {
          console.error("Workflow not found in database:", workflowId);
          throw new Error("Workfliw not found");
        }
        console.log("Workflow found:", workflowData.name);
        const obj = JSON.parse(workflowData.flowObject);
        const nodes = obj.nodes as Node[];
        const edges = obj.edges as Edge[];
        console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges`);
        console.log("Nodes:", JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type })), null, 2));
        console.log("Edges:", JSON.stringify(edges.map(e => ({ id: e.id, source: e.source, target: e.target, handle: e.sourceHandle })), null, 2));
        return { nodes, edges };
      },
    );

    console.log("\n--- Step 2: Execute workflow ---");
    await context.run("worflow-execution", async () => {
      try {
        await executeWorkflow(
          nodes,
          edges,
          userInput,
          messages,
          channel,
          workflowRunId,
        );
      } catch (error) {
        console.error("Workflow execution error:", error);
      }
    });

    console.log("\n==============================================");
    console.log("🏁 WORKFLOW SERVE HANDLER COMPLETED");
    console.log("==============================================");
  },
  {
    qstashClient: new Client({
      token: process.env.QSTASH_TOKEN!,
      headers: {
        "x-vercel-protection-bypass":
          process.env.VERCEL_PROTECTION_BYPASS_TOKEN!,
      },
    }),
  },
);
