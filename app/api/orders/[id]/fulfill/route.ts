import { errorResponse } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { fulfillOrder } from "@/lib/orders";
import { orderJson } from "../../openapi";

export async function POST(request: Request, { params }: RouteContext<"/api/orders/[id]/fulfill">): Promise<Response> {
  callerFrom(request.headers);
  try {
    const order = await fulfillOrder((await params).id);
    if (!order) return Response.json({ error: "No order has this id." }, { status: 404 });
    return Response.json({ order: orderJson(order) });
  } catch (error) {
    return errorResponse(error);
  }
}
