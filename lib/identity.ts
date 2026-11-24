import "server-only";

/** A floo user calling /api with their own floo key; the gateway strips the key. */
export type User = {
  kind: "user";
  id: string;
  email: string;
  name: string;
  role: string;
};

/** A program calling with an app API key minted by `floo apps keys create`. */
export type ApiKeyCaller = {
  kind: "api_key";
  /** The consumer the key belongs to; stable across key rotation. */
  id: string;
  name: string;
  keyId: string;
  scopes: string[];
};

export type Caller = User | ApiKeyCaller;

const NOT_FROM_GATEWAY =
  "this request did not come through the floo gateway. /api is an api_key route in floo.app.toml.";

// The gateway strips every inbound X-Floo-* header and injects its own on /api, an
// api_key route, so these are trustworthy only there. Shoppers on public pages carry
// none of them; their sign-in is lib/customer.ts.
export function callerFrom(requestHeaders: Headers): Caller {
  const required = (header: string): string => {
    const value = requestHeaders.get(header)?.trim();
    if (!value) {
      throw new Error(`Missing ${header}: ${NOT_FROM_GATEWAY}`);
    }
    return value;
  };

  if (requestHeaders.get("X-Floo-Auth-Method")?.trim() === "api_key") {
    return {
      kind: "api_key",
      id: required("X-Floo-Api-Consumer-Id"),
      name: requestHeaders.get("X-Floo-Api-Consumer-Name")?.trim() || "",
      keyId: required("X-Floo-Api-Key-Id"),
      scopes: required("X-Floo-Api-Key-Scopes").split(",").filter(Boolean),
    };
  }
  return {
    kind: "user",
    id: required("X-Floo-User-Id"),
    email: required("X-Floo-User-Email"),
    // A valid account may have no display name.
    name: requestHeaders.get("X-Floo-User-Name")?.trim() ?? "",
    role: required("X-Floo-User-Role"),
  };
}
