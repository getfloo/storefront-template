import Link from "next/link";

export default function Thanks() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Thank you for your order</h1>
      <p className="text-muted">Stripe emails your receipt. Signed-in customers find the order under <Link href="/orders" className="text-accent hover:underline">Orders</Link> once the payment clears.</p>
    </div>
  );
}
