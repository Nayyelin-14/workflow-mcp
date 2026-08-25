"use client";

import { useState } from "react";
import { LoginLink, RegisterLink } from "@kinde-oss/kinde-auth-nextjs";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const GoogleIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
    />
  </svg>
);

export function SignInForm({
  googleConnectionId,
}: {
  googleConnectionId?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="w-full max-w-sm border-border/60 bg-card/60 py-6 shadow-xl shadow-foreground/5 backdrop-blur-sm sm:py-8">
      <CardHeader className="items-center gap-1.5 text-center">
        <CardTitle className="text-xl font-bold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription className="max-w-[260px]">
          Start building visual AI workflows in minutes
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Button
          asChild
          size="lg"
          variant="outline"
          className="h-11 w-full gap-2.5 rounded-lg"
        >
          <RegisterLink
            postLoginRedirectURL="/workflow"
            authUrlParams={
              googleConnectionId ? { connection_id: googleConnectionId } : undefined
            }
          >
            <GoogleIcon />
            Continue with Google
          </RegisterLink>
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form className="flex flex-col gap-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-10 text-sm outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <Button asChild size="lg" variant="secondary" className="h-11 w-full gap-2.5 rounded-lg">
            <LoginLink postLoginRedirectURL="/workflow">
              Sign in with email &amp; password
            </LoginLink>
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Secure access
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <ul className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" />
            OAuth 2.0 with PKCE — your password never touches us
          </li>
          <li className="flex items-center gap-1.5">
            <Lock className="size-3.5 text-primary" />
            Session secured with httpOnly cookies
          </li>
          <li className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Free forever while in beta
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
