import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "./redis";
import z from "zod/v4";
import { UIMessageChunk } from "ai";

const schema = {
  workflow: {
    chunk: z.any() as z.ZodType<UIMessageChunk>,
  },
};

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;

// This creates an Upstash Realtime (@upstash/realtime) 
// client backed by Upstash Redis (lib/redis.ts:3-6). 
// The Realtime client uses Redis pub/sub under the hood. 
// channel(workflowRunId) creates a channel whose Redis key is the workflowRunId.