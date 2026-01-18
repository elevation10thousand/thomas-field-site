// lib/advisory.ts

export type AdvisoryPayload = {
  advisory: string | null;
  advisory_ts_unix_s: number | null; // comes from updated_unix_s (preferred)
  advisory_color: string | null; // "red" | "amber" | "green" | "neutral" | null
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur);
  return out.map((s) => s.trim());
}

function normKey(k: string): string {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function normVal(v: string): string {
  return String(v || "").trim();
}

function normColor(v: string): string | null {
  const s = normVal(v).toLowerCase();
  if (!s) return null;
  if (s === "red") return "red";
  if (s === "amber" || s === "yellow") return "amber";
  if (s === "green") return "green";
  if (s === "neutral" || s === "gray" || s === "grey") return "neutral";
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse ONE CSV response into AdvisoryPayload.
 * Supports key/value sheet like:
 *   advisory,value
 *   advisory,grading operations and plowing.
 *   updated_unix_s,1768719549
 *   advisory_color,red
 */
function parseAdvisoryCsv(text: string): AdvisoryPayload {
  const trimmed = (text || "").trim();
  if (!trimmed) return { advisory: null, advisory_ts_unix_s: null, advisory_color: null };

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { advisory: null, advisory_ts_unix_s: null, advisory_color: null };

  const header0 = parseCsvLine(lines[0]).map((c) => c.toLowerCase());

  // CASE 1: key/value table
  if (header0.length >= 2 && header0[1] === "value") {
    let advisory: string | null = null;
    let advisory_ts_unix_s: number | null = null;
    let advisory_color: string | null = null;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      const key = normKey(String(row[0] ?? ""));
      const val = normVal(String(row[1] ?? ""));

      if (key === "advisory") {
        advisory = val.length ? val : null;
      } else if (key === "updated_unix_s" || key === "advisory_ts_unix_s") {
        const ts = Number(val);
        advisory_ts_unix_s = Number.isFinite(ts) && ts > 0 ? ts : null;
      } else if (key === "advisory_color" || key === "advisorycolor" || key === "color") {
        advisory_color = normColor(val);
      }
    }

    return { advisory, advisory_ts_unix_s, advisory_color };
  }

  // CASE 2: header + first data row
  if (lines.length >= 2) {
    const header = parseCsvLine(lines[0]).map((h) => normKey(h));
    const row1 = parseCsvLine(lines[1]);

    const advisoryIdx = header.indexOf("advisory");
    const tsIdx = header.indexOf("updated_unix_s");
    const colorIdx = header.indexOf("advisory_color");

    const advisory = normVal(String(advisoryIdx >= 0 ? row1[advisoryIdx] : (row1[0] ?? "")));

    const ts = Number(normVal(String(tsIdx >= 0 ? row1[tsIdx] : "")));
    const advisory_ts_unix_s = Number.isFinite(ts) && ts > 0 ? ts : null;

    const rawColor = colorIdx >= 0 ? String(row1[colorIdx] ?? "") : "";
    const advisory_color = normColor(rawColor);

    return {
      advisory: advisory.length ? advisory : null,
      advisory_ts_unix_s,
      advisory_color,
    };
  }

  // CASE 3: single cell fallback
  const single = parseCsvLine(lines[0])[0] ?? "";
  const advisory = normVal(String(single));
  return { advisory: advisory.length ? advisory : null, advisory_ts_unix_s: null, advisory_color: null };
}

/**
 * Fetch twice to defeat "published sheet" stale caching.
 * Choose newest updated_unix_s; if tie, prefer the one with longer advisory text.
 */
export async function fetchAdvisoryFromPublishedCsv(): Promise<AdvisoryPayload> {
  // Accept either env var name (so Vercel + local both work)
  const urlEnv =
    process.env.TF_ADVISORY_URL ||
    process.env.ADVISORY_SHEET_CSV_URL;

  if (!urlEnv) {
    console.warn("Advisory: missing env var TF_ADVISORY_URL / ADVISORY_SHEET_CSV_URL");
    return { advisory: null, advisory_ts_unix_s: null, advisory_color: null };
  }

  const url = String(urlEnv);

  async function fetchOnce(csvUrl: string, extraCb: number): Promise<AdvisoryPayload> {
    const cb = Math.floor(Date.now() / 5000) + extraCb;
    const sep = csvUrl.includes("?") ? "&" : "?";
    const urlWithCb = `${csvUrl}${sep}cb=${cb}`;

    const res = await fetch(urlWithCb, {
      cache: "no-store",
      // This helps on Vercel (and doesn't hurt locally)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      next: { revalidate: 0 },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/csv,text/plain,*/*",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Advisory fetch HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }

    const txt = await res.text();
    return parseAdvisoryCsv(txt);
  }

  try {
    const a = await fetchOnce(url, 0);

    // tiny delay + second fetch (often returns the "other" cached variant)
    await sleep(250);

    const b = await fetchOnce(url, 1);

    const aTs = a.advisory_ts_unix_s ?? -1;
    const bTs = b.advisory_ts_unix_s ?? -1;

    if (bTs > aTs) return b;
    if (aTs > bTs) return a;

    // if timestamps same/missing, prefer longer advisory
    const aLen = (a.advisory ?? "").length;
    const bLen = (b.advisory ?? "").length;
    if (bLen > aLen) return b;

    return a;
  } catch (err) {
    // IMPORTANT: log the actual error so Vercel logs tell us why it failed
    console.error("Advisory fetch failed:", err);
    return { advisory: null, advisory_ts_unix_s: null, advisory_color: null };
  }
}


