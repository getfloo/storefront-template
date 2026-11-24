import "server-only";
import { Conflict, InvalidInput } from "@/lib/orders";

/** The JSON body of a request, or InvalidInput naming what to send. */
export async function jsonBody(request: Request, example: string): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidInput(`Send JSON like ${example}.`);
  }
}

/** Answers the errors a caller can fix; anything else is a bug and propagates as a 500. */
export function errorResponse(error: unknown): Response {
  if (error instanceof InvalidInput) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof Conflict) return Response.json({ error: error.message }, { status: 409 });
  throw error;
}
