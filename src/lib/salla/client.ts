// FILE: src/lib/salla/client.ts
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SALLA_API_BASE = "https://api.salla.dev";
const SALLA_ACCOUNTS_BASE = "https://accounts.salla.sa";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

type TokenRow = {
  installation_id: string;
  access_token: string | null;
  refresh_token: string | null;
  access_expires_at: string | null;
  scopes?: string[] | null;
};

type RefreshTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string | string[];
};

function isTokenExpiredOrNearExpiry(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return false;

  // نحدث قبل الانتهاء بـ 60 ثانية احتياطًا
  return expiresMs <= Date.now() + 60_000;
}

function toExpiresAtFromSeconds(expiresIn?: number | null) {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function normalizeScopes(scope: unknown): string[] | null {
  if (!scope) return null;
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);

  return String(scope)
    .split(/[ ,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function readInstallationToken(installationId: string): Promise<TokenRow> {
  const sb = createSupabaseAdminClient();

  const res = await sb
    .from("salla_tokens")
    .select(
      "installation_id, access_token, refresh_token, access_expires_at, scopes",
    )
    .eq("installation_id", installationId)
    .maybeSingle();

  if (res.error) throw new Error(res.error.message);
  if (!res.data) {
    throw new Error(`Missing salla token for installation ${installationId}`);
  }

  return res.data as TokenRow;
}

async function refreshInstallationToken(
  installationId: string,
  refreshToken: string,
): Promise<TokenRow> {
  const clientId = mustEnv("SALLA_CLIENT_ID");
  const clientSecret = mustEnv("SALLA_CLIENT_SECRET");
  const sb = createSupabaseAdminClient();

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);

  const res = await fetch(`${SALLA_ACCOUNTS_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  let json: RefreshTokenResponse = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    throw new Error(`Salla token refresh failed: ${res.status} ${text}`);
  }

  if (!json.access_token) {
    throw new Error("Salla token refresh returned no access_token");
  }

  const updatedToken: TokenRow = {
    installation_id: installationId,
    access_token: String(json.access_token),
    refresh_token: json.refresh_token
      ? String(json.refresh_token)
      : refreshToken,
    access_expires_at: toExpiresAtFromSeconds(json.expires_in ?? null),
    scopes: normalizeScopes(json.scope),
  };

  const up = await sb.from("salla_tokens").upsert(
    {
      installation_id: installationId,
      access_token: updatedToken.access_token,
      refresh_token: updatedToken.refresh_token,
      access_expires_at: updatedToken.access_expires_at,
      scopes: updatedToken.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "installation_id" },
  );

  if (up.error) throw new Error(up.error.message);

  return updatedToken;
}

export async function getValidSallaAccessToken(
  installationId: string,
): Promise<string> {
  const token = await readInstallationToken(installationId);

  if (!token.access_token) {
    throw new Error("Missing access_token");
  }

  if (
    token.refresh_token &&
    isTokenExpiredOrNearExpiry(token.access_expires_at)
  ) {
    const refreshed = await refreshInstallationToken(
      installationId,
      token.refresh_token,
    );

    if (!refreshed.access_token) {
      throw new Error("Failed to refresh access_token");
    }

    return refreshed.access_token;
  }

  return token.access_token;
}

export async function sallaFetch<T>(
  path: string,
  installationId: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${SALLA_API_BASE}${path}`;

  async function doFetch(accessToken: string) {
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
    return { res, text };
  }

  let accessToken = await getValidSallaAccessToken(installationId);
  let { res, text } = await doFetch(accessToken);

  // إذا رجع 401 نجرب refresh مرة واحدة ثم نعيد الطلب
  if (res.status === 401) {
    const token = await readInstallationToken(installationId);

    if (!token.refresh_token) {
      throw new Error(`Salla API failed: ${res.status} ${text}`);
    }

    accessToken = (
      await refreshInstallationToken(installationId, token.refresh_token)
    ).access_token!;

    const retry = await doFetch(accessToken);
    res = retry.res;
    text = retry.text;
  }

  if (!res.ok) {
    throw new Error(`Salla API failed: ${res.status} ${text}`);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

type PaginatedResponse<T> = {
  data?: T[];
  pagination?: {
    current_page?: number;
    last_page?: number;
    total?: number;
    per_page?: number;
    has_more_pages?: boolean;
  };
  links?: {
    next?: string | null;
  };
};

export async function sallaFetchAllPages<T>(
  path: string,
  installationId: string,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const pagedPath = `${path}${separator}page=${page}`;

    const json = await sallaFetch<PaginatedResponse<T>>(
      pagedPath,
      installationId,
    );

    const rows = Array.isArray(json?.data) ? json.data : [];
    results.push(...rows);

    const currentPage = Number(json?.pagination?.current_page ?? page);
    const lastPage = Number(json?.pagination?.last_page ?? currentPage);
    const hasMore =
      Boolean(json?.pagination?.has_more_pages) || currentPage < lastPage;

    if (!hasMore || rows.length === 0) break;
    page += 1;
  }

  return results;
}