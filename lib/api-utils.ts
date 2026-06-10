import { getCachedUser } from "@/lib/auth-cache";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function getAuthenticatedUser() {
  const user = await getCachedUser();
  if (!user?.id) return null;
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: true, message: "Unauthorized" },
    { status: 401 },
  );
}

export function serverErrorResponse() {
  return NextResponse.json(
    { error: true, message: "Something went wrong" },
    { status: 500 },
  );
}
