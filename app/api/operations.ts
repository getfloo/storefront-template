import { operations as orders } from "./orders/openapi";
import { operations as products } from "./products/openapi";

// Every /api route's operations, in one list, feeding /api/openapi.json.
// tests/openapi.test.ts fails when a route handler is missing from it.
export const operations = [...products, ...orders];
