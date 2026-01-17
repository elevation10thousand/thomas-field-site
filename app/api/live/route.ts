import { fetchLatestWxFromLoki } from "../../../lib/loki";

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(sseEncode("status", { ok: true, connected: true }))
      );

      while (true) {
        try {
          const wx = await fetchLatestWxFromLoki();

          if (wx) {
            const changed =
              (typeof wx.msg_seq === "number" && wx.msg_seq !== lastSeq) ||
              (typeof wx.ts_unix_s === "number" && wx.ts_unix_s !== lastTs);

            if (changed) {
              lastSeq = wx.msg_seq ?? lastSeq;
              lastTs = wx.ts_unix_s ?? lastTs;
              controller.enqueue(encoder.encode(sseEncode("wx", wx)));
            }
          } else {
            controller.enqueue(
              encoder.encode(sseEncode("status", { ok: true, found: false }))
            );
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
