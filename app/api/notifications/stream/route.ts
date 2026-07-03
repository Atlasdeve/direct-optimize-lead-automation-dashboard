import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const where = user.role === "admin" ? { recipientUserId: null } : { recipientUserId: user.id };

  const encoder = new TextEncoder();
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const seen = new Set<string>();
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try { controller.close(); } catch { /* stream already closed */ }
      };
      request.signal.addEventListener("abort", close, { once: true });

      const initial = await prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 });
      initial.forEach((item) => seen.add(item.id));
      send("snapshot", initial);

      pollTimer = setInterval(async () => {
        try {
          const latest = await prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 });
          const fresh = latest.filter((item) => !seen.has(item.id)).reverse();
          for (const item of fresh) {
            seen.add(item.id);
            send("notification", item);
          }
          if (seen.size > 200) {
            seen.clear();
            latest.forEach((item) => seen.add(item.id));
          }
        } catch {
          send("error", { message: "Notification stream temporarily unavailable." });
        }
      }, 1500);
      heartbeatTimer = setInterval(() => send("heartbeat", { at: Date.now() }), 15000);
    },
    cancel() {
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
