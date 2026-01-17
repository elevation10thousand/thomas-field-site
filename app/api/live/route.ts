// app/api/live/route.ts
import { fetchLatestWxFromLoki } from "../../../lib/loki";
import { normalizeWx } from "../../../lib/tf";

export const runtime = "nodejs";

export async function GET() {
  try {
    const raw = await fetchLatestWxFromLoki();
    const wx = normalizeWx(raw);

    return Response.json(wx ?? { ok: true, found: false }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, message: err?.message || String(err) },
      { status: 500 }
    );
  }
}

