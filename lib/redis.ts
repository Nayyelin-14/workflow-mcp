import { Redis } from "@upstash/redis";

export const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
