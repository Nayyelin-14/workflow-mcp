import { SignInForm } from "./sign-in-form";
import { Boxes, GitBranch, Rocket, Sparkles } from "lucide-react";

const features = [
  {
    icon: Boxes,
    title: "Drag-and-drop canvas",
    description: "Compose multi-step AI workflows visually — no code required.",
  },
  {
    icon: GitBranch,
    title: "Conditional logic",
    description: "Branch on runtime values with If/Else, tools, and HTTP nodes.",
  },
  {
    icon: Rocket,
    title: "Ship in minutes",
    description: "Preview live in a chat panel, then deploy straight to production.",
  },
];

export default function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_center,currentColor_1px,transparent_1px)] [background-size:24px_24px]"
        />

        <div className="relative flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-sm font-bold text-primary">
            F
          </div>
          <span className="text-lg font-bold">
            Flow<span className="opacity-80">agent</span>.ai
          </span>
        </div>

        <div className="relative space-y-8">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" />
            <span className="text-sm font-medium text-primary-foreground/80">
              Visual AI workflow builder
            </span>
          </div>
          <h1 className="max-w-md text-4xl leading-tight font-bold tracking-tight">
            Build intelligent workflows with your team.
          </h1>
          <div className="space-y-5">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-primary-foreground/70">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} Flowagent.ai — build smarter workflows
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              F
            </div>
            <span className="text-lg font-bold">
              Flow<span className="text-primary">agent</span>.ai
            </span>
          </div>
          <SignInForm googleConnectionId={process.env.KINDE_GOOGLE_CONNECTION_ID} />
        </div>
      </div>
    </div>
  );
}
