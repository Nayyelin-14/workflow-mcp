import { LoginLink } from "@kinde-oss/kinde-auth-nextjs";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            F
          </div>
          <span className="text-lg font-bold">
            Flow<span className="text-primary">agent</span>.ai
          </span>
        </div>
        <div className="flex items-center gap-4">
          <LoginLink className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </LoginLink>
          <LoginLink className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Get Started
          </LoginLink>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border bg-accent px-4 py-1 text-sm font-medium text-muted-foreground">
          Now with QStash-powered durable workflows
        </div>
        <h1 className="max-w-2xl text-5xl font-bold tracking-tight">
          Build AI Workflows with{" "}
          <span className="text-primary">Flowagent.ai</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Create custom chat agent workflows with drag-and-drop simplicity.
          Connect logic, tools, and deploy in minutes — no code required.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <LoginLink className="rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90">
            Get Started Free
          </LoginLink>
          <Link
            href="/workflow"
            className="rounded-lg border px-6 py-3 text-base font-medium hover:bg-accent"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Flowagent.ai — Build smarter workflows
      </footer>
    </div>
  );
}
