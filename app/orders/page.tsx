import Link from "next/link";
import { currentCustomer } from "@/lib/customer";
import { customerOrders } from "@/lib/orders";
import { formatMoney } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Orders() {
  const customer = await currentCustomer();
  if (!customer) {
    return <p className="text-muted"><Link href="/account" className="text-accent hover:underline">Sign in</Link> to see your orders.</p>;
  }
  const orders = await customerOrders(customer.id);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>
      {orders.length === 0 && <p className="text-muted">No orders yet.</p>}
      {orders.map((order) => (
        <section key={order.id} className="rounded-md border bg-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{order.createdAt.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}</span>
            <span className="text-sm text-muted">{order.status === "fulfilled" ? "Shipped" : "Paid, preparing to ship"}</span>
          </div>
          <ul className="mt-3 text-sm">
            {order.items.map((item) => (
              <li key={item.productId}>{item.quantity} × {item.name} · {formatMoney(item.unitCents * item.quantity, order.currency)}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">Total {formatMoney(order.totalCents, order.currency)}</p>
        </section>
      ))}
    </div>
  );
}
