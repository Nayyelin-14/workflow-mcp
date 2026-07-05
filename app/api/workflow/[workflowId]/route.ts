import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/timeout";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  serverErrorResponse,
  maxDuration,
} from "@/lib/api-utils";
import { Edge } from "@xyflow/react";

export { maxDuration };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { workflowId } = await params;

    const workflow = await withTimeout(
      prisma.workflow.findUnique({
        where: { id: workflowId },
      }),
      55_000,
      req.signal,
    );

    if (!workflow || workflow.userId !== user.id) {
      return NextResponse.json(
        { error: true, message: "Not found" },
        { status: 404 },
      );
    }
    const flowObject = JSON.parse(workflow.flowObject);
    return NextResponse.json({
      success: true,
      data: {
        id: workflow.id,
        name: workflow.name,
        flowObject,
      },
    });
  } catch (error) {
    console.error("GET /api/workflow/[workflowId]:", error);
    return serverErrorResponse();
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { workflowId } = await params;
    const { nodes, edges } = (await req.json()) as {
      nodes: Node[];
      edges: Edge[];
    };
    const workflow = await withTimeout(
      prisma.workflow.findUnique({
        where: { id: workflowId },
      }),
      55_000,
      req.signal,
    );

    if (!workflow || workflow.userId !== user.id) {
      return NextResponse.json(
        { error: true, message: "Not found" },
        { status: 404 },
      );
    }

    const updateWorkflow = await withTimeout(
      prisma.workflow.update({
        where: { id: workflowId },
        data: { flowObject: JSON.stringify({ nodes, edges }) },
      }),
      55_000,
      req.signal,
    );

    return NextResponse.json({
      success: true,
      data: {
        id: updateWorkflow.id,
        name: updateWorkflow.name,
        flowObject: JSON.parse(updateWorkflow.flowObject),
      },
    });
  } catch (error) {
    console.error("GET /api/workflow/[workflowId]:", error);
    return serverErrorResponse();
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    const { workflowId } = await params;

    const workflow = await withTimeout(
      prisma.workflow.findUnique({
        where: { id: workflowId },
      }),
      55_000,
      req.signal,
    );

    if (!workflow || workflow.userId !== user.id) {
      return NextResponse.json(
        { error: true, message: "Not found" },
        { status: 404 },
      );
    }

    await withTimeout(
      prisma.workflow.delete({ where: { id: workflowId } }),
      55_000,
      req.signal,
    );

    return NextResponse.json({ success: true, message: "Workflow deleted" });
  } catch (error) {
    console.error("DELETE /api/workflow/[workflowId]:", error);
    return serverErrorResponse();
  }
}
