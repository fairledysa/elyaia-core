// FILE: src/lib/salla/client.ts
export async function sallaFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.salla.dev${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Salla API failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as T;
}
