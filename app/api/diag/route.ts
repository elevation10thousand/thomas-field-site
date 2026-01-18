export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.TF_ADVISORY_URL;

  if (!base) {
    return NextResponse.json(
      { ok: false, has_TF_ADVISORY_URL: false, msg: "TF_ADVISORY_URL is NOT set on this deployment." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const url = `${base}${base.includes("?") ? "&" : "?"}t=${Date.now()}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      next: { revalidate: 0 },
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv,text/plain,*/*" },
    });

    const text = await res.text();

    return NextResponse.json(
      {
        ok: res.ok,
        has_TF_ADVISORY_URL: true,
        status: res.status,
        content_type: res.headers.get("content-type"),
        sample: text.slice(0, 300),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, has_TF_ADVISORY_URL: true, error: String(e?.message || e) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

