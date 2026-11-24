import Image from "next/image";
import Link from "next/link";
import { listProducts } from "@/lib/orders";
import { formatMoney } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Shop() {
  const products = await listProducts();
  if (products.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-muted">
        No products yet. Load samples with <code>floo run --service web -- npm run seed</code>, or add them through the API.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <Link href={`/products/${product.slug}`} className="group block">
            <Image src={product.image} alt="" unoptimized width={480} height={360} className="aspect-[4/3] w-full rounded-md border bg-surface object-cover" />
            <div className="mt-3 flex items-baseline justify-between gap-4">
              <span className="font-medium group-hover:text-accent">{product.name}</span>
              <span className="text-muted">{formatMoney(product.priceCents)}</span>
            </div>
            {product.stock === 0 && <span className="text-sm text-muted">Out of stock</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
