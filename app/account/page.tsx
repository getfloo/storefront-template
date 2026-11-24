import Link from "next/link";
import { AccountForm, SignOutButton } from "@/app/forms";
import { currentCustomer } from "@/lib/customer";

export const dynamic = "force-dynamic";

export default async function Account() {
  const customer = await currentCustomer();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      {customer ? (
        <div className="flex flex-col gap-2">
          <p>Signed in as {customer.email}.</p>
          <Link href="/orders" className="text-accent hover:underline">Your orders</Link>
          <SignOutButton />
        </div>
      ) : (
        <>
          <p className="text-muted">Sign in to see your orders. You can also check out as a guest.</p>
          <AccountForm />
        </>
      )}
    </div>
  );
}
