import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          F
        </div>
        <span className="text-lg font-bold">
          Flow<span className="text-primary">agent</span>.ai
        </span>
      </div>
      <SignInForm googleConnectionId={process.env.KINDE_GOOGLE_CONNECTION_ID} />
    </div>
  );
}
