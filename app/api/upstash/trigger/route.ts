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
  const { workflowId, messages } = await request.json();
  try {
    const { workflowRunId } = await client.trigger({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return NextResponse.json({
      success: true,
      workflowRunId: workflowRunId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger workflow",
      },
      { status: 500 },
    );
  }
}
