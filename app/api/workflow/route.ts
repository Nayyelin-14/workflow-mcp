import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { withTimeout } from "@/lib/timeout";
import { getAuthenticatedUser, unauthorizedResponse, serverErrorResponse, maxDuration } from "@/lib/api-utils";

export { maxDuration };

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const workflows = await withTimeout(
      prisma.workflow.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, description: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      55_000,
      req?.signal,
    );

    return NextResponse.json({ success: true, workflows });
  } catch (error) {
    console.error("GET /api/workflow:", error);
    return serverErrorResponse();
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: true, message: "Name is required" },
        { status: 400 },
      );
    }

    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const key = getRateLimitKey(user.id);
    const limit = await rateLimit(key, { maxRequests: 20, windowMs: 60_000 });
    if (!limit.success) {
      return NextResponse.json(
        {
          error: true,
          message: "Too many requests. Try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
        },
      );
    }

    const newWorkflow = await withTimeout(
      prisma.workflow.create({
        data: {
          userId: user.id,
          name: name.trim(),
          description: description ?? "",
        },
      }),
      55_000,
      req.signal,
    );

    return NextResponse.json(
      { success: true, message: "Workflow created", workflow: newWorkflow },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/workflow:", error);

    if (error instanceof Error && "code" in error) {
      const prismaError = error as {
        code: string;
        meta?: { target?: string[] };
      };
      if (prismaError.code === "P2002") {
        return NextResponse.json(
          { error: true, message: "A workflow with this name already exists" },
          { status: 409 },
        );
      }
    }

    return serverErrorResponse();
  }
}
