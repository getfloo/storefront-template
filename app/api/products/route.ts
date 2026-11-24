import { errorResponse, jsonBody } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { ProductInput, createProduct, listProducts, parse } from "@/lib/orders";

// The gateway serves /api only to callers holding an app API key with the "api"
// scope ([[routes]] in floo.app.toml), or an app member's floo key. The contract is in ./openapi.ts.

export async function GET(request: Request): Promise<Response> {
  callerFrom(request.headers);
  return Response.json({ products: await listProducts({ includeInactive: true }) });
}

export async function POST(request: Request): Promise<Response> {
  callerFrom(request.headers);
  try {
    const input = parse(ProductInput, await jsonBody(request, '{"slug": "canvas-tote", "name": "Canvas tote", ...}'));
    return Response.json({ product: await createProduct(input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
