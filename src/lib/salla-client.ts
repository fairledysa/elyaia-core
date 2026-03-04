import { kv } from "@vercel/kv";

export const runtime = "nodejs";

const BASE = "https://api.salla.dev/admin/v2";

async function getMerchantToken(merchantId: string) {
  const data = await kv.hgetall<Record<string, string>>(
    `salla:merchant:${merchantId}`,
  );
  if (!data?.accessToken) throw new Error("Merchant not connected (no token)");
  return data.accessToken;
}

export async function sallaGet(merchantId: string, path: string) {
  const token = await getMerchantToken(merchantId);

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Salla API error ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}
