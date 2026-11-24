import { z } from "zod";
import { ProductInput, ProductPatch } from "@/lib/orders";
import { ApiError, type Operation } from "@/lib/openapi";

export const ProductJson = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  priceCents: z.int(),
  stock: z.int().meta({ description: "Goes down when an order is paid, never below zero." }),
  image: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const ProductPath = z.object({ id: z.uuid().meta({ description: "The product's id, from listProducts." }) });

// The contract for ./route.ts and ./[id]/route.ts.
export const operations: Operation[] = [
  {
    method: "get",
    path: "/api/products",
    operationId: "listProducts",
    summary: "List every product, including ones taken out of the shop.",
    responses: { 200: { description: "All products by name.", schema: z.object({ products: z.array(ProductJson) }) } },
  },
  {
    method: "post",
    path: "/api/products",
    operationId: "createProduct",
    summary: "Add a product to the shop.",
    request: ProductInput,
    responses: {
      201: { description: "The new product.", schema: z.object({ product: ProductJson }) },
      400: { description: "The body is not JSON or a field is invalid.", schema: ApiError },
      409: { description: "Another product has this slug.", schema: ApiError },
    },
  },
  {
    method: "patch",
    path: "/api/products/{id}",
    operationId: "updateProduct",
    summary: "Change a product's price, stock, details, or whether it is in the shop. Send only the fields to change.",
    params: ProductPath,
    request: ProductPatch,
    responses: {
      200: { description: "The updated product.", schema: z.object({ product: ProductJson }) },
      400: { description: "The body is not JSON or a field is invalid.", schema: ApiError },
      404: { description: "No product has this id.", schema: ApiError },
    },
  },
];
