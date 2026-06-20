import prisma from "@/lib/prisma";
import { realtime } from "@/lib/realtime";
import { executeWorkflow } from "@/lib/workflow/executeWorkflow";
import { Client } from "@upstash/qstash";
import { serve } from "@upstash/workflow/nextjs";
import { Edge, Node } from "@xyflow/react";
import { UIMessage } from "ai";

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const workflowRunId =
    searchParams.get("id") || searchParams.get("workflowRunId");
  if (!workflowRunId)
    return new Response("Missing workflow run id", { status: 400 });

  const channel = realtime.channel(workflowRunId);
  const stream = new ReadableStream({
    async start(controller) {
      const encofer = new TextEncoder();
      await channel.subscribe({
        events: ["workflow.chunk"],
        history: true,
        onData({ data, event, channel }) {
          controller.enqueue(
            encofer.encode(`data : ${JSON.stringify(data)}\n\n`),
          );
          if (data.type === "finish") controller.close();
        },
      });
      req.signal.addEventListener("abort", () => {
        controller.close();
      });
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
    const { workflowId, messages } = context.requestPayload as {
      workflowId: string;

      messages: UIMessage[];
    };
    const workflowRunId = context.workflowRunId;
    const channel = realtime.channel(workflowRunId);
    const message = messages[messages.length - 1];
    const userInput =
      message.role === "user" && message.parts[0].type === "text"
        ? message.parts[0].text
        : "";
    console.log("initial step ran");

    const { nodes, edges } = await context.run(
      "fetch-from-database",
      async () => {
        const workflowData = await prisma.workflow.findUnique({
          where: {
            id: workflowId,
          },
        });

        if (!workflowData) throw new Error("Workfliw not found");
        const obj = JSON.parse(workflowData.flowObject);
        const nodes = obj.nodes as Node[];
        const edges = obj.edges as Edge[];
        return { nodes, edges };
      },
    );

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
        console.log(error, "Workflow execution error");
      }
    });
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
