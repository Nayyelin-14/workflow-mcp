import prisma from "@/lib/prisma";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  try {
    const session = await getKindeServerSession();
    const user = await session?.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { workflowId } = await params;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

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
    return NextResponse.json(
      { error: true, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
