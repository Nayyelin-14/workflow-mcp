import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis: Redis | undefined =
  url && url.startsWith("https://") && token
    ? new Redis({ url, token })
    : undefined;
