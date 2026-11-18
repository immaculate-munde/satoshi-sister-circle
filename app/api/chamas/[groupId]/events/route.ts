import { api, authed } from "@/lib/api/http";
import { lastSequence, requireMember } from "@/lib/domain/chamas";

/**
 * Authorized Server-Sent Events. Emits the latest ledger sequence whenever it changes; the client
 * refetches the canonical ledger. Holds no payment logic, so it is safe inside a request handler.
 */
export const GET = api<{ groupId: string }>(async ({ ctx, req, params }) => {
  const user = await authed(ctx);
  await requireMember(ctx.db, params.groupId, user.id);
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stop = () => {
    closed = true;
    if (timer) clearInterval(timer);
  };
  const stream = new ReadableStream({
    async start(controller) {
      let last = -1;
      let ticks = 0;
      const send = async () => {
        if (closed) return;
        try {
          const seq = await lastSequence(ctx.db, params.groupId);
          if (seq !== last) {
            last = seq;
            controller.enqueue(encoder.encode(`event: ledger\ndata: ${JSON.stringify({ sequence: seq })}\n\n`));
          } else if (++ticks % 15 === 0) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          }
        } catch {
          stop();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      await send();
      timer = setInterval(send, 1000);
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel: stop,
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" },
  });
});
