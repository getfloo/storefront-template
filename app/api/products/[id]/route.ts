import { errorResponse, jsonBody } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { ProductPatch, parse, updateProduct } from "@/lib/orders";

export async function PATCH(request: Request, { params }: RouteContext<"/api/products/[id]">): Promise<Response> {
  callerFrom(request.headers);
  try {
    const patch = parse(ProductPatch, await jsonBody(request, '{"stock": 25}'));
    const product = await updateProduct((await params).id, patch);
    if (!product) return Response.json({ error: "No product has this id." }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
