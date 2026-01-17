// lib/loki.ts
// Uses Loki query_range because log queries are not supported on the instant /query endpoint.

type ThomasWx = any;

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function basicAuthHeader(user: string, token: string): string {
  const b64 = Buffer.from(`${user}:${token}`).toString("base64");
  return `Basic ${b64}`;
}

/**
 * Fetch the most recent wx JSON line from Loki via query_range.
 * Returns parsed JSON (your wx object) or null if nothing matched.
 */
export async function fetchLatestWxFromLoki(): Promise<ThomasWx | null> {
  const baseUrl = mustEnv("LOKI_BASE_URL").replace(/\/$/, "");
  const user = mustEnv("LOKI_USER");
  const token = mustEnv("LOKI_TOKEN");

  // Default: select your stream and filter to wx JSON logs
  const query =
    process.env.LOKI_QUERY || `{job="thomas-field"} |= "\"msg\":\"wx\"" | json`;

  // Look back a little bit so we always catch the last entry
  const lookbackSeconds = Math.max(60, Number(process.env.LOKI_LOOKBACK_SECONDS || "600"));
  const endNs = BigInt(Date.now()) * 1000000n;
  const startNs = endNs - BigInt(lookbackSeconds) * 1000000000n;

  const url =
    `${baseUrl}/loki/api/v1/query_range?` +
    new URLSearchParams({
      query,
      direction: "backward",
      limit: "1",
      start: startNs.toString(),
      end: endNs.toString(),
    }).toString();

  const resp = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(user, token),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Loki HTTP ${resp.status}: ${text}`);
  }

  const json = await resp.json();
  const result = json?.data?.result?.[0];
  const value = result?.values?.[0]; // [tsNs, line]
  if (!value) return null;

  const line = value[1];

  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
