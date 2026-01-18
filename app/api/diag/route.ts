// app/api/diag/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.TF_ADVISORY_URL || "";

  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        has_TF_ADVISORY_URL: false,
        msg: "TF_ADVISORY_URL is not set on this deployment environment.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const testUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;

  try {
    const res = await fetch(testUrl, {
      cache: "no-store",
      next: { revalidate: 0 },
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/csv,text/plain,*/*",
      },
    });

    const text = await res.text();
    return NextResponse.json(
      {
        ok: res.ok,
        has_TF_ADVISORY_URL: true,
        status: res.status,
        content_type: res.headers.get("content-type"),
        // show only a small sample (safe)
        sample: text.slice(0, 300),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        has_TF_ADVISORY_URL: true,
        error: String(e?.message || e),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
