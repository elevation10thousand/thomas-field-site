// app/api/live/sse/route.ts
import { fetchLatestWxFromLoki } from "../../../../lib/loki";
import { normalizeWx } from "../../../../lib/tf";
import { fetchAdvisoryFromPublishedCsv } from "../../../../lib/advisory";

export const runtime = "nodejs";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sseEncode(event: string, data: any) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const pollSeconds = Math.max(3, Number(process.env.SSE_POLL_SECONDS || "8"));
  const encoder = new TextEncoder();

  let lastSeq: number | null = null;
  let lastTs: number | null = null;

  // Advisory cache (don’t hammer Sheets)
  let lastAdvFetchMs = 0;
  let lastAdv: { advisory: string | null; advisory_ts_unix_s: number | null; advisory_color: string | null } = {
    advisory: null,
    advisory_ts_unix_s: null,
    advisory_color: null,
  };
  const ADV_REFRESH_MS = 15_000;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(sseEncode("status", { ok: true, connected: true })));

      let pingT = Date.now();

      try {
        while (true) {
          if (Date.now() - pingT > 25000) {
            pingT = Date.now();
            controller.enqueue(encoder.encode(sseEncode("ping", { t: Math.floor(Date.now() / 1000) })));
          }

          try {
            // Refresh advisory periodically
            const nowMs = Date.now();
            if (nowMs - lastAdvFetchMs > ADV_REFRESH_MS) {
              lastAdvFetchMs = nowMs;
              try {
                lastAdv = await fetchAdvisoryFromPublishedCsv();
              } catch {
                // keep lastAdv
              }
            }

            const raw = await fetchLatestWxFromLoki();
            const wx = normalizeWx(raw);

            if (wx) {
              const now_s = Math.floor(Date.now() / 1000);
              const advisory_age_s =
                typeof lastAdv.advisory_ts_unix_s === "number"
                  ? Math.max(0, now_s - lastAdv.advisory_ts_unix_s)
                  : null;

              const merged = {
                ...wx,
                advisory: lastAdv.advisory ?? null,
                advisory_ts_unix_s: lastAdv.advisory_ts_unix_s ?? null,
                advisory_age_s,
                advisory_color: lastAdv.advisory_color ?? null,
              };

              const changed =
                (typeof merged.msg_seq === "number" && merged.msg_seq !== lastSeq) ||
                (typeof merged.ts_unix_s === "number" && merged.ts_unix_s !== lastTs) ||
                // also push if advisory text changed (even if wx didn't)
                (typeof merged.advisory === "string" && merged.advisory !== (lastAdv.advisory ?? null));

              if (changed) {
                lastSeq = merged.msg_seq ?? lastSeq;
                lastTs = merged.ts_unix_s ?? lastTs;
                controller.enqueue(encoder.encode(sseEncode("wx", merged)));
              }
            } else {
              controller.enqueue(encoder.encode(sseEncode("status", { ok: true, found: false })));
            }
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(
                sseEncode("error", {
                  ok: false,
                  message: err?.message || String(err),
                })
              )
            );
          }

          await sleep(pollSeconds * 1000);
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export {};


