import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { callerFrom } from "../lib/identity";

const memberKeyHeaders = {
  "X-Floo-Auth-Method": "session",
  "X-Floo-User-Id": "user-123",
  "X-Floo-User-Email": "pat@example.com",
  "X-Floo-User-Name": "Pat",
  "X-Floo-User-Role": "admin",
};

const keyHeaders = {
  "X-Floo-Auth-Method": "api_key",
  "X-Floo-Api-Consumer-Id": "consumer-9",
  "X-Floo-Api-Consumer-Name": "fulfillment-agent",
  "X-Floo-Api-Key-Id": "key-42",
  "X-Floo-Api-Key-Scopes": "api,reports.read",
};

describe("callerFrom", () => {
  it("reads an app member calling with their own floo key", () => {
    expect(callerFrom(new Headers(memberKeyHeaders))).toEqual({
      kind: "user", id: "user-123", email: "pat@example.com", name: "Pat", role: "admin",
    });
  });

  it.each(["X-Floo-User-Id", "X-Floo-User-Email", "X-Floo-User-Role"])("rejects a member without %s", (header) => {
    const values = new Headers(memberKeyHeaders);
    values.delete(header);
    expect(() => callerFrom(values)).toThrow(`Missing ${header}`);
  });

  it("reads the consumer, key and scopes the gateway injected", () => {
    expect(callerFrom(new Headers(keyHeaders))).toEqual({
      kind: "api_key", id: "consumer-9", name: "fulfillment-agent", keyId: "key-42", scopes: ["api", "reports.read"],
    });
  });

  it("tolerates a consumer without a name", () => {
    const values = new Headers(keyHeaders);
    values.delete("X-Floo-Api-Consumer-Name");
    expect(callerFrom(values).name).toBe("");
  });

  it.each(["X-Floo-Api-Consumer-Id", "X-Floo-Api-Key-Id", "X-Floo-Api-Key-Scopes"])("rejects a key without %s", (header) => {
    const values = new Headers(keyHeaders);
    values.delete(header);
    expect(() => callerFrom(values)).toThrow(`Missing ${header}`);
  });

  it("refuses a request with no gateway headers, such as a shopper's", () => {
    expect(() => callerFrom(new Headers())).toThrow("did not come through the floo gateway");
  });
});
