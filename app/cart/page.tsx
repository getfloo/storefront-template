import Link from "next/link";
import { CartLineForm, CheckoutForm } from "@/app/forms";
import { currentCartId } from "@/lib/cart";
import { cartLines } from "@/lib/orders";
import { formatMoney } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Cart() {
  const cartId = await currentCartId();
  const lines = cartId ? await cartLines(cartId) : [];
  if (lines.length === 0) {
    return <p className="text-muted">Your cart is empty. <Link href="/" className="text-accent hover:underline">Keep shopping</Link>.</p>;
  }
  const total = lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cart</h1>
      <table>
        <thead><tr><th>Product</th><th>Quantity</th><th className="text-right">Price</th></tr></thead>
        <tbody>
          {lines.map(({ product, quantity }) => (
            <tr key={product.id}>
              <td><Link href={`/products/${product.slug}`} className="hover:text-accent">{product.name}</Link></td>
              <td><CartLineForm productId={product.id} quantity={quantity} stock={product.stock} /></td>
              <td className="text-right">{formatMoney(product.priceCents * quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted">Shipping address and payment on the next page, by Stripe.</p>
        <div className="flex flex-col items-end gap-3">
          <p className="text-lg font-medium">Total {formatMoney(total)}</p>
          <CheckoutForm />
        </div>
      </div>
    </div>
  );
}
