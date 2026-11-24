import { errorResponse } from "@/lib/api";
import { callerFrom } from "@/lib/identity";
import { ListOrdersQuery, listOrders, parse } from "@/lib/orders";
import { orderJson } from "./openapi";

export async function GET(request: Request): Promise<Response> {
  callerFrom(request.headers);
  try {
    const { status } = parse(ListOrdersQuery, Object.fromEntries(new URL(request.url).searchParams));
    return Response.json({ orders: (await listOrders(status)).map(orderJson) });
  } catch (error) {
    return errorResponse(error);
  }
}
