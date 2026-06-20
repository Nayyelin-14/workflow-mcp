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
