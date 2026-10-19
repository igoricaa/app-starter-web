import { createFileRoute, redirect, useHydrated, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/" });
  },
  component: SignIn,
});

function SignIn() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = codeSent
      ? await authClient.signIn.emailOtp({ email, otp: code })
      : await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (result.error) return setError(result.error.message ?? "Something went wrong.");
    if (codeSent) return router.navigate({ to: "/" });
    setCodeSent(true);
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <Field data-invalid={error ? true : undefined}>
          {codeSent ? (
            <>
              <FieldLabel htmlFor="code">Code sent to {email}</FieldLabel>
              <Input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </>
          ) : (
            <>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </>
          )}
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" disabled={!hydrated || pending}>
          {codeSent ? "Sign in" : "Send code"}
        </Button>
      </form>
    </main>
  );
}
