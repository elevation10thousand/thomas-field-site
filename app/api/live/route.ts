// app/api/live/route.ts
import { fetchLatestWxFromLoki } from "../../../lib/loki";
import { normalizeWx } from "../../../lib/tf";
import { fetchAdvisoryFromPublishedCsv } from "../../../lib/advisory";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [raw, adv] = await Promise.all([
      fetchLatestWxFromLoki(),
      fetchAdvisoryFromPublishedCsv(),
    ]);

    const wx = normalizeWx(raw);

    const now_s = Math.floor(Date.now() / 1000);
    const advisory_age_s =
      typeof adv?.advisory_ts_unix_s === "number"
        ? Math.max(0, now_s - adv.advisory_ts_unix_s)
        : null;

    return Response.json(
      {
        ...(wx ?? { ok: true, found: false }),
        advisory: adv?.advisory ?? null,
        advisory_ts_unix_s: adv?.advisory_ts_unix_s ?? null,
        advisory_age_s,

        // ✅ NEW: pass through Sheets-selected color
        advisory_color: adv?.advisory_color ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return Response.json(
      { ok: false, message: err?.message || String(err) },
      { status: 500 }
    );
  }
}

