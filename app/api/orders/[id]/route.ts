import { callerFrom } from "@/lib/identity";
import { getOrder } from "@/lib/orders";
import { orderJson } from "../openapi";

export async function GET(request: Request, { params }: RouteContext<"/api/orders/[id]">): Promise<Response> {
  callerFrom(request.headers);
  const order = await getOrder((await params).id);
  if (!order) return Response.json({ error: "No order has this id." }, { status: 404 });
  return Response.json({ order: orderJson(order) });
}
