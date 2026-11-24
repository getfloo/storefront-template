"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { type FormState, addToCart, checkout, updateCartLine } from "./actions";
import { MAX_PER_PRODUCT } from "@/lib/store";

const button = "cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-default disabled:opacity-60";

function ErrorText({ error }: { error?: string }) {
  return error ? <p role="alert" className="text-sm text-danger">{error}</p> : null;
}

function QuantitySelect({ max, defaultValue, name = "quantity" }: { max: number; defaultValue: number; name?: string }) {
  return (
    <select name={name} defaultValue={defaultValue} aria-label="Quantity" className="w-20">
      {Array.from({ length: Math.min(max, MAX_PER_PRODUCT) }, (_, index) => index + 1).map((value) => (
        <option key={value} value={value}>{value}</option>
      ))}
    </select>
  );
}

export function AddToCartForm({ productId, stock }: { productId: string; stock: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addToCart, {});
  if (stock === 0) return <p className="text-sm text-muted">Out of stock.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex items-center gap-3">
        <QuantitySelect max={stock} defaultValue={1} />
        <button type="submit" disabled={pending} className={button}>Add to cart</button>
      </div>
      <ErrorText error={state.error} />
    </form>
  );
}

export function CartLineForm({ productId, quantity, stock }: { productId: string; quantity: number; stock: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCartLine, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <QuantitySelect max={Math.max(stock, quantity)} defaultValue={quantity} />
      <button type="submit" disabled={pending} className="cursor-pointer text-sm text-accent hover:underline">Update</button>
      <button type="submit" name="quantity" value="0" disabled={pending} className="cursor-pointer text-sm text-muted hover:text-danger">Remove</button>
      <ErrorText error={state.error} />
    </form>
  );
}

export function CheckoutForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(checkout, {});
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <button type="submit" disabled={pending} className={button}>{pending ? "Opening checkout…" : "Check out"}</button>
      <ErrorText error={state.error} />
    </form>
  );
}

// floo serves Better Auth at /api/auth on this app's own origin, so the client needs no URL.
const auth = createAuthClient({ plugins: [emailOTPClient()] });

type Step = "sign-in" | "sign-up" | "verify";

/** Sign in, sign up, and confirm the 6-digit code floo emails a new account. */
export function AccountForm() {
  const [step, setStep] = useState<Step>("sign-in");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const address = String(formData.get("email") ?? email);
    const result =
      step === "sign-up" ? await auth.signUp.email({ email: address, password: String(formData.get("password")), name: String(formData.get("name")) })
      : step === "verify" ? await auth.emailOtp.verifyEmail({ email, otp: String(formData.get("otp")) })
      : await auth.signIn.email({ email: address, password: String(formData.get("password")) });
    setPending(false);
    if (result.error) {
      // An unverified address cannot sign in until it confirms its code.
      if (result.error.code === "EMAIL_NOT_VERIFIED") {
        setEmail(address);
        await auth.emailOtp.sendVerificationOtp({ email: address, type: "email-verification" });
        setStep("verify");
        return;
      }
      setError(result.error.message ?? "That did not work. Try again.");
      return;
    }
    if (step === "sign-up") {
      setEmail(address);
      setStep("verify");
      return;
    }
    // The session cookie changed, so server components must render again.
    router.push("/orders");
    router.refresh();
  }

  return (
    <form action={submit} className="flex max-w-sm flex-col gap-4">
      {step === "verify" ? (
        <label className="flex flex-col gap-1 text-sm">
          The 6-digit code sent to {email}
          <input name="otp" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
      ) : (
        <>
          {step === "sign-up" && (
            <label className="flex flex-col gap-1 text-sm">Name<input name="name" autoComplete="name" required /></label>
          )}
          <label className="flex flex-col gap-1 text-sm">Email<input name="email" type="email" autoComplete="email" required /></label>
          <label className="flex flex-col gap-1 text-sm">
            Password
            <input name="password" type="password" minLength={8} required
              autoComplete={step === "sign-up" ? "new-password" : "current-password"} />
          </label>
        </>
      )}
      <ErrorText error={error} />
      <button type="submit" disabled={pending} className={button}>
        {step === "sign-up" ? "Create account" : step === "verify" ? "Confirm" : "Sign in"}
      </button>
      {step !== "verify" && (
        <button type="button" onClick={() => setStep(step === "sign-in" ? "sign-up" : "sign-in")}
          className="cursor-pointer text-left text-sm text-accent hover:underline">
          {step === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      )}
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await auth.signOut(); router.push("/"); router.refresh(); }}
      className="cursor-pointer text-sm text-accent hover:underline">
      Sign out
    </button>
  );
}
