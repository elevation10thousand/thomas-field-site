// app/api/live/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchLatestWxFromLoki } from "@/lib/loki";
import { normalizeWx } from "@/lib/tf";
import { fetchAdvisoryFromPublishedCsv, type AdvisoryPayload } from "@/lib/advisory";

export async function GET() {
  const nowS = Math.floor(Date.now() / 1000);

  // 1) Loki -> normalize
  const raw = await fetchLatestWxFromLoki();
  const wx = normalizeWx(raw);

  // 2) Sheets advisory (never derived from rec_reason)
  let adv: AdvisoryPayload = {
    advisory: null,
    advisory_ts_unix_s: null,
    advisory_color: null,
  };

  try {
    adv = await fetchAdvisoryFromPublishedCsv();
  } catch (e) {
    console.error("Advisory fetch failed:", e);
  }

  const advisory_ts_unix_s = adv.advisory_ts_unix_s;
  const advisory_age_s = advisory_ts_unix_s ? Math.max(0, nowS - advisory_ts_unix_s) : null;

  const merged = {
    ...(wx || {}),

    // Always include these fields (even if null)
    advisory: adv.advisory,
    advisory_ts_unix_s,
    advisory_age_s,
    advisory_color: adv.advisory_color,
  };

  return NextResponse.json(merged, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}


