import {
  handleAuth,
  getKindeServerSession,
} from "@kinde-oss/kinde-auth-nextjs/server";

const authHandler = handleAuth();

export async function GET(
  request: Request,
  context: { params: Promise<{ kindeAuth: string | string[] }> },
) {
  const { kindeAuth } = await context.params;
  const segment = Array.isArray(kindeAuth) ? kindeAuth[0] : kindeAuth;

  const response = await authHandler(request, context);

  // TEMP DEBUG - remove after verifying seamless sign-up
  if (segment === "kinde_callback") {
    try {
      const session = getKindeServerSession();
      const user = await session.getUser();
      const timestamp = new Date().toISOString();
      // No "new user" / created_on signal exists in the ID token or session
      // in this SDK version, so newUser is always unknown.
      console.log(
        `[KINDE DEBUG] user=${user?.id ?? "n/a"} email=${user?.email ?? "n/a"} newUser=unknown at=${timestamp}`,
      );
    } catch (error) {
      console.log("[KINDE DEBUG] failed to read session after callback", error);
    }
  }
  // END TEMP DEBUG

  return response;
}
