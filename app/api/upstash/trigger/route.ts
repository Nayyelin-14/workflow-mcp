import { Client } from "@upstash/workflow";

const client = new Client({
  baseUrl: process.env.QSTASH_BASE_URL!,
  token: process.env.QSTASH_TOKEN!,
});

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:3000`;

const { workflowRunId } = await client.trigger({
  url: `${BASE_URL}/api/workflow/live-chat`,
  retries: 3,
});
