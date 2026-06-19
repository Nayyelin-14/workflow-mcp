import { Client } from "@upstash/workflow";

export async function POST() {
  const client = new Client({
    baseUrl: process.env.QSTASH_BASE_URL!,
    token: process.env.QSTASH_TOKEN!,
  });

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:3000`;

  const { workflowRunId } = await client.trigger({
    url: `${baseUrl}/api/workflow/live-chat`,
    retries: 3,
  });

  return Response.json({ workflowRunId });
}
