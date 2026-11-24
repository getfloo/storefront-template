import Image from "next/image";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/app/forms";
import { getProductBySlug } from "@/lib/orders";
import { formatMoney } from "@/lib/store";

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Image src={product.image} alt="" unoptimized width={720} height={540} className="aspect-[4/3] w-full rounded-md border bg-surface object-cover" />
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="text-lg">{formatMoney(product.priceCents)}</p>
        <p className="text-muted">{product.description}</p>
        <AddToCartForm productId={product.id} stock={product.stock} />
      </div>
    </div>
  );
}
