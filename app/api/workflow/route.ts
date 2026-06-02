import prisma from "@/lib/prisma";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";

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

    const session = await getKindeServerSession();
    const user = await session?.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const newWorkflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description ?? "",
      },
    });

    return NextResponse.json(
      { success: true, message: "Workflow created", workflow: newWorkflow },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/workflow:", error);

    if (error instanceof Error && "code" in error) {
      const prismaError = error as { code: string; meta?: { target?: string[] } };
      if (prismaError.code === "P2002") {
        return NextResponse.json(
          { error: true, message: "A workflow with this name already exists" },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: true, message: "Something went wrong" },
      { status: 500 },
    );
  }
}
