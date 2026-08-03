import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

export default withAuth(async function proxy() {}, {
  // Middleware still runs on all routes, but doesn't protect the blog route
  publicPaths: ["/", "/api/auth", "/api/upstash/trigger", "/api/workflow/live-chat"],
  loginPage: "/sign-in",
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};

//withauth can do Authentication Check Session Check Redirect Logic Return URL Handling
