export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const script = `(() => {
  const endpoint = ${JSON.stringify(`${origin}/api/visitor/live`)};
  const storageKey = "direct_optimize_email_lead";
  const visitorKey = "direct_optimize_visitor_id";
  const params = new URLSearchParams(window.location.search);
  const content = params.get("utm_content");
  if (content && /^lead_[A-Za-z0-9_-]+$/.test(content)) {
    window.localStorage.setItem(storageKey, content);
  }
  const attribution = window.localStorage.getItem(storageKey);
  if (!attribution || !/^lead_[A-Za-z0-9_-]+$/.test(attribution)) return;
  let visitorId = window.localStorage.getItem(visitorKey);
  if (!visitorId) {
    visitorId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    window.localStorage.setItem(visitorKey, visitorId);
  }
  const payload = () => ({
    utmContent: attribution,
    visitorId,
    pageUrl: window.location.href,
    pageTitle: document.title,
    referrer: document.referrer || null,
    utmCampaign: params.get("utm_campaign"),
    utmTerm: params.get("utm_term")
  });
  const ping = () => {
    const body = JSON.stringify(payload());
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      if (sent) return;
    }
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  };
  ping();
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") ping();
  }, 20000);
  window.addEventListener("pagehide", ping);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ping();
  });
  window.addEventListener("beforeunload", () => window.clearInterval(timer));
})();`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
