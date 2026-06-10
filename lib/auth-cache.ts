import { redis } from "@/lib/redis";
import { cookies } from "next/headers";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

const CACHE_TTL = 60;
const SESSION_COOKIES = ["user", "id_token", "access_token"];

function buildSessionKey(jar: Awaited<ReturnType<typeof cookies>>): string | null {
  for (const name of SESSION_COOKIES) {
    const cookie = jar.get(name);
    if (cookie?.value) return `kinde:session:${name}:${cookie.value}`;
  }
  return null;
}

export async function getCachedUser() {
  if (redis) {
    try {
      const jar = await cookies();
      const cacheKey = buildSessionKey(jar);
      if (cacheKey) {
        const cached = await redis.get<string>(cacheKey);
        if (cached) return JSON.parse(cached);
      }
    } catch {
      // Redis unavailable — skip cache, fall through to Kinde
    }
  }

  const session = await getKindeServerSession();
  const user = await session?.getUser();
  if (!user?.id) return null;

  if (redis) {
    try {
      const jar = await cookies();
      const cacheKey = buildSessionKey(jar);
      if (cacheKey) {
        await redis.set(cacheKey, JSON.stringify(user), { ex: CACHE_TTL });
      }
    } catch {
      // Best-effort
    }
  }

  return user;
}
