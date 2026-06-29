import { Client } from "@upstash/workflow";
import { NextResponse } from "next/server";

const client = new Client({
  baseUrl: process.env.QSTASH_BASE_URL!,
  token: process.env.QSTASH_TOKEN!,
});

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:3000`;

export async function POST(request: Request) {
  console.log("\n==============================================");
  console.log("📨 TRIGGER ROUTE HIT: POST /api/upstash/trigger");
  console.log("==============================================");

  const { workflowId, messages } = await request.json();
  console.log("Received workflowId:", workflowId);
  console.log("Messages count:", messages?.length);

  try {
    const triggerPayload = {
      url: `${baseUrl}/api/workflow/live-chat`,
      retries: 3,
      keepTriggerConfig: true,
      headers: {
        "x-vercel-protection-bypass":
          process.env.VERCEL_PROTECTION_BYPASS_TOKEN || "",
      },
      body: {
        workflowId,
        messages,
      },
    };
    console.log("Trigger payload:", JSON.stringify(triggerPayload, null, 2));

    const { workflowRunId } = await client.trigger(triggerPayload as any);
    console.log("✅ Workflow triggered! Run ID:", workflowRunId);

    return NextResponse.json({
      success: true,
      workflowRunId: workflowRunId,
    });
  } catch (error) {
    console.error("❌ Failed to trigger workflow:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger workflow",
      },
      { status: 500 },
    );
  }
}
